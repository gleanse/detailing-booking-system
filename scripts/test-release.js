// T8 release guard test
// T8 a booking with a started payment cannot be released, a booking without one still can
// runs the real release handler against a local database, email redis and xendit are replaced by stubs
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

// every strike goes through incr, so counting incr calls per ip counts strikes
const redis = { incrKeys: [] };
stub('../src/config/redis', {
  get: async (key) => String(redis.incrKeys.filter((k) => k === key).length),
  ttl: async () => 0,
  incr: async (key) => {
    redis.incrKeys.push(key);
    return 1;
  },
  expire: async () => 1,
  set: async () => 'OK',
  del: async () => 1,
});

stub('../src/config/xendit', {
  xenditClient: {},
  xenditInvoiceClient: {},
});

const pool = require('../src/config/database');
const { lockSlot, createPayment } = require('../src/features/bookings/queries');
const { releaseBookingSlot } = require('../src/features/bookings/controller');

const fakeRes = () => {
  const res = { code: 200, body: null };
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const release = (bookingId) => {
  const res = fakeRes();
  return releaseBookingSlot({ body: { bookingId } }, res).then(() => res);
};

let ipCounter = 0;

async function newBooking(serviceId, availabilityId, withPayment) {
  const ip = `10.88.0.${++ipCounter}`;
  const booking = await lockSlot({
    availabilityId,
    serviceId,
    variantId: null,
    userId: null,
    ipAddress: ip,
  });

  if (withPayment) {
    await createPayment({
      bookingId: booking.id,
      amount: 100,
      amountPaid: 100,
    });
  }

  return { bookingId: booking.id, ip };
}

const status = async (id) =>
  (await pool.query(`SELECT booking_status FROM bookings WHERE id = $1`, [id]))
    .rows[0].booking_status;

const strikes = (ip) =>
  redis.incrKeys.filter((key) => key === `abuse:ip:${ip}`).length;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('release test', 1, 1) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 10, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;

  // a booking with a started payment cannot be released
  let t = await newBooking(serviceId, availabilityId, true);
  let res = await release(t.bookingId);
  check(
    'T8 a booking with a started payment answers 409 paymentStarted',
    res.code === 409 && res.body.paymentStarted === true,
    `answered ${res.code}`,
  );
  check(
    'T8 and stays locked',
    (await status(t.bookingId)) === 'locked',
    `status ${await status(t.bookingId)}`,
  );
  check(
    'T8 and adds no strike',
    strikes(t.ip) === 0,
    `${strikes(t.ip)} strikes`,
  );

  // a booking without a payment is released as before
  t = await newBooking(serviceId, availabilityId, false);
  res = await release(t.bookingId);
  check(
    'T8 a booking without a payment is released',
    res.code === 200 && (await status(t.bookingId)) === 'expired',
    `answered ${res.code}, status ${await status(t.bookingId)}`,
  );
  check(
    'T8 and adds one strike, reported as abuseCount 1',
    strikes(t.ip) === 1 && res.body.abuseCount === 1,
    `${strikes(t.ip)} strikes, abuseCount ${res.body.abuseCount}`,
  );

  // releasing again changes nothing
  res = await release(t.bookingId);
  check(
    'T8 releasing again answers 404 and adds no second strike',
    res.code === 404 && strikes(t.ip) === 1,
    `answered ${res.code}, ${strikes(t.ip)} strikes`,
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
