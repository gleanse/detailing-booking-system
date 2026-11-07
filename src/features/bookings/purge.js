const pool = require('../../config/database');

const PURGE_AFTER_DAYS = 30;

const OLD_EXPIRED = `
  b.booking_status = 'expired'
  AND b.expires_at < NOW() - make_interval(days => $1)
`;

const HAS_SETTLED_PAYMENT = `
  EXISTS (
    SELECT 1 FROM payments p
    WHERE p.booking_id = b.id AND p.status <> 'unpaid'
  )
`;

// removes old expired bookings together with their unpaid leftovers in one transaction
// a booking with a paid, failed or refunded payment is kept because it is a record of money
const purgeExpiredBookings = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const old = await client.query(
      `SELECT b.id FROM bookings b
       WHERE ${OLD_EXPIRED} AND NOT ${HAS_SETTLED_PAYMENT}
       FOR UPDATE OF b`,
      [PURGE_AFTER_DAYS],
    );
    const ids = old.rows.map((row) => row.id);

    if (ids.length > 0) {
      await client.query('DELETE FROM payments WHERE booking_id = ANY($1)', [
        ids,
      ]);
      await client.query(
        'DELETE FROM notifications WHERE booking_id = ANY($1)',
        [ids],
      );
      await client.query(
        'DELETE FROM booking_status_logs WHERE booking_id = ANY($1)',
        [ids],
      );
      await client.query('DELETE FROM bookings WHERE id = ANY($1)', [ids]);
    }

    const kept = await client.query(
      `SELECT COUNT(*)::int AS count FROM bookings b
       WHERE ${OLD_EXPIRED} AND ${HAS_SETTLED_PAYMENT}`,
      [PURGE_AFTER_DAYS],
    );

    await client.query('COMMIT');
    return { purged: ids.length, kept: kept.rows[0].count };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { purgeExpiredBookings, PURGE_AFTER_DAYS };
