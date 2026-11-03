// P21 pay reuse test
// T1 pressing pay twice gives the same checkout, one payment row and an unchanged hold
// T2 the first press saves the invoice and extends the hold
// T3 a press after the payment window is refused and creates nothing
// T4 a payment row with no invoice url never blocks a retry
// runs the real createInvoice handler against a local database, xendit email and redis are replaced by stubs
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

process.env.APP_URL = 'http://localhost';

const stub = (modulePath, exports) => {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

const xendit = { calls: 0 };
stub('../src/config/xendit', {
  xenditInvoiceClient: {
    createInvoice: async () => {
      xendit.calls++;
      return {
        id: `inv_test_${xendit.calls}`,
        invoiceUrl: `https://checkout.test/${xendit.calls}`,
      };
    },
  },
});
stub('../src/shared/utils/email', {
  sendBookingConfirmationEmail: async () => {},
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
const { createInvoice } = require('../src/features/bookings/controller');

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

const press = async (bookingId) => {
  const res = fakeRes();
  await createInvoice({ body: { bookingId } }, res);
  return res;
};

const newBooking = async (serviceId, availabilityId) =>
  lockSlot({
    availabilityId,
    serviceId,
    variantId: null,
    userId: null,
    ipAddress: '10.9.9.9',
  });

const holdOf = async (bookingId) =>
  (
    await pool.query(
      `SELECT expires_at::text AS hold FROM bookings WHERE id = $1`,
      [bookingId],
    )
  ).rows[0].hold;

const paymentsOf = async (bookingId) =>
  (
    await pool.query(
      `SELECT id, invoice_url, xendit_invoice_id FROM payments WHERE booking_id = $1 ORDER BY created_at`,
      [bookingId],
    )
  ).rows;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

(async () => {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('pay reuse test', 100, 50) RETURNING id`,
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, 20, true) RETURNING id`,
    [serviceId],
  );
  const availabilityId = slot.rows[0].id;

  // T1 and T2 first press then a second press
  const b1 = await newBooking(serviceId, availabilityId);
  const first = await press(b1.id);
  const holdAfterFirst = await holdOf(b1.id);
  const hold = await pool.query(
    `SELECT expires_at > NOW() + INTERVAL '15 minutes' AS extended FROM bookings WHERE id = $1`,
    [b1.id],
  );
  let rows = await paymentsOf(b1.id);
  check(
    'T2 first press answers 200 with a checkout link and the payment id',
    first.code === 200 &&
      first.body.invoiceUrl === 'https://checkout.test/1' &&
      first.body.paymentId === rows[0].id,
    `answered ${first.code}`,
  );
  check(
    'T2 first press saves the invoice url and invoice id',
    rows[0].invoice_url === 'https://checkout.test/1' &&
      rows[0].xendit_invoice_id === 'inv_test_1',
  );
  check('T2 first press extends the hold to 16 minutes', hold.rows[0].extended);

  const second = await press(b1.id);
  rows = await paymentsOf(b1.id);
  check(
    'T1 second press returns the same checkout link',
    second.code === 200 &&
      second.body.invoiceUrl === first.body.invoiceUrl &&
      second.body.paymentId === first.body.paymentId &&
      second.body.reused === true,
  );
  check(
    'T1 second press creates no invoice and no payment row',
    xendit.calls === 1 && rows.length === 1,
    `${xendit.calls} invoices, ${rows.length} payment rows`,
  );
  check(
    'T1 second press leaves the hold unchanged',
    (await holdOf(b1.id)) === holdAfterFirst,
  );

  // T3 a press after the payment window
  await pool.query(
    `UPDATE payments SET created_at = NOW() - INTERVAL '15 minutes' WHERE booking_id = $1`,
    [b1.id],
  );
  const late = await press(b1.id);
  rows = await paymentsOf(b1.id);
  check(
    'T3 a press after the window is refused with 409',
    late.code === 409 && late.body.success === false,
    `answered ${late.code}`,
  );
  check(
    'T3 a refused press creates nothing and leaves the hold unchanged',
    xendit.calls === 1 &&
      rows.length === 1 &&
      (await holdOf(b1.id)) === holdAfterFirst,
    `${xendit.calls} invoices, ${rows.length} payment rows`,
  );

  // T4 a payment row without an invoice url does not block a retry
  const b2 = await newBooking(serviceId, availabilityId);
  await createPayment({ bookingId: b2.id, amount: 100, amountPaid: 50 });
  const retry = await press(b2.id);
  rows = await paymentsOf(b2.id);
  check(
    'T4 a retry after a failed attempt creates a new invoice',
    retry.code === 200 &&
      retry.body.invoiceUrl === 'https://checkout.test/2' &&
      !retry.body.reused,
    `answered ${retry.code}`,
  );
  check(
    'T4 the retry saved its invoice url on the new payment row',
    rows.length === 2 &&
      rows.filter((r) => r.invoice_url === 'https://checkout.test/2').length ===
        1,
    `${rows.length} payment rows`,
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
