// T14 the weekly purge
// the database refuses a plain delete of a booking that has a payment
// old expired bookings are purged together with their unpaid leftovers
// a booking with a paid payment, a recent expired booking and a locked booking are kept
// a failure halfway rolls everything back
// runs the real purge against a local database, note it also purges any other expired booking older than 30 days there
require('dotenv').config();

const host = process.env.DB_HOST || '';
const isLocal =
  ['localhost', '127.0.0.1'].includes(host) || host.startsWith('/');
if (!isLocal || process.env.DATABASE_URL) {
  console.error(
    'refusing to run, DB_HOST must be local and DATABASE_URL must be empty',
  );
  process.exit(1);
}

const stub = (modulePath, exports) => {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

stub('../src/shared/utils/email', {
  sendBookingConfirmationEmail: async () => {},
});
stub('../src/config/xendit', { xenditClient: {}, xenditInvoiceClient: {} });
stub('../src/config/redis', {
  get: async () => null,
  ttl: async () => 0,
  incr: async () => 1,
  expire: async () => 1,
  set: async () => 'OK',
  del: async () => 1,
});

const pool = require('../src/config/database');
const { lockSlot } = require('../src/features/bookings/queries');
const { purgeExpiredBookings } = require('../src/features/bookings/purge');

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

const count = async (table, column, id) =>
  (
    await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = $1`,
      [id],
    )
  ).rows[0].count;

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('purge test', 100, 50) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 20, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;
  const created = [];

  const makeBooking = async (ip, status, daysAgo) => {
    const booking = await lockSlot({
      availabilityId,
      serviceId,
      variantId: null,
      userId: null,
      ipAddress: ip,
    });
    await pool.query(
      `UPDATE bookings SET booking_status = $2, expires_at = NOW() - make_interval(days => $3) WHERE id = $1`,
      [booking.id, status, daysAgo],
    );
    created.push(booking.id);
    return booking.id;
  };

  const addLeftovers = async (bookingId, paymentStatus) => {
    await pool.query(
      `INSERT INTO payments (booking_id, amount, amount_paid, status) VALUES ($1, 100, 50, $2)`,
      [bookingId, paymentStatus],
    );
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, status) VALUES ($1, 'expired')`,
      [bookingId],
    );
    await pool.query(
      `INSERT INTO notifications (booking_id, email, type) VALUES ($1, 'test@example.com', 'expired')`,
      [bookingId],
    );
  };

  const plain = await makeBooking('10.9.9.1', 'expired', 31);
  const unpaid = await makeBooking('10.9.9.2', 'expired', 31);
  await addLeftovers(unpaid, 'unpaid');
  const paid = await makeBooking('10.9.9.3', 'expired', 31);
  await addLeftovers(paid, 'paid');
  const recent = await makeBooking('10.9.9.4', 'expired', 5);
  const locked = await makeBooking('10.9.9.5', 'locked', -1);

  // the failure the purge has to avoid
  const client = await pool.connect();
  let refused = false;
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM bookings WHERE id = $1', [unpaid]);
  } catch (error) {
    refused = error.code === '23503';
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  check(
    'T14 a plain delete of a booking with payment rows is refused by the database',
    refused,
  );

  const first = await purgeExpiredBookings();

  // what is purged
  check(
    'T14 an old expired booking with no payment is purged',
    (await count('bookings', 'id', plain)) === 0,
  );
  check(
    'T14 an old expired booking with unpaid leftovers is purged with them',
    (await count('bookings', 'id', unpaid)) === 0 &&
      (await count('payments', 'booking_id', unpaid)) === 0 &&
      (await count('notifications', 'booking_id', unpaid)) === 0 &&
      (await count('booking_status_logs', 'booking_id', unpaid)) === 0,
  );

  // what is kept
  check(
    'T14 a booking with a paid payment is kept with its payment',
    (await count('bookings', 'id', paid)) === 1 &&
      (await count('payments', 'booking_id', paid)) === 1,
  );
  check(
    'T14 a recent expired booking and a locked booking are kept',
    (await count('bookings', 'id', recent)) === 1 &&
      (await count('bookings', 'id', locked)) === 1,
  );
  check(
    'T14 the result counts what was purged and what was kept',
    first.purged >= 2 && first.kept >= 1,
    `purged ${first.purged}, kept ${first.kept}`,
  );

  // a failure halfway rolls everything back
  const doomed = await makeBooking('10.9.9.6', 'expired', 31);
  await addLeftovers(doomed, 'unpaid');
  await pool.query(`
    CREATE OR REPLACE FUNCTION test_block_log_delete() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'blocked for the test'; END $$ LANGUAGE plpgsql
  `);
  await pool.query(`
    CREATE TRIGGER test_block_log_delete BEFORE DELETE ON booking_status_logs
    FOR EACH ROW EXECUTE FUNCTION test_block_log_delete()
  `);
  let failed = false;
  try {
    await purgeExpiredBookings();
  } catch {
    failed = true;
  }
  await pool.query(
    `DROP TRIGGER IF EXISTS test_block_log_delete ON booking_status_logs`,
  );
  await pool.query(`DROP FUNCTION IF EXISTS test_block_log_delete()`);
  check(
    'T14 a failure halfway throws and leaves the booking and its payment in place',
    failed &&
      (await count('bookings', 'id', doomed)) === 1 &&
      (await count('payments', 'booking_id', doomed)) === 1,
  );

  await pool.query(`DELETE FROM payments WHERE booking_id = ANY($1)`, [
    created,
  ]);
  await pool.query(`DELETE FROM notifications WHERE booking_id = ANY($1)`, [
    created,
  ]);
  await pool.query(
    `DELETE FROM booking_status_logs WHERE booking_id = ANY($1)`,
    [created],
  );
  await pool.query(`DELETE FROM bookings WHERE id = ANY($1)`, [created]);
  await pool.query(`DELETE FROM availability WHERE id = $1`, [availabilityId]);
  await pool.query(`DELETE FROM services WHERE id = $1`, [serviceId]);

  const all = results.every(Boolean);
  console.log(all ? 'RESULT: PASS' : 'RESULT: FAIL');
  await pool.end();
  process.exit(all ? 0 : 1);
})();
