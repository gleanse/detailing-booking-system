// T9 cancelling a held booking settles its invoices with xendit first, it never releases a slot that may still be paid
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

const email = { sentFor: [] };
stub('../src/shared/utils/email', {
  sendBookingConfirmationEmail: async (details) => {
    email.sentFor.push(details.id);
  },
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

// a payment id with no answer set behaves like an unreachable xendit
const xendit = { invoices: {}, expireCalls: [], expireBehavior: {} };
const findInvoice = (id) =>
  Object.values(xendit.invoices)
    .flat()
    .find((invoice) => invoice.id === id);
stub('../src/config/xendit', {
  xenditClient: {},
  xenditInvoiceClient: {
    getInvoices: async ({ externalId }) => {
      const list = xendit.invoices[externalId];
      if (list === undefined || list === 'throw') {
        throw new Error('xendit is not answering');
      }
      return list.map((invoice) => ({ ...invoice }));
    },
    expireInvoice: async ({ invoiceId }) => {
      xendit.expireCalls.push(invoiceId);
      const behavior = xendit.expireBehavior[invoiceId] || 'ok';
      const invoice = findInvoice(invoiceId);
      if (behavior === 'throw') throw new Error('expire failed');
      if (behavior === 'paid') {
        invoice.status = 'PAID';
        throw new Error('invoice is already paid');
      }
      invoice.status = 'EXPIRED';
      return { ...invoice };
    },
  },
});

const pool = require('../src/config/database');
const { lockSlot, createPayment } = require('../src/features/bookings/queries');
const { releaseBookingSlot } = require('../src/features/bookings/controller');
const { signBookingToken } = require('../src/features/bookings/booking-token');

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
  return releaseBookingSlot(
    { body: { bookingId, bookingToken: signBookingToken(bookingId) } },
    res,
  ).then(() => res);
};

let ipCounter = 0;

async function newBooking(serviceId, availabilityId, paymentCount) {
  const ip = `10.99.0.${++ipCounter}`;
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

  return { bookingId: booking.id, paymentIds, ip };
}

const status = async (id) =>
  (await pool.query(`SELECT booking_status FROM bookings WHERE id = $1`, [id]))
    .rows[0].booking_status;

const strikes = (ip) =>
  redis.incrKeys.filter((key) => key === `abuse:ip:${ip}`).length;
const emails = (bookingId) =>
  email.sentFor.filter((id) => id === bookingId).length;
const expired = (invoiceId) => xendit.expireCalls.includes(invoiceId);

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('cancel test', 1, 1) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 40, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;

  let t;
  let res;
  let s;

  // a pending invoice is expired at xendit and the booking is released
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_a', status: 'PENDING' }];
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check('T9 a PENDING invoice is expired at xendit', expired('inv_a'));
  check(
    'T9 and the booking is released',
    res.code === 200 && s === 'expired',
    `answered ${res.code}, status ${s}`,
  );
  check(
    'T9 and counts one strike',
    strikes(t.ip) === 1 && res.body.abuseCount === 1,
    `${strikes(t.ip)} strikes`,
  );

  // a paid invoice confirms the booking instead of cancelling it
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_b', status: 'PAID' }];
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 a PAID invoice answers confirmed with the payment id',
    res.code === 200 &&
      res.body.confirmed === true &&
      res.body.paymentId === t.paymentIds[0],
    `answered ${res.code}`,
  );
  check('T9 and the booking is confirmed', s === 'confirmed', `status ${s}`);
  check(
    'T9 and one email is sent',
    emails(t.bookingId) === 1,
    `${emails(t.bookingId)} emails`,
  );
  check(
    'T9 and no strike is added and nothing is expired',
    strikes(t.ip) === 0 && !expired('inv_b'),
    `${strikes(t.ip)} strikes`,
  );

  // an expired invoice needs no call to xendit
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_c', status: 'EXPIRED' }];
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 an EXPIRED invoice releases the booking with one strike',
    res.code === 200 && s === 'expired' && strikes(t.ip) === 1,
    `status ${s}, ${strikes(t.ip)} strikes`,
  );
  check('T9 and xendit is not asked to expire it', !expired('inv_c'));

  // no invoice at all releases the booking
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [];
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 a payment with no invoice releases the booking',
    res.code === 200 && s === 'expired',
    `status ${s}`,
  );

  // an unreachable xendit refuses the cancel
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = 'throw';
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 an unreachable xendit answers 409 paymentStarted',
    res.code === 409 && res.body.paymentStarted === true,
    `answered ${res.code}`,
  );
  check(
    'T9 and the booking stays locked with no strike',
    s === 'locked' && strikes(t.ip) === 0,
    `status ${s}, ${strikes(t.ip)} strikes`,
  );

  // an invoice that cannot be expired and is still pending refuses the cancel
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_f', status: 'PENDING' }];
  xendit.expireBehavior.inv_f = 'throw';
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 a failing expire on a PENDING invoice answers 409',
    res.code === 409 && expired('inv_f'),
    `answered ${res.code}`,
  );
  check(
    'T9 and the booking stays locked with no strike',
    s === 'locked' && strikes(t.ip) === 0,
    `status ${s}, ${strikes(t.ip)} strikes`,
  );

  // an invoice paid at the moment of the cancel confirms the booking
  t = await newBooking(serviceId, availabilityId, 1);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_g', status: 'PENDING' }];
  xendit.expireBehavior.inv_g = 'paid';
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 an invoice paid during the cancel answers confirmed',
    res.code === 200 && res.body.confirmed === true,
    `answered ${res.code}`,
  );
  check(
    'T9 and the booking is confirmed with one email',
    s === 'confirmed' && emails(t.bookingId) === 1,
    `status ${s}, ${emails(t.bookingId)} emails`,
  );

  // two payments, one pending and one expired
  t = await newBooking(serviceId, availabilityId, 2);
  xendit.invoices[t.paymentIds[0]] = [{ id: 'inv_h1', status: 'PENDING' }];
  xendit.invoices[t.paymentIds[1]] = [{ id: 'inv_h2', status: 'EXPIRED' }];
  res = await release(t.bookingId);
  s = await status(t.bookingId);
  check(
    'T9 only the pending invoice is expired',
    expired('inv_h1') && !expired('inv_h2'),
  );
  check(
    'T9 and the booking is released',
    res.code === 200 && s === 'expired',
    `status ${s}`,
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
