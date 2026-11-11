const redis = require('../../../config/redis');

const LIMITS = { pair: 5, ip: 20 };
const WINDOW_SECONDS = 15 * 60;
const BLOCK_SECONDS = 15 * 60;

const keysFor = (type, value) => {
  const id = String(value).slice(0, 320);
  return {
    fails: `cust_login_fails:${type}:${id}`,
    block: `cust_login_block:${type}:${id}`,
  };
};

const pairOf = (email, ip) => `${email}|${ip}`;

const recordFailure = async (type, value) => {
  const keys = keysFor(type, value);
  const fails = await redis.incr(keys.fails);

  if (fails === 1) await redis.expire(keys.fails, WINDOW_SECONDS);

  if (fails >= LIMITS[type]) {
    await redis.set(keys.block, '1', 'EX', BLOCK_SECONDS);
    await redis.del(keys.fails);
    return { locked: true, left: 0 };
  }

  return { locked: false, left: LIMITS[type] - fails };
};

// fails open if redis is down so customers can still log in
const checkLoginBlock = async ({ email, ip }) => {
  try {
    const [pairTtl, ipTtl] = await Promise.all([
      redis.ttl(keysFor('pair', pairOf(email, ip)).block),
      redis.ttl(keysFor('ip', ip).block),
    ]);
    const retryAfter = Math.max(pairTtl, ipTtl, 0);
    return { blocked: retryAfter > 0, retryAfter };
  } catch (error) {
    console.error('[CUSTOMER LOGIN LIMIT] check failed:', error.message);
    return { blocked: false, retryAfter: 0 };
  }
};

const recordLoginFailure = async ({ email, ip }) => {
  try {
    const [pair, ipResult] = await Promise.all([
      recordFailure('pair', pairOf(email, ip)),
      recordFailure('ip', ip),
    ]);
    const locked = pair.locked || ipResult.locked;

    return {
      locked,
      pairLocked: pair.locked,
      limit: LIMITS.pair,
      retryAfter: locked ? BLOCK_SECONDS : 0,
      attemptsLeft: pair.left,
    };
  } catch (error) {
    console.error('[CUSTOMER LOGIN LIMIT] record failed:', error.message);
    return {
      locked: false,
      pairLocked: false,
      limit: LIMITS.pair,
      retryAfter: 0,
      attemptsLeft: null,
    };
  }
};

// only the pair counter resets, so logging into your own account
// can never wipe the failures counted against your ip
const clearLoginFailures = async ({ email, ip }) => {
  try {
    await redis.del(keysFor('pair', pairOf(email, ip)).fails);
  } catch (error) {
    console.error('[CUSTOMER LOGIN LIMIT] clear failed:', error.message);
  }
};

module.exports = { checkLoginBlock, recordLoginFailure, clearLoginFailures };
