const redis = require('../../config/redis');

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const BLOCK_SECONDS = 15 * 60;  // 15 minutes

function loginAttemptKey(identifier) {
  return `login_attempts:${identifier}`;
}

function loginBlockKey(identifier) {
  return `login_block:${identifier}`;
}

async function checkLoginBlock(identifier) {
  try {
    const ttl = await redis.ttl(loginBlockKey(identifier));
    if (ttl > 0) {
      return { blocked: true, retryAfterSeconds: ttl };
    }
    return { blocked: false, retryAfterSeconds: 0 };
  } catch (err) {
    console.error('[RATE LIMIT] checkLoginBlock error:', err.message);
    return { blocked: false, retryAfterSeconds: 0 }; 
  }
}

async function recordFailedAttempt(identifier) {
  try {
    const key = loginAttemptKey(identifier);
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(loginBlockKey(identifier), '1', 'EX', BLOCK_SECONDS);
      await redis.del(key); // i-reset yung counter pagkatapos i-block
    }

    return attempts;
  } catch (err) {
    console.error('[RATE LIMIT] recordFailedAttempt error:', err.message);
    return 0;
  }
}

async function clearLoginAttempts(identifier) {
  try {
    await redis.del(loginAttemptKey(identifier));
    await redis.del(loginBlockKey(identifier));
  } catch (err) {
    console.error('[RATE LIMIT] clearLoginAttempts error:', err.message);
  }
}

module.exports = { checkLoginBlock, recordFailedAttempt, clearLoginAttempts };