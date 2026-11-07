const cron = require('node-cron');
const pool = require('../../config/database');
const redis = require('../../config/redis');
const { reconcileHeldBookings } = require('../../features/bookings/reconcile');
const { releaseAbandonedBookings } = require('../../features/bookings/leaving');
const { purgeExpiredBookings } = require('../../features/bookings/purge');

const ABUSE_WINDOW_SECONDS = 60 * 60; // 1 hour window for counting abandons
const ABUSE_BLOCK_SECONDS = 60 * 60 * 2; // 2 hour block
const ABUSE_LIMIT = 3;

const incrementAbuseCounter = async (ip, userId) => {
  try {
    if (ip) {
      const ipKey = `abuse:ip:${ip}`;
      const ipCount = await redis.incr(ipKey);
      if (ipCount === 1) await redis.expire(ipKey, ABUSE_WINDOW_SECONDS);
      if (ipCount >= ABUSE_LIMIT) {
        await redis.set(`block:ip:${ip}`, '1', 'EX', ABUSE_BLOCK_SECONDS);
      }
    }

    if (userId) {
      const userKey = `abuse:user:${userId}`;
      const userCount = await redis.incr(userKey);
      if (userCount === 1) await redis.expire(userKey, ABUSE_WINDOW_SECONDS);
      if (userCount >= ABUSE_LIMIT) {
        await redis.set(`block:user:${userId}`, '1', 'EX', ABUSE_BLOCK_SECONDS);
      }
    }
  } catch (error) {
    console.error('[CRON] Redis increment error:', error.message);
  }
};

const expireLockedBookings = async () => {
  const result = await pool.query(
    `UPDATE bookings
     SET booking_status = 'expired'
     WHERE booking_status = 'locked'
     AND expires_at < NOW()
     AND NOT EXISTS (
       SELECT 1 FROM payments WHERE payments.booking_id = bookings.id
     )
     RETURNING id, ip_address, user_id`,
  );

  for (const booking of result.rows) {
    await incrementAbuseCounter(booking.ip_address, booking.user_id);
  }

  return result.rows.length;
};

const reconcileBookings = () =>
  reconcileHeldBookings({ onExpired: incrementAbuseCounter });

// a run that is still going makes the next tick skip instead of overlapping
const runOnce = (name, job) => {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (error) {
      console.error(`[CRON] ${name} error:`, error.message);
    } finally {
      running = false;
    }
  };
};

const startCronJobs = () => {
  // runs every minute expires locked bookings that have no payment started
  cron.schedule(
    '* * * * *',
    runOnce('Expiry', async () => {
      const count = await expireLockedBookings();
      if (count > 0) console.log(`[CRON] Expired ${count} locked booking(s)`);
    }),
  );

  // runs every minute asks xendit about held bookings that have a payment started
  cron.schedule(
    '* * * * *',
    runOnce('Reconcile', async () => {
      const summary = await reconcileBookings();
      if (summary.confirmed || summary.expired || summary.failed) {
        console.log('[CRON] Reconciled held bookings', summary);
      }
    }),
  );

  // runs every minute frees holds whose page closed and never came back
  cron.schedule(
    '* * * * *',
    runOnce('Abandoned', async () => {
      const count = await releaseAbandonedBookings({
        onReleased: incrementAbuseCounter,
      });
      if (count > 0)
        console.log(`[CRON] Released ${count} abandoned booking(s)`);
    }),
  );

  // runs every SUNDAY midnight purges expired bookings older than 30 days
  cron.schedule('0 0 * * 0', async () => {
    try {
      const { purged, kept } = await purgeExpiredBookings();

      if (purged > 0 || kept > 0) {
        console.log(
          `[CRON] Purged ${purged} expired booking(s), kept ${kept} that hold a payment record`,
        );
      }
    } catch (error) {
      console.error('[CRON] Error purging bookings:', error.message);
    }
  });

  console.log('[CRON] Jobs started');
};

module.exports = {
  startCronJobs,
  incrementAbuseCounter,
  expireLockedBookings,
  reconcileBookings,
};
