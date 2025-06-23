const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initializeSessionStore, getSessionMiddleware } = require('./config/session');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Database setup
const knex = require('knex')(require('./knexfile')[process.env.NODE_ENV || 'development']);

// Initialize session store
const initServer = async () => {
  await initializeSessionStore();
  
  // Middleware
  app.set('trust proxy', 1); // Trust first proxy for rate limiting
  app.use(helmet());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true // Enable cookies/sessions
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware
  app.use(getSessionMiddleware());

  // Rate limiting - disabled for development, enabled for production
  if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
      }
    });
    app.use(limiter);
    console.log('✅ Rate limiting enabled for production');
  } else {
    console.log('⚠️ Rate limiting disabled for development');
  }

  // Static files with CORS headers
  app.use('/uploads', (req, res, next) => {
    // Allow requests from both localhost:3000 and localhost:3001
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV !== 'production') {
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(__dirname, 'uploads')));

  // Broadcast scoreboard update function
  const broadcastScoreboardUpdate = async (eventId) => {
    try {
      const scoreboard = await knex('teams')
        .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
        .where('teams.event_id', eventId)
        .groupBy('teams.id', 'teams.name', 'teams.logo_url')
        .select(
          'teams.id',
          'teams.name',
          'teams.logo_url',
          knex.raw('COALESCE(SUM(team_progress.points_awarded), 0) as total_points'),
          knex.raw('COUNT(CASE WHEN team_progress.correct = true THEN 1 END) as questions_solved'),
          knex.raw('COUNT(CASE WHEN team_progress.completed = true THEN 1 END) as completed_questions'),
          knex.raw('MAX(team_progress.time_answered) as last_answer_time')
        )
        .orderBy('total_points', 'desc')
        .orderBy('questions_solved', 'desc')
        .orderBy('last_answer_time', 'asc');

      const updateData = {
        type: 'scoreboard',
        data: scoreboard,
        eventId: eventId
      };

      // Check how many clients are in the event room
      const room = io.sockets.adapter.rooms.get(`event-${eventId}`);
      const clientCount = room ? room.size : 0;
      
      console.log(`📊 About to broadcast scoreboard update for event ${eventId} to ${clientCount} connected clients`);
      console.log(`📊 Scoreboard data:`, updateData);
      
      io.to(`event-${eventId}`).emit('live-data-update', updateData);
      
      console.log(`📊 Broadcasted scoreboard update for event ${eventId} to ${clientCount} clients (${scoreboard.length} teams in data)`);
    } catch (error) {
      console.error('Error broadcasting scoreboard update:', error);
    }
  };

  // Routes
  const authRoutes = require('./routes/auth');
  const eventRoutes = require('./routes/events');
  const { router: teamRoutes } = require('./routes/teams');
  const questionRoutes = require('./routes/questions');
  const gameRoutes = require('./routes/game')(io, broadcastScoreboardUpdate);

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/game', gameRoutes);

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-event', (eventId) => {
      socket.join(`event-${eventId}`);
      
      // Check how many clients are now in the room
      const room = io.sockets.adapter.rooms.get(`event-${eventId}`);
      const clientCount = room ? room.size : 0;
      
      console.log(`Socket ${socket.id} joined event ${eventId} (${clientCount} clients now in room)`);
    });

    socket.on('team-joined', (data) => {
      socket.to(`event-${data.eventId}`).emit('team-update', data);
    });

    socket.on('answer-submitted', (data) => {
      socket.to(`event-${data.eventId}`).emit('scoreboard-update', data);
    });

    // Handle live data requests
    socket.on('request-live-data', async (data) => {
      try {
        const { type, params } = data;
        let result = null;

        switch (type) {
          case 'team-progress':
            if (params.teamId) {
              const progress = await knex('team_progress')
                .join('questions', 'team_progress.question_id', 'questions.id')
                .where({ team_id: params.teamId })
                .select('team_progress.*', 'questions.title as question_title', 'questions.difficulty');
              result = { type: 'team-progress', data: progress, teamId: params.teamId };
            }
            break;

          case 'event-stats':
            if (params.eventId) {
              const [teams, totalQuestions] = await Promise.all([
                knex('teams').where({ event_id: params.eventId }).count('* as count').first(),
                knex('questions')
                  .join('event_questions', 'questions.id', 'event_questions.question_id')
                  .where({ 'event_questions.event_id': params.eventId })
                  .count('* as count').first()
              ]);
              result = { 
                type: 'event-stats', 
                data: { 
                  totalTeams: teams.count,
                  totalQuestions: totalQuestions.count 
                }, 
                eventId: params.eventId 
              };
            }
            break;

          case 'scoreboard':
            if (params.eventId) {
              const scoreboard = await knex('teams')
                .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
                .where('teams.event_id', params.eventId)
                .groupBy('teams.id', 'teams.name', 'teams.logo_url')
                .select(
                  'teams.id',
                  'teams.name',
                  'teams.logo_url',
                  knex.raw('COALESCE(SUM(team_progress.points_awarded), 0) as total_points'),
                  knex.raw('COUNT(CASE WHEN team_progress.correct = true THEN 1 END) as questions_solved'),
                  knex.raw('COUNT(CASE WHEN team_progress.completed = true THEN 1 END) as completed_questions')
                )
                .orderBy('total_points', 'desc')
                .orderBy('questions_solved', 'desc');
              result = { type: 'scoreboard', data: scoreboard, eventId: params.eventId };
            }
            break;
        }

        if (result) {
          socket.emit('live-data-update', result);
        }
      } catch (error) {
        console.error('Error handling live data request:', error);
        socket.emit('live-data-error', { error: 'Failed to fetch live data' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Start the server
initServer().catch(console.error);

module.exports = { app, io, knex }; 