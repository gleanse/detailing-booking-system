require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// SCRIPT for auto insert fresh seeds data for the database, by deleting old remaining data and re inserting fresh seeds data
async function seed() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Wiping existing data...');
    await client.query(`
      TRUNCATE TABLE
        audit_logs, notifications, payments, booking_status_logs,
        bookings, availability, closed_dates, service_variants,
        services, users
      RESTART IDENTITY CASCADE;
    `);

    console.log('Inserting seed data...');
    const seedPath = path.join(__dirname, '../src/database/seeds/overall.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);

    console.log('✔ Seed complete.');
  } catch (err) {
    console.error('✘ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seed();
