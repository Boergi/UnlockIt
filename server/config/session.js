const session = require('express-session');
const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Custom Knex Session Store
class KnexSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.knex = knex;
    this.tableName = 'sessions';
    this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000; // 15 minutes
    
    // Cleanup expired sessions periodically
    this.startCleanup();
  }

  // Get session
  get(sessionId, callback) {
    this.knex(this.tableName)
      .where('session_id', sessionId)
      .where('expires', '>', new Date())
      .first()
      .then(row => {
        if (row) {
          try {
            const data = JSON.parse(row.session_data);
            callback(null, data);
          } catch (err) {
            callback(err);
          }
        } else {
          callback(null, null);
        }
      })
      .catch(callback);
  }

  // Set session
  set(sessionId, sessionData, callback) {
    const expires = new Date(Date.now() + (sessionData.cookie?.maxAge || 24 * 60 * 60 * 1000));
    const data = JSON.stringify(sessionData);

    this.knex(this.tableName)
      .insert({
        session_id: sessionId,
        session_data: data,
        expires: expires
      })
      .onConflict('session_id')
      .merge({
        session_data: data,
        expires: expires,
        updated_at: this.knex.fn.now()
      })
      .then(() => callback(null))
      .catch(callback);
  }

  // Destroy session
  destroy(sessionId, callback) {
    this.knex(this.tableName)
      .where('session_id', sessionId)
      .del()
      .then(() => callback(null))
      .catch(callback);
  }

  // Cleanup expired sessions
  cleanup() {
    this.knex(this.tableName)
      .where('expires', '<', new Date())
      .del()
      .then(count => {
        if (count > 0) {
          console.log(`🧹 Cleaned up ${count} expired sessions`);
        }
      })
      .catch(err => console.error('Session cleanup error:', err));
  }

  startCleanup() {
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }
}

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: false, // Set to false for HTTP in development
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'unlockit.session',
  store: new KnexSessionStore()
};

const initializeSessionStore = async () => {
  console.log('✅ MySQL session store initialized');
};

const getSessionMiddleware = () => {
  return session(sessionConfig);
};

module.exports = {
  initializeSessionStore,
  getSessionMiddleware
}; 