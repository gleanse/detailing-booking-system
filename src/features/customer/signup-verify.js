const crypto = require('crypto');
const redis = require('../../config/redis');
const { sendEmailVerificationEmail } = require('../../shared/utils/email');

const CODE_TTL_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_TRIES = 5;

const codeKey = (email) => `signup_otp:${email}`;
const triesKey = (email) => `signup_tries:${email}`;
const cooldownKey = (email) => `signup_resend:${email}`;

const clearCode = async (email) => {
  await redis.del(codeKey(email));
  await redis.del(triesKey(email));
};

// sends a fresh code, a second request inside the cooldown is refused
const issueCode = async ({ email, name }) => {
  const claimed = await redis.set(
    cooldownKey(email),
    '1',
    'EX',
    RESEND_COOLDOWN_SECONDS,
    'NX',
  );

  if (!claimed) {
    const left = await redis.ttl(cooldownKey(email));
    return { sent: false, retryAfter: Math.max(left, 1) };
  }

  try {
    const otp = crypto.randomInt(100000, 1000000).toString();
    await redis.set(codeKey(email), otp, 'EX', CODE_TTL_SECONDS);
    await redis.del(triesKey(email));
    await sendEmailVerificationEmail({ email, name, otp });
  } catch (error) {
    // the customer never got a code, so they should not have to wait to ask again
    await redis.del(cooldownKey(email));
    throw error;
  }

  return { sent: true };
};

// every attempt counts, and the code dies after too many wrong ones
const checkCode = async ({ email, otp }) => {
  const stored = await redis.get(codeKey(email));
  if (!stored) return { ok: false, reason: 'expired' };

  const tries = await redis.incr(triesKey(email));
  if (tries === 1) await redis.expire(triesKey(email), CODE_TTL_SECONDS);

  if (tries > MAX_TRIES) {
    await clearCode(email);
    return { ok: false, reason: 'locked' };
  }

  if (stored === otp) {
    await clearCode(email);
    return { ok: true };
  }

  if (tries >= MAX_TRIES) {
    await clearCode(email);
    return { ok: false, reason: 'locked' };
  }

  return { ok: false, reason: 'wrong' };
};

module.exports = { issueCode, checkCode };
