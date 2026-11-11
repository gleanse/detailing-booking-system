const redis = require('../../../config/redis');

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const REMEMBER_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const indexKey = (userId) => `cust_sessions:${userId}`;
// same key the session store in app.js writes
const sessionKey = (sid) => `sess:${sid}`;

const regenerate = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

const save = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

// drops ids whose session already expired so the set cannot grow forever
const pruneDead = async (key) => {
  const sids = await redis.smembers(key);
  if (sids.length === 0) return;

  const alive = await Promise.all(
    sids.map((sid) => redis.exists(sessionKey(sid))),
  );
  const dead = sids.filter((_, i) => !alive[i]);

  if (dead.length > 0) await redis.srem(key, ...dead);
};

const startSession = async (req, user, rememberMe) => {
  await regenerate(req);

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
  req.session.cookie.maxAge = rememberMe
    ? REMEMBER_MAX_AGE_MS
    : DEFAULT_MAX_AGE_MS;
  await save(req);

  const key = indexKey(user.id);
  await redis.sadd(key, req.sessionID);
  await redis.expire(key, REMEMBER_MAX_AGE_MS / 1000);
  await pruneDead(key);
};

const endSession = async (req) => {
  const userId = req.session?.user?.id;
  if (!userId) return;

  try {
    await redis.srem(indexKey(userId), req.sessionID);
  } catch (error) {
    console.error('[CUSTOMER SESSIONS] untrack failed:', error.message);
  }
};

// logged, not thrown, so a redis hiccup cannot turn an already
// saved password change into an error page
const revokeSessions = async (userId, keepSid = null) => {
  try {
    const key = indexKey(userId);
    const sids = await redis.smembers(key);
    const targets = sids.filter((sid) => sid !== keepSid);

    if (targets.length === 0) return;

    await redis.del(...targets.map(sessionKey));
    await redis.srem(key, ...targets);
  } catch (error) {
    console.error('[CUSTOMER SESSIONS] revoke failed:', error.message);
  }
};

module.exports = { startSession, endSession, revokeSessions };
