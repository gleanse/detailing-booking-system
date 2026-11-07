const crypto = require('crypto');

// the key comes from the session secret, locally it falls back like app.js does
const getSecret = () => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  return 'herco-secret-key-change-this';
};

// proves the caller is the one who made the hold, only the server can produce it
const signBookingToken = (bookingId) => {
  const key = crypto
    .createHmac('sha256', getSecret())
    .update('booking-token-v1')
    .digest();
  return crypto
    .createHmac('sha256', key)
    .update(String(bookingId))
    .digest('hex');
};

const hasValidBookingToken = (bookingId, token) => {
  if (!bookingId || typeof token !== 'string') return false;
  const expected = Buffer.from(signBookingToken(bookingId));
  const given = Buffer.from(token);
  return (
    given.length === expected.length && crypto.timingSafeEqual(given, expected)
  );
};

module.exports = { signBookingToken, hasValidBookingToken };
