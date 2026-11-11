const crypto = require('crypto');
const redis = require('../../../config/redis');

const CODE_TTL_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_TRIES = 5;

const OTP_MESSAGES = {
  expired: 'This code has expired. Please request a new one.',
  locked: 'Too many wrong codes. Please request a new one.',
  wrong: 'Incorrect code. Please try again.',
};

const keysFor = (purpose, id) => ({
  code: `otp:${purpose}:${id}`,
  tries: `otp_tries:${purpose}:${id}`,
  cooldown: `otp_resend:${purpose}:${id}`,
});

const clearOtp = async ({ purpose, id }) => {
  const keys = keysFor(purpose, id);
  await redis.del(keys.code, keys.tries);
};

// send(otp) delivers the code, payload is stored with it and returned on a match
const issueOtp = async ({ purpose, id, payload = null, send }) => {
  const keys = keysFor(purpose, id);

  const claimed = await redis.set(
    keys.cooldown,
    '1',
    'EX',
    RESEND_COOLDOWN_SECONDS,
    'NX',
  );

  if (!claimed) {
    const left = await redis.ttl(keys.cooldown);
    return { sent: false, retryAfter: Math.max(left, 1) };
  }

  try {
    const otp = crypto.randomInt(100000, 1000000).toString();
    await redis.set(
      keys.code,
      JSON.stringify({ otp, payload }),
      'EX',
      CODE_TTL_SECONDS,
    );
    await redis.del(keys.tries);
    await send(otp);
  } catch (error) {
    // the customer never got a code, so they should not wait to ask again
    await redis.del(keys.cooldown, keys.code);
    throw error;
  }

  return { sent: true };
};

// every attempt counts. consume false keeps the code alive for a later step,
// but the attempt still counts toward the limit
const checkOtp = async ({ purpose, id, otp, consume = true }) => {
  const keys = keysFor(purpose, id);

  const raw = await redis.get(keys.code);
  if (!raw) return { ok: false, reason: 'expired' };

  const tries = await redis.incr(keys.tries);
  if (tries === 1) await redis.expire(keys.tries, CODE_TTL_SECONDS);

  if (tries > MAX_TRIES) {
    await clearOtp({ purpose, id });
    return { ok: false, reason: 'locked' };
  }

  const stored = JSON.parse(raw);

  if (stored.otp === otp) {
    if (consume) await clearOtp({ purpose, id });
    return { ok: true, payload: stored.payload };
  }

  if (tries >= MAX_TRIES) {
    await clearOtp({ purpose, id });
    return { ok: false, reason: 'locked' };
  }

  return { ok: false, reason: 'wrong' };
};

module.exports = { issueOtp, checkOtp, clearOtp, OTP_MESSAGES };
