const redis = require('../../config/redis');
const { releaseSlot } = require('./queries');

// bookings whose page closed, scored by the moment the page reported leaving
const LEAVING_KEY = 'leaving';
const GRACE_SECONDS = 60;

const markLeaving = (bookingId) =>
  redis.zadd(LEAVING_KEY, Date.now(), bookingId);

const clearLeaving = (bookingId) => redis.zrem(LEAVING_KEY, bookingId);

// frees holds whose page stayed gone past the grace period, same strike as an expired hold
const releaseAbandonedBookings = async ({ onReleased }) => {
  const cutoff = Date.now() - GRACE_SECONDS * 1000;
  const ids = await redis.zrangebyscore(LEAVING_KEY, '-inf', cutoff);

  let released = 0;
  for (const id of ids) {
    // whoever removes the entry first owns it, so a customer coming back or a second run skips it
    if (!(await redis.zrem(LEAVING_KEY, id))) continue;

    // refuses when a payment row exists or the booking already left the locked state
    const booking = await releaseSlot(id);
    if (!booking) continue;

    released++;
    await onReleased(booking.ip_address, booking.user_id);
  }

  return released;
};

module.exports = {
  LEAVING_KEY,
  GRACE_SECONDS,
  markLeaving,
  clearLeaving,
  releaseAbandonedBookings,
};
