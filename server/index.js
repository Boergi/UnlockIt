const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
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

  // Static files with aggressive caching and compression
  app.use('/uploads', compression({
    level: 6, // Good balance between compression and CPU
    threshold: 1024, // Only compress files > 1KB
    filter: (req, res) => {
      // Don't compress images (they're already compressed)
      const contentType = res.getHeader('content-type');
      if (contentType && contentType.includes('image/')) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

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
    
    // Aggressive caching for images (they never change due to unique filenames)
    res.header('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    res.header('Expires', new Date(Date.now() + 31536000000).toUTCString());
    
    next();
  }, express.static(path.join(__dirname, 'uploads'), {
    maxAge: '365d', // 1 year cache
    etag: true,
    immutable: true,
    index: false, // Don't serve directory listings
    setHeaders: (res, filePath) => {
      // Set proper MIME types for better browser handling
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          res.setHeader('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.gif':
          res.setHeader('Content-Type', 'image/gif');
          break;
        case '.webp':
          res.setHeader('Content-Type', 'image/webp');
          break;
      }
      
      // Enable browser-level compression for non-image files
      res.setHeader('Vary', 'Accept-Encoding');
    }
  }));

  // Broadcast scoreboard update function
  const broadcastScoreboardUpdate = async (eventId) => {
    try {
      // Validate that eventId is a UUID for security
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
      
      if (!isUUID) {
        console.log(`🚫 broadcastScoreboardUpdate called with non-UUID eventId: ${eventId}`);
        return;
      }
      
      // For UUID events, use event_uuid in teams table
      const scoreboard = await knex('teams')
        .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
        .where('teams.event_uuid', eventId)
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
      // Validate that eventId is a UUID for security
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
      
      if (!isUUID) {
        console.log(`🚫 Socket ${socket.id} attempted to join event with non-UUID: ${eventId}`);
        socket.emit('error', { message: 'Only UUID access is allowed for security reasons' });
        return;
      }
      
      socket.join(`event-${eventId}`);
      
      // Check how many clients are now in the room
      const room = io.sockets.adapter.rooms.get(`event-${eventId}`);
      const clientCount = room ? room.size : 0;
      
      console.log(`Socket ${socket.id} joined event ${eventId} (${clientCount} clients now in room)`);
    });

    socket.on('team-joined', (data) => {
      // Validate that eventId is a UUID for security
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.eventId);
      
      if (!isUUID) {
        console.log(`🚫 Socket ${socket.id} attempted team-joined with non-UUID eventId: ${data.eventId}`);
        socket.emit('error', { message: 'Only UUID access is allowed for security reasons' });
        return;
      }
      
      socket.to(`event-${data.eventId}`).emit('team-update', data);
    });

    socket.on('answer-submitted', (data) => {
      // Validate that eventId is a UUID for security
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.eventId);
      
      if (!isUUID) {
        console.log(`🚫 Socket ${socket.id} attempted answer-submitted with non-UUID eventId: ${data.eventId}`);
        socket.emit('error', { message: 'Only UUID access is allowed for security reasons' });
        return;
      }
      
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
              // Validate that eventId is a UUID for security
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.eventId);
              
              if (!isUUID) {
                console.log(`🚫 Socket ${socket.id} attempted event-stats with non-UUID eventId: ${params.eventId}`);
                socket.emit('error', { message: 'Only UUID access is allowed for security reasons' });
                return;
              }
              
              const [teams, totalQuestions] = await Promise.all([
                knex('teams').where({ event_uuid: params.eventId }).count('* as count').first(),
                knex('questions')
                  .join('event_questions', 'questions.id', 'event_questions.question_id')
                  .where({ 'event_questions.event_uuid': params.eventId })
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
              // Validate that eventId is a UUID for security
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.eventId);
              
              if (!isUUID) {
                console.log(`🚫 Socket ${socket.id} attempted scoreboard with non-UUID eventId: ${params.eventId}`);
                socket.emit('error', { message: 'Only UUID access is allowed for security reasons' });
                return;
              }
              
              const scoreboard = await knex('teams')
                .leftJoin('team_progress', 'teams.id', 'team_progress.team_id')
                .where('teams.event_uuid', params.eventId)
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

  // Serve static files from React build (production only)
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Serving React build files for production');
    
    // Check if build directory exists
    const buildPath = path.join(__dirname, '../client/build');
    const indexPath = path.join(buildPath, 'index.html');
    
    if (!require('fs').existsSync(buildPath)) {
      console.error('❌ Build directory not found! Run "npm run build" first.');
      process.exit(1);
    }
    
    if (!require('fs').existsSync(indexPath)) {
      console.error('❌ index.html not found in build directory!');
      process.exit(1);
    }
    
    console.log('✅ React build files found and ready to serve');
    
    // Serve static files from the React build folder with proper headers
    app.use(express.static(path.join(__dirname, '../client/build'), {
      maxAge: '1y',
      etag: false,
      setHeaders: (res, path) => {
        // Set proper MIME types for different file types
        if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html');
        }
        
        // Add CORS headers for static files
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
    }));
    
    // Handle React routing - send all non-API requests to React app
    app.get('*', (req, res) => {
      // Don't serve React app for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      
      // Set proper headers for the HTML file
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
  } else {
    console.log('⚠️ Development mode - React app should be served by Create React App dev server on port 3000');
    
    // 404 handler for development (API routes only)
    app.use('/api/*', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
    
    // For non-API routes in development, redirect to React dev server
    app.use('*', (req, res) => {
      const frontendRoutes = ['/admin', '/events', '/team', '/join', '/play', '/scoreboard', '/static'];
      const isFrontendRoute = frontendRoutes.some(route => req.path.startsWith(route));
      
      if (isFrontendRoute) {
        // Redirect to React dev server
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${req.originalUrl}`;
        console.log(`🔄 Redirecting ${req.originalUrl} to React dev server: ${redirectUrl}`);
        res.redirect(302, redirectUrl);
      } else {
        res.status(404).json({ 
          error: 'Route not found',
          message: 'This route does not exist in the API or frontend',
          availableEndpoints: {
            api: 'http://localhost:3001/api/*',
            frontend: 'http://localhost:3000/*'
          }
        });
      }
    });
  }

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Start the server
initServer().catch(console.error);

module.exports = { app, io, knex }; 