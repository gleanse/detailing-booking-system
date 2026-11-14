const redis = require('../../config/redis');
const { releaseSlot } = require('./queries');

// bookings whose page closed, scored by the moment the page reported leaving
const LEAVING_KEY = 'leaving';
const GRACE_SECONDS = 60;

// the newest page load that reported back, kept per booking
const STAY_TTL_SECONDS = 20 * 60;
const stayKey = (bookingId) => `staying:${bookingId}`;

const toVisit = (visit) => {
  const number = Number(visit);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const latestStay = async (bookingId) =>
  Number(await redis.get(stayKey(bookingId))) || 0;

// a leaving report from a page older than the newest page that came back is stale, so it is ignored
// a page without a visit number is treated as the newest, like before
const markLeaving = async (bookingId, visit) => {
  const at = toVisit(visit) ?? Date.now();
  if (at < (await latestStay(bookingId))) return;

  await redis.zadd(LEAVING_KEY, Date.now(), bookingId);

  // a newer page may have reported back while this ran
  if (at < (await latestStay(bookingId))) {
    await redis.zrem(LEAVING_KEY, bookingId);
  }
};

const clearLeaving = async (bookingId, visit) => {
  const at = toVisit(visit);
  if (at && at > (await latestStay(bookingId))) {
    await redis.set(stayKey(bookingId), at, 'EX', STAY_TTL_SECONDS);
  }
  await redis.zrem(LEAVING_KEY, bookingId);
};

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
