require('dotenv').config();
const { Client } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

async function ensureDatabase() {
  const dbUrl = new URL(connectionString);
  const targetDb = dbUrl.pathname.slice(1);

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDb],
  );

  if (rows.length === 0) {
    console.log(`Database "${targetDb}" not found, creating it...`);
    await client.query(`CREATE DATABASE "${targetDb}"`);
  } else {
    console.log(`Database "${targetDb}" already exists, skipping.`);
  }

  await client.end();
}

ensureDatabase().catch((err) => {
  console.error('Failed to ensure database exists:', err);
  process.exit(1);
});
