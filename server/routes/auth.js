const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// Check if initial setup is needed
router.get('/setup-status', async (req, res) => {
  try {
    const userCount = await knex('users').count('id as count').first();
    const needsSetup = userCount.count === 0;
    
    res.json({ needsSetup });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initial admin registration (only if no users exist)
router.post('/setup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if any users already exist
    const userCount = await knex('users').count('id as count').first();
    if (userCount.count > 0) {
      return res.status(403).json({ error: 'Initial setup already completed. Use invitation links to add new admins.' });
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
    console.error('Initial setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invitation link (requires authentication)
router.post('/create-invitation', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await knex('users').where({ email }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await knex('admin_invitations')
      .where({ email, used: false })
      .where('expires_at', '>', new Date())
      .first();

    if (existingInvitation) {
      return res.status(409).json({ error: 'Invitation already sent for this email' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await knex('admin_invitations').insert({
      token,
      email,
      created_by: req.user.userId,
      expires_at: expiresAt
    });

    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/admin/register?token=${token}`;

    res.status(201).json({ 
      message: 'Invitation created successfully',
      invitationLink,
      expiresAt
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate invitation token
router.get('/validate-invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await knex('admin_invitations')
      .where({ token, used: false })
      .where('expires_at', '>', new Date())
      .first();

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json({ 
      valid: true,
      email: invitation.email
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register with invitation token
router.post('/register-with-invitation', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate invitation
    const invitation = await knex('admin_invitations')
      .where({ token, used: false })
      .where('expires_at', '>', new Date())
      .first();

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Check if user already exists
    const existingUser = await knex('users').where({ email: invitation.email }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user and mark invitation as used
    const trx = await knex.transaction();
    try {
      const [userId] = await trx('users').insert({
        email: invitation.email,
        password_hash
      });

      await trx('admin_invitations')
        .where({ id: invitation.id })
        .update({ 
          used: true, 
          used_at: new Date() 
        });

      await trx.commit();

      const jwtToken = jwt.sign(
        { userId, email: invitation.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Store user in session as well
      req.session.user = {
        id: userId,
        email: invitation.email
      };

      res.status(201).json({ 
        token: jwtToken, 
        user: { id: userId, email: invitation.email } 
      });
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Register with invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all invitations (requires authentication)
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    const invitations = await knex('admin_invitations')
      .leftJoin('users', 'admin_invitations.created_by', 'users.id')
      .select(
        'admin_invitations.*',
        'users.email as created_by_email'
      )
      .orderBy('admin_invitations.created_at', 'desc');

    res.json(invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
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