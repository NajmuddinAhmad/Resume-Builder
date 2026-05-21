const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connection verified'))
  .catch(err => console.error('⚠️  Database connection failed:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
