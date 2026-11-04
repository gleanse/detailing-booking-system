// T5 and T7 reconcile test
// T5 a booking with a started payment is freed only on xendit's word, never on the clock alone
// T7 a paid customer is confirmed with one email, an unreachable xendit never frees anything
// runs the real cron expiry and reconcile job against a local database, email redis and xendit are replaced by stubs
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

const email = { sentFor: [] };
stub('../src/shared/utils/email', {
  sendBookingConfirmationEmail: async (details) => {
    email.sentFor.push(details.id);
  },
});

// every strike goes through incr, so counting incr calls per ip counts strikes
const redis = { incrKeys: [] };
stub('../src/config/redis', {
  get: async () => null,
  ttl: async () => 0,
  incr: async (key) => {
    redis.incrKeys.push(key);
    return 1;
  },
  expire: async () => 1,
  set: async () => 'OK',
  del: async () => 1,
});

// a payment id with no answer set behaves like an unreachable xendit, so stray bookings in the local database are never changed
const xendit = { looked: [], answers: {} };
stub('../src/config/xendit', {
  xenditClient: {},
  xenditInvoiceClient: {
    getInvoices: async ({ externalId }) => {
      xendit.looked.push(externalId);
      const answer = xendit.answers[externalId];
      if (answer === undefined || answer === 'throw') {
        throw new Error('xendit is not answering');
      }
      return answer;
    },
  },
});

const pool = require('../src/config/database');
const { lockSlot, createPayment } = require('../src/features/bookings/queries');
const { confirmPaidBooking } = require('../src/features/bookings/confirm');
const {
  expireLockedBookings,
  reconcileBookings,
} = require('../src/shared/utils/cron');

let ipCounter = 0;

async function newBooking(serviceId, availabilityId, paymentCount, pastHold) {
  const ip = `10.77.0.${++ipCounter}`;
  const booking = await lockSlot({
    availabilityId,
    serviceId,
    variantId: null,
    userId: null,
    ipAddress: ip,
  });

  const paymentIds = [];
  for (let i = 0; i < paymentCount; i++) {
    const payment = await createPayment({
      bookingId: booking.id,
      amount: 100,
      amountPaid: 100,
    });
    paymentIds.push(payment.id);
  }

  if (pastHold) {
    await pool.query(
      `UPDATE bookings SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [booking.id],
    );
  }

  return { bookingId: booking.id, paymentIds, ip };
}

const state = async (id) =>
  (
    await pool.query(
      `SELECT booking_status, queue_number FROM bookings WHERE id = $1`,
      [id],
    )
  ).rows[0];

const emails = (bookingId) =>
  email.sentFor.filter((id) => id === bookingId).length;
const strikes = (ip) =>
  redis.incrKeys.filter((key) => key === `abuse:ip:${ip}`).length;
const lookups = (paymentIds) =>
  xendit.looked.filter((id) => paymentIds.includes(id)).length;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('reconcile test', 1, 1) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 40, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;

  let t;
  let s;

  // a paid payment confirms the booking
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_paid', status: 'PAID' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T7 a PAID payment confirms the booking',
    s.booking_status === 'confirmed' && s.queue_number !== null,
    `status ${s.booking_status}`,
  );
  check(
    'T7 and sends one email',
    emails(t.bookingId) === 1,
    `${emails(t.bookingId)} emails`,
  );
  check('T7 and adds no strike', strikes(t.ip) === 0);

  await reconcileBookings();
  check(
    'T7 running again sends no second email',
    emails(t.bookingId) === 1,
    `${emails(t.bookingId)} emails`,
  );

  // settled counts as paid
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_settled', status: 'SETTLED' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T7 a SETTLED payment confirms the booking',
    s.booking_status === 'confirmed',
    `status ${s.booking_status}`,
  );

  // an expired invoice frees the booking and counts as abandonment
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_exp', status: 'EXPIRED' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 an EXPIRED invoice frees the booking',
    s.booking_status === 'expired',
    `status ${s.booking_status}`,
  );
  check(
    'T5 and adds one strike',
    strikes(t.ip) === 1,
    `${strikes(t.ip)} strikes`,
  );

  // no invoice at all frees the booking without a strike
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = [];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 an empty invoice list frees the booking',
    s.booking_status === 'expired',
    `status ${s.booking_status}`,
  );
  check(
    'T5 and adds no strike',
    strikes(t.ip) === 0,
    `${strikes(t.ip)} strikes`,
  );

  // two expired payments and one paid confirms
  t = await newBooking(serviceId, availabilityId, 3, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_a', status: 'EXPIRED' }];
  xendit.answers[t.paymentIds[1]] = [{ id: 'inv_b', status: 'EXPIRED' }];
  xendit.answers[t.paymentIds[2]] = [{ id: 'inv_c', status: 'PAID' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T7 two EXPIRED payments and one PAID confirms the booking',
    s.booking_status === 'confirmed',
    `status ${s.booking_status}`,
  );

  // pending stays locked
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_pend', status: 'PENDING' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 a PENDING invoice stays locked',
    s.booking_status === 'locked' && strikes(t.ip) === 0,
    `status ${s.booking_status}`,
  );

  // a failing lookup never frees the booking
  t = await newBooking(serviceId, availabilityId, 1, true);
  xendit.answers[t.paymentIds[0]] = 'throw';
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 a failing lookup stays locked',
    s.booking_status === 'locked',
    `status ${s.booking_status}`,
  );
  for (let i = 0; i < 3; i++) await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 and stays locked across three more runs, asked every run',
    s.booking_status === 'locked' && lookups(t.paymentIds) === 4,
    `status ${s.booking_status}, ${lookups(t.paymentIds)} lookups`,
  );
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_late', status: 'EXPIRED' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 and is freed only after xendit answers expired',
    s.booking_status === 'expired',
    `status ${s.booking_status}`,
  );

  // one expired and one pending stays locked
  t = await newBooking(serviceId, availabilityId, 2, true);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_x', status: 'EXPIRED' }];
  xendit.answers[t.paymentIds[1]] = [{ id: 'inv_y', status: 'PENDING' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 EXPIRED plus PENDING stays locked',
    s.booking_status === 'locked',
    `status ${s.booking_status}`,
  );

  // a booking still inside its hold is never looked up
  t = await newBooking(serviceId, availabilityId, 1, false);
  xendit.answers[t.paymentIds[0]] = [{ id: 'inv_in', status: 'EXPIRED' }];
  await reconcileBookings();
  s = await state(t.bookingId);
  check(
    'T5 a booking still inside its hold is never looked up',
    s.booking_status === 'locked' && lookups(t.paymentIds) === 0,
    `status ${s.booking_status}, ${lookups(t.paymentIds)} lookups`,
  );

  // the plain expiry still handles a booking with no payment
  t = await newBooking(serviceId, availabilityId, 0, true);
  await expireLockedBookings();
  s = await state(t.bookingId);
  check(
    'T5 the cron expiry still expires a booking with no payment',
    s.booking_status === 'expired',
    `status ${s.booking_status}`,
  );
  check(
    'T5 and adds one strike',
    strikes(t.ip) === 1,
    `${strikes(t.ip)} strikes`,
  );

  // and leaves a booking with a started payment alone
  t = await newBooking(serviceId, availabilityId, 1, true);
  await expireLockedBookings();
  s = await state(t.bookingId);
  check(
    'T5 the cron expiry leaves a booking with a started payment alone',
    s.booking_status === 'locked' && strikes(t.ip) === 0,
    `status ${s.booking_status}`,
  );

  // a repeated paid notice cannot bring a cancelled booking back
  t = await newBooking(serviceId, availabilityId, 1, false);
  await pool.query(
    `UPDATE bookings SET booking_status = 'cancelled' WHERE id = $1`,
    [t.bookingId],
  );
  const again = await confirmPaidBooking({
    bookingId: t.bookingId,
    paymentId: t.paymentIds[0],
    xenditInvoiceId: 'inv_repeat',
  });
  s = await state(t.bookingId);
  check(
    'T7 a paid notice cannot bring a cancelled booking back',
    again === false &&
      s.booking_status === 'cancelled' &&
      emails(t.bookingId) === 0,
    `status ${s.booking_status}`,
  );

  await pool.query(
    `DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE availability_id = $1)`,
    [availabilityId],
  );
  await pool.query(
    `DELETE FROM booking_status_logs WHERE booking_id IN (SELECT id FROM bookings WHERE availability_id = $1)`,
    [availabilityId],
  );
  await pool.query(`DELETE FROM bookings WHERE availability_id = $1`, [
    availabilityId,
  ]);
  await pool.query(`DELETE FROM availability WHERE id = $1`, [availabilityId]);
  await pool.query(`DELETE FROM services WHERE id = $1`, [serviceId]);

  const all = results.every(Boolean);
  console.log(`${results.filter(Boolean).length} of ${results.length} checks`);
  console.log(all ? 'RESULT: PASS' : 'RESULT: FAIL');
  await pool.end();
  process.exit(all ? 0 : 1);
})();
