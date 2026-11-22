const { Pool, types } = require('pg');
require('dotenv').config();
types.setTypeParser(1082, (v) => v);
// DATABASE_URL set = hosted db (supabase), otherwise DB_* vars (local dev, vps container)
// DB_SSL=true turns ssl on, anything else leaves it off
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'detailing_booking_db',
      user: process.env.DB_USER || process.env.USER,
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool({
  ...connection,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// connection status
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'Asia/Manila'").catch((err) => {
    console.error('Failed to set session timezone:', err.message);
  });
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

module.exports = pool;
