require('dotenv').config();
const { execSync } = require('child_process');

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const args = process.argv.slice(2).join(' ');
execSync(`node-pg-migrate ${args}`, { stdio: 'inherit', env: process.env });
