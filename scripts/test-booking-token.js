// T12 a hold can only be released, edited or paid by the person who made it
// runs the real handlers against a local database, email redis and xendit are replaced by stubs
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

const xendit = { createCalls: 0 };
stub('../src/config/xendit', {
  xenditClient: {},
  xenditInvoiceClient: {
    createInvoice: async () => {
      xendit.createCalls++;
      return { id: 'inv_t12', invoiceUrl: 'https://checkout.test/t12' };
    },
  },
});

const store = new Map();
const redis = {
  incrKeys: [],
  get: async (key) => (store.has(key) ? store.get(key).value : null),
  set: async (key, value) => {
    store.set(key, { value: String(value), ttl: -1 });
    return 'OK';
  },
  del: async (key) => (store.delete(key) ? 1 : 0),
  ttl: async (key) => (store.has(key) ? store.get(key).ttl : -2),
  incr: async (key) => {
    redis.incrKeys.push(key);
    const next = Number(store.has(key) ? store.get(key).value : 0) + 1;
    store.set(key, { value: String(next), ttl: -1 });
    return next;
  },
  expire: async () => 1,
};
stub('../src/config/redis', redis);

const pool = require('../src/config/database');
const {
  signBookingToken,
  hasValidBookingToken,
} = require('../src/features/bookings/booking-token');
const {
  lockBookingSlot,
  releaseBookingSlot,
  updateBooking,
  createInvoice,
} = require('../src/features/bookings/controller');

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

let service;
let slot;
let ipCounter = 0;

const hold = async () => {
  const res = fakeRes();
  await lockBookingSlot(
    {
      body: { availabilityId: slot, serviceId: service },
      ip: `10.12.0.${++ipCounter}`,
      session: {},
    },
    res,
  );
  return { id: res.body.data.id, token: res.body.bookingToken };
};

const release = (bookingId, bookingToken) => {
  const res = fakeRes();
  return releaseBookingSlot({ body: { bookingId, bookingToken } }, res).then(
    () => res,
  );
};

const details = {
  guestName: 'Test Twelve',
  guestEmail: 't12@example.test',
  guestPhone: '09171234567',
  motorcyclePlate: 'ABC 123',
  motorcycleModel: 'Test Model',
  motorcycleColor: 'Black',
  motorcycleDescription: '',
};

const edit = (bookingId, bookingToken) => {
  const res = fakeRes();
  return updateBooking(
    { params: { bookingId }, body: { ...details, bookingToken } },
    res,
  ).then(() => res);
};

const pay = (bookingId, bookingToken) => {
  const res = fakeRes();
  return createInvoice({ body: { bookingId, bookingToken } }, res).then(
    () => res,
  );
};

const row = async (id) =>
  (
    await pool.query(
      `SELECT booking_status, guest_name FROM bookings WHERE id = $1`,
      [id],
    )
  ).rows[0];

const paymentRows = async (id) =>
  (
    await pool.query(
      `SELECT COUNT(*)::int AS n FROM payments WHERE booking_id = $1`,
      [id],
    )
  ).rows[0].n;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

const cleanup = async () => {
  await pool.query(
    `DELETE FROM bookings WHERE service_id IN
       (SELECT id FROM services WHERE name = 'T12 token test')`,
  );
  await pool.query(
    `DELETE FROM availability WHERE service_id IN
       (SELECT id FROM services WHERE name = 'T12 token test')`,
  );
  await pool.query(`DELETE FROM services WHERE name = 'T12 token test'`);
};

(async () => {
  await cleanup();

  service = (
    await pool.query(
      `INSERT INTO services (name, price, down_payment_amount)
       VALUES ('T12 token test', 1000, 100) RETURNING id`,
    )
  ).rows[0].id;
  slot = (
    await pool.query(
      `INSERT INTO availability (service_id, date, capacity, is_open)
       VALUES ($1, CURRENT_DATE + 1, 50, true) RETURNING id`,
      [service],
    )
  ).rows[0].id;

  const a = await hold();
  const b = await hold();
  let r;

  check(
    'a new hold comes with a 64 character token',
    /^[0-9a-f]{64}$/.test(a.token || ''),
  );
  check('and each hold gets its own token', a.token !== b.token);

  // release
  r = await release(a.id);
  check('release without a token is refused with 403', r.code === 403);

  r = await release(a.id, 'not-a-real-token');
  check('release with a made up token is refused with 403', r.code === 403);

  r = await release(a.id, b.token);
  check(
    'release with the token of another hold is refused with 403',
    r.code === 403,
  );

  check(
    'and both holds stay locked with no strike added',
    (await row(a.id)).booking_status === 'locked' &&
      (await row(b.id)).booking_status === 'locked' &&
      redis.incrKeys.length === 0,
  );

  // details
  r = await edit(a.id);
  check('saving details without a token is refused with 403', r.code === 403);

  r = await edit(a.id, b.token);
  check(
    'saving details with the token of another hold is refused with 403',
    r.code === 403,
  );

  check('and no details were saved', (await row(a.id)).guest_name === null);

  r = await edit(a.id, a.token);
  check(
    'saving details with the right token works',
    r.code === 200 && (await row(a.id)).guest_name === 'Test Twelve',
    `answered ${r.code}`,
  );

  // pay
  r = await pay(a.id);
  check('starting payment without a token is refused with 403', r.code === 403);

  r = await pay(a.id, b.token);
  check(
    'starting payment with the token of another hold is refused with 403',
    r.code === 403,
  );

  check(
    'and no invoice or payment row was created',
    xendit.createCalls === 0 && (await paymentRows(a.id)) === 0,
  );

  // the right token still releases
  r = await release(a.id, a.token);
  check(
    'release with the right token works and adds one strike',
    r.code === 200 &&
      (await row(a.id)).booking_status === 'expired' &&
      redis.incrKeys.length === 1,
    `answered ${r.code}, ${redis.incrKeys.length} strikes`,
  );

  // the token itself
  check(
    'a missing, empty, numeric or list token is refused without throwing',
    [undefined, null, '', 42, ['x'], {}].every(
      (t) => hasValidBookingToken(b.id, t) === false,
    ),
  );

  check(
    'a token of the right length but wrong content is refused',
    hasValidBookingToken(b.id, 'z'.repeat(64)) === false,
  );

  const savedSecret = process.env.SESSION_SECRET;
  const savedEnv = process.env.NODE_ENV;

  process.env.SESSION_SECRET = 'secret-one-for-t12';
  const first = signBookingToken(b.id);
  process.env.SESSION_SECRET = 'secret-two-for-t12';
  check(
    'a token stops working when the session secret changes',
    hasValidBookingToken(b.id, first) === false,
  );

  delete process.env.SESSION_SECRET;
  process.env.NODE_ENV = 'development';
  check(
    'without a secret outside production a token is still produced',
    /^[0-9a-f]{64}$/.test(signBookingToken(b.id)),
  );

  process.env.NODE_ENV = 'production';
  let refusedInProduction = false;
  try {
    signBookingToken(b.id);
  } catch {
    refusedInProduction = true;
  }
  check(
    'without a secret in production signing refuses instead of using a default',
    refusedInProduction,
  );

  if (savedSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = savedSecret;
  if (savedEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedEnv;

  await cleanup();
  await pool.end();

  const passed = results.filter(Boolean).length;
  console.log(`${passed} of ${results.length} checks`);
  const ok = passed === results.length;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(ok ? 0 : 1);
})().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => {});
  await pool.end();
  process.exit(1);
});
