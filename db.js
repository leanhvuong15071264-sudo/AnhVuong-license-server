const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Neon PostgreSQL error:', err);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function testConnection() {
  const result = await pool.query('SELECT NOW() AS now');
  console.log('Neon PostgreSQL connected:', result.rows[0].now);
}

module.exports = {
  pool,
  query,
  testConnection
};