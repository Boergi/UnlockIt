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
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
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
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    credentials: true // Enable cookies/sessions
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware
  app.use(getSessionMiddleware());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  });
  app.use(limiter);

  // Static files
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Routes
  const authRoutes = require('./routes/auth');
  const eventRoutes = require('./routes/events');
  const teamRoutes = require('./routes/teams');
  const questionRoutes = require('./routes/questions');
  const gameRoutes = require('./routes/game');

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
      console.log(`Socket ${socket.id} joined event ${eventId}`);
    });

    socket.on('team-joined', (data) => {
      socket.to(`event-${data.eventId}`).emit('team-update', data);
    });

    socket.on('answer-submitted', (data) => {
      socket.to(`event-${data.eventId}`).emit('scoreboard-update', data);
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