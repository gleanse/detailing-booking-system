// T3 and T4 webhook safety test
// T3 the same paid notice repeated many times confirms once and sends one email
// T4 a paid notice always confirms the booking, even an expired one, and a wrong token is refused
// runs the real webhook handler against a local database, email and redis are replaced by stubs
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

process.env.XENDIT_WEBHOOK_TOKEN = 'token-for-the-test-script';

const stub = (modulePath, exports) => {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

const email = { calls: 0, shouldThrow: false };
stub('../src/shared/utils/email', {
  sendBookingConfirmationEmail: async () => {
    email.calls++;
    if (email.shouldThrow) throw new Error('email service is down');
  },
});
stub('../src/config/redis', {
  get: async () => null,
  ttl: async () => 0,
  incr: async () => 1,
  expire: async () => 1,
  set: async () => 'OK',
  del: async () => 1,
});

const pool = require('../src/config/database');
const { lockSlot, createPayment } = require('../src/features/bookings/queries');
const { handleWebhook } = require('../src/features/bookings/controller');

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
  res.sendStatus = (code) => {
    res.code = code;
    return res;
  };
  return res;
};

const send = (paymentId, token = process.env.XENDIT_WEBHOOK_TOKEN) => {
  const res = fakeRes();
  const req = {
    headers: { 'x-callback-token': token },
    body: { external_id: paymentId, status: 'PAID', id: 'inv_test' },
  };
  return handleWebhook(req, res).then(() => res);
};

async function newPaidAttempt(serviceId, availabilityId) {
  const booking = await lockSlot({
    availabilityId,
    serviceId,
    variantId: null,
    userId: null,
    ipAddress: '10.9.9.9',
  });
  const payment = await createPayment({
    bookingId: booking.id,
    amount: 100,
    amountPaid: 100,
  });
  return { bookingId: booking.id, paymentId: payment.id };
}

const booking = async (id) =>
  (
    await pool.query(
      `SELECT booking_status, reference_code, queue_number FROM bookings WHERE id = $1`,
      [id],
    )
  ).rows[0];

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('webhook test', 1, 1) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 20, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;

  // T3 the same notice 5 times in a row
  let a = await newPaidAttempt(serviceId, availabilityId);
  email.calls = 0;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await send(a.paymentId)).code);
  let b = await booking(a.bookingId);
  check(
    'T3 five repeats in a row all answer 200',
    codes.every((c) => c === 200),
  );
  check(
    'T3 booking is confirmed with a queue number',
    b.booking_status === 'confirmed' && b.queue_number === 1,
    `queue ${b.queue_number}`,
  );
  check(
    'T3 only one email was sent',
    email.calls === 1,
    `${email.calls} emails`,
  );

  // T3 the same notice 5 times at the same moment
  a = await newPaidAttempt(serviceId, availabilityId);
  email.calls = 0;
  const parallel = await Promise.all(
    Array.from({ length: 5 }, () => send(a.paymentId)),
  );
  b = await booking(a.bookingId);
  check(
    'T3 five simultaneous repeats all answer 200',
    parallel.every((r) => r.code === 200),
  );
  check(
    'T3 simultaneous repeats send one email',
    email.calls === 1,
    `${email.calls} emails`,
  );

  // T3 a failing email must not fail the notice
  a = await newPaidAttempt(serviceId, availabilityId);
  email.shouldThrow = true;
  const failed = await send(a.paymentId);
  email.shouldThrow = false;
  b = await booking(a.bookingId);
  check(
    'T3 a failing email still answers 200 and confirms',
    failed.code === 200 && b.booking_status === 'confirmed',
    `answered ${failed.code}`,
  );

  // T4 a paid notice confirms an expired booking
  a = await newPaidAttempt(serviceId, availabilityId);
  await pool.query(
    `UPDATE bookings SET booking_status = 'expired' WHERE id = $1`,
    [a.bookingId],
  );
  email.calls = 0;
  const late = await send(a.paymentId);
  b = await booking(a.bookingId);
  check(
    'T4 a paid customer on an expired booking is confirmed',
    late.code === 200 && b.booking_status === 'confirmed',
    `status ${b.booking_status}`,
  );
  check(
    'T4 and receives the confirmation email',
    email.calls === 1,
    `${email.calls} emails`,
  );

  // T4 a wrong token is refused and changes nothing
  a = await newPaidAttempt(serviceId, availabilityId);
  const refused = await send(a.paymentId, 'wrong');
  b = await booking(a.bookingId);
  check(
    'T4 a wrong token is refused with 401 and nothing changes',
    refused.code === 401 && b.booking_status === 'locked',
    `answered ${refused.code}`,
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
  console.log(all ? 'RESULT: PASS' : 'RESULT: FAIL');
  await pool.end();
  process.exit(all ? 0 : 1);
})();
