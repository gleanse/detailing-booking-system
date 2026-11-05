const { Pool, types } = require('pg');
require('dotenv').config();
types.setTypeParser(1082, (v) => v);
// NOTE: if migrating from supabase to a self-hosted vps (fully dockerized),
// update this branch so 'production' also supports db_host/db_port/etc.
// instead of only DATABASE_URL - otherwise docker's production target
// will still try to reach supabase via DATABASE_URL.
const pool = new Pool(
  process.env.NODE_ENV === 'production'
    ? {
        // SUPABASE DATABASE
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        // LOCAL POSTGRES DATABASE
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'detailing_booking_db',
        user: process.env.DB_USER || process.env.USER,
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
);

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
