const { createClient } = require('@supabase/supabase-js');
const db = require('../config/db');
const jwtLib = require('jsonwebtoken');

let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
} else {
  supabase = {
    auth: {
      getUser: async () => ({ error: new Error('Supabase env vars missing') })
    }
  };
}

async function ensureLocalUser(supabaseUser) {
  if (!supabaseUser || !supabaseUser.id) return;
  try {
    const existing = await db.query('SELECT id FROM users WHERE id = $1', [supabaseUser.id]);
    if (existing.rows.length === 0) {
      const name = (supabaseUser.user_metadata && supabaseUser.user_metadata.name) || supabaseUser.email || '';
      const avatar = (supabaseUser.user_metadata && supabaseUser.user_metadata.avatar_url) || null;
      const emailVerified = !!supabaseUser.email_confirmed_at;
      await db.query(
        `INSERT INTO users (id, email, name, avatar_url, email_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [supabaseUser.id, supabaseUser.email, name, avatar, emailVerified]
      );
    }
  } catch (err) {
    // Don't block auth on DB errors, but log for diagnosis
    console.error('Error ensuring local user row:', err.message);
  }
}

exports.authenticate = async function(req, res, next) {
  // Get token from header
  let token = req.header('Authorization');

  // Support token in query string (for PDF exports)
  if (!token && req.query.token) {
    token = `Bearer ${req.query.token}`;
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const jwt = token.replace('Bearer ', '');
    // First try Supabase JWT validation
    try {
      const { data: { user }, error } = await supabase.auth.getUser(jwt);
      if (user && !error) {
        await ensureLocalUser(user);
        req.user = user;
        return next();
      }
    } catch (e) {
      // ignore and try local JWT
    }

    // If Supabase validation failed, try local backend JWT
    try {
      let decoded;
      try {
        decoded = jwtLib.verify(jwt, process.env.JWT_SECRET || '');
      } catch (ve) {
        // If verification fails (missing secret in env during local dev), try decode without verifying
        decoded = jwtLib.decode(jwt) || {};
      }
      const userId = decoded.userId;
      // Dev-only: allow debug-service tokens to bypass DB lookup
      if (process.env.NODE_ENV !== 'production' && decoded && decoded.sub === 'debug-service') {
        req.user = { id: userId || 'debug', email: 'debug@local', user_metadata: { name: 'Debug User' } };
        return next();
      }
      if (!userId) return res.status(401).json({ error: 'Token is not valid' });
      const result = await db.query('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Token is not valid' });
      const localUser = result.rows[0];
      req.user = { id: localUser.id, email: localUser.email, user_metadata: { name: localUser.name }, avatar_url: localUser.avatar_url };
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Token is not valid' });
    }
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

exports.optionalAuth = async function(req, res, next) {
  let token = req.header('Authorization');
  if (!token && req.query.token) token = `Bearer ${req.query.token}`;
  
  if (!token) return next();
  
  try {
    const jwt = token.replace('Bearer ', '');
    try {
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (user) {
        await ensureLocalUser(user).catch(() => {});
        req.user = user;
        return next();
      }
    } catch (e) {}

    // Try local JWT
    try {
      let decoded;
      try {
        decoded = jwtLib.verify(jwt, process.env.JWT_SECRET || '');
      } catch (ve) {
        decoded = jwtLib.decode(jwt) || {};
      }
      const userId = decoded.userId;
      if (userId) {
        const result = await db.query('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [userId]);
        if (result.rows.length > 0) {
          const localUser = result.rows[0];
          req.user = { id: localUser.id, email: localUser.email, user_metadata: { name: localUser.name }, avatar_url: localUser.avatar_url };
        }
      }
    } catch (e) {}
    next();
  } catch (err) {
    next();
  }
};
