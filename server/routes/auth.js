const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Middleware to verify JWT token or session
const authenticateToken = (req, res, next) => {
  // Uncomment for debugging:
  // console.log('🔍 Auth check - Session ID:', req.sessionID);
  // console.log('🔍 Auth check - Session user:', req.session?.user);
  // console.log('🔍 Auth check - JWT header:', req.headers['authorization'] ? 'present' : 'missing');

  // First try JWT token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    return jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
        return next();
      }
      
      // JWT failed, try session fallback
      if (req.session && req.session.user) {
        req.user = {
          userId: req.session.user.id,
          email: req.session.user.email
        };
        return next();
      }
      
      return res.status(401).json({ error: 'Authentication required' });
    });
  }

  // No JWT token, try session
  if (req.session && req.session.user) {
    req.user = {
      userId: req.session.user.id,
      email: req.session.user.email
    };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await knex('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Store user in session as well
    req.session.user = {
      id: user.id,
      email: user.email
    };

    console.log('🔐 User logged in, session saved:', req.session.user);
    console.log('🍪 Session ID:', req.sessionID);

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register (for development)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await knex('users').where({ email }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const [userId] = await knex('users').insert({
      email,
      password_hash
    });

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Store user in session as well
    req.session.user = {
      id: userId,
      email: email
    };

    res.status(201).json({ token, user: { id: userId, email } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await knex('users').where({ id: req.user.userId }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test session endpoint
router.get('/session-test', (req, res) => {
  console.log('📊 Session Test:');
  console.log('- Session ID:', req.sessionID);
  console.log('- Session user:', req.session?.user);
  console.log('- Cookie header:', req.headers.cookie);
  
  res.json({
    sessionId: req.sessionID,
    sessionUser: req.session?.user,
    hasCookie: !!req.headers.cookie
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('unlockit.session');
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken; 