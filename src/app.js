// APP JAVASCRIPT
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const pool = require('./config/database');
const redis = require('./config/redis');
const { apiRouter, pagesRouter } = require('./routes/index');

const app = express();

// MIDDLEWARE
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.set('trust proxy', 1);
// custom session store using ioredis
class RedisSessionStore extends session.Store {
  async get(sid, cb) {
    try {
      const data = await redis.get(`sess:${sid}`);
      if (!data) return cb(null, null);
      cb(null, typeof data === 'string' ? JSON.parse(data) : data);
    } catch (err) {
      cb(err);
    }
  }

  async set(sid, sessionData, cb) {
    try {
      const ttl = sessionData.cookie?.maxAge
        ? Math.floor(sessionData.cookie.maxAge / 1000)
        : 60 * 60 * 8;
      await redis.set(`sess:${sid}`, JSON.stringify(sessionData), 'EX', ttl);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  async destroy(sid, cb) {
    try {
      await redis.del(`sess:${sid}`);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }
}

// SESSION
app.use(
  session({
    store: new RedisSessionStore(),
    secret: process.env.SESSION_SECRET || 'herco-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(express.static(path.join(__dirname, '../public')));
app.use('/styles', express.static(path.join(__dirname, './styles')));
app.use(
  '/phosphor',
  express.static(
    path.join(__dirname, '../node_modules/@phosphor-icons/web/src'),
  ),
);
app.use(
  '/gsap',
  express.static(path.join(__dirname, '../node_modules/gsap/dist')),
);
app.use(
  '/fonts/big-shoulders',
  express.static(
    path.join(__dirname, '../node_modules/@fontsource/big-shoulders-display'),
  ),
);

// DATABASE test
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Database connected at:', res.rows[0].now);
  }
});

const singleSession = require('./shared/middlewares/singleSession');

// PAGE routes
app.use('/', pagesRouter);

// single-session check (admin/staff API lang, hindi /api/auth)
app.use('/api/admin', singleSession);
app.use('/api/staff', singleSession);

// API routes
app.use('/api', apiRouter);

module.exports = app;
