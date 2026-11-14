// T13 a closed tab frees its hold after a grace period, and never touches a hold with a payment
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
stub('../src/config/xendit', { xenditClient: {}, xenditInvoiceClient: {} });

const store = new Map();
const zsets = new Map();
const zset = (key) => {
  if (!zsets.has(key)) zsets.set(key, new Map());
  return zsets.get(key);
};
const redis = {
  get: async (key) => (store.has(key) ? store.get(key).value : null),
  set: async (key, value) => {
    store.set(key, { value: String(value), ttl: -1 });
    return 'OK';
  },
  del: async (key) => (store.delete(key) ? 1 : 0),
  ttl: async (key) => (store.has(key) ? store.get(key).ttl : -2),
  incr: async (key) => {
    const next = Number(store.has(key) ? store.get(key).value : 0) + 1;
    store.set(key, { value: String(next), ttl: -1 });
    return next;
  },
  expire: async () => 1,
  zadd: async (key, score, member) => {
    zset(key).set(String(member), Number(score));
    return 1;
  },
  zrem: async (key, member) => (zset(key).delete(String(member)) ? 1 : 0),
  zrangebyscore: async (key, min, max) =>
    [...zset(key).entries()]
      .filter(([, score]) => score <= Number(max))
      .map(([member]) => member),
};
stub('../src/config/redis', redis);

const pool = require('../src/config/database');
const { createPayment } = require('../src/features/bookings/queries');
const {
  LEAVING_KEY,
  GRACE_SECONDS,
  releaseAbandonedBookings,
} = require('../src/features/bookings/leaving');
const {
  lockBookingSlot,
  markBookingLeaving,
  keepBooking,
} = require('../src/features/bookings/controller');
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
  res.end = () => {
    if (res.code === 200) res.code = 204;
    return res;
  };
  return res;
};

let service;
let slot;
let ipCounter = 0;

const hold = async () => {
  const ip = `10.13.0.${++ipCounter}`;
  const res = fakeRes();
  await lockBookingSlot(
    {
      body: { availabilityId: slot, serviceId: service },
      ip,
      session: {},
    },
    res,
  );
  return { id: res.body.data.id, token: res.body.bookingToken, ip };
};

const call = async (handler, bookingId, bookingToken) => {
  const res = fakeRes();
  await handler({ body: { bookingId, bookingToken } }, res);
  return res;
};

const status = async (id) =>
  (await pool.query(`SELECT booking_status FROM bookings WHERE id = $1`, [id]))
    .rows[0].booking_status;

const marked = (id) => zset(LEAVING_KEY).has(String(id));

// pretend the page reported leaving a while ago
const ageMark = (id, seconds) =>
  zset(LEAVING_KEY).set(String(id), Date.now() - seconds * 1000);

const strikes = [];
const sweep = () =>
  releaseAbandonedBookings({
    onReleased: async (ip, userId) => strikes.push({ ip, userId }),
  });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

const cleanup = async () => {
  await pool.query(
    `DELETE FROM payments WHERE booking_id IN
       (SELECT id FROM bookings WHERE service_id IN
         (SELECT id FROM services WHERE name = 'T13 leaving test'))`,
  );
  await pool.query(
    `DELETE FROM bookings WHERE service_id IN
       (SELECT id FROM services WHERE name = 'T13 leaving test')`,
  );
  await pool.query(
    `DELETE FROM availability WHERE service_id IN
       (SELECT id FROM services WHERE name = 'T13 leaving test')`,
  );
  await pool.query(`DELETE FROM services WHERE name = 'T13 leaving test'`);
};

(async () => {
  await cleanup();

  service = (
    await pool.query(
      `INSERT INTO services (name, price, down_payment_amount)
       VALUES ('T13 leaving test', 1000, 100) RETURNING id`,
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
  let r;

  // who may report leaving
  r = await call(markBookingLeaving, a.id);
  check('leaving without a token is refused with 403', r.code === 403);

  r = await call(markBookingLeaving, a.id, 'not-a-real-token');
  check('leaving with a made up token is refused with 403', r.code === 403);

  r = await call(markBookingLeaving, a.id, signBookingToken(a.id + 1000));
  check('leaving with the token of another hold is refused', r.code === 403);

  check('and nothing was marked', !marked(a.id));

  // grace period
  r = await call(markBookingLeaving, a.id, a.token);
  check('leaving with the right token is accepted', r.code === 204);
  check('and the hold is marked', marked(a.id));

  check(
    'a sweep inside the grace period releases nothing',
    (await sweep()) === 0 &&
      (await status(a.id)) === 'locked' &&
      strikes.length === 0,
  );

  // coming back
  r = await call(keepBooking, a.id);
  check('staying without a token is refused with 403', r.code === 403);
  check('and the mark is still there', marked(a.id));

  r = await call(keepBooking, a.id, a.token);
  check(
    'staying with the right token clears the mark',
    r.code === 204 && !marked(a.id),
  );

  ageMark(a.id, GRACE_SECONDS + 30);
  await call(keepBooking, a.id, a.token);
  check(
    'a customer who came back is not released even by a late sweep',
    (await sweep()) === 0 && (await status(a.id)) === 'locked',
  );

  // gone for good
  await call(markBookingLeaving, a.id, a.token);
  ageMark(a.id, GRACE_SECONDS + 30);
  const released = await sweep();
  check(
    'a hold gone past the grace period is released with one strike',
    released === 1 &&
      (await status(a.id)) === 'expired' &&
      strikes.length === 1 &&
      strikes[0].ip === a.ip,
    `${released} released, ${strikes.length} strikes`,
  );
  check('and its mark is removed', !marked(a.id));

  check(
    'a second sweep does not release or strike again',
    (await sweep()) === 0 && strikes.length === 1,
  );

  // payment started
  const p = await hold();
  await createPayment({ bookingId: p.id, amount: 100, amountPaid: 100 });

  r = await call(markBookingLeaving, p.id, p.token);
  check(
    'leaving on a hold with a payment is accepted but not marked',
    r.code === 204 && !marked(p.id),
  );

  ageMark(p.id, GRACE_SECONDS + 30);
  check(
    'even a forced mark never frees a hold with a payment',
    (await sweep()) === 0 &&
      (await status(p.id)) === 'locked' &&
      strikes.length === 1,
  );
  check('and the stale mark is cleaned up', !marked(p.id));

  // already confirmed
  const c = await hold();
  await pool.query(
    `UPDATE bookings SET booking_status = 'confirmed' WHERE id = $1`,
    [c.id],
  );
  ageMark(c.id, GRACE_SECONDS + 30);
  check(
    'a confirmed booking is never released',
    (await sweep()) === 0 &&
      (await status(c.id)) === 'confirmed' &&
      strikes.length === 1,
  );

  // reports that arrive out of order when the page is refreshed quickly
  const callVisit = async (handler, h, visit) => {
    const res = fakeRes();
    await handler(
      { body: { bookingId: h.id, bookingToken: h.token, visit } },
      res,
    );
    return res;
  };

  const o = await hold();
  const base = Date.now();
  await callVisit(keepBooking, o, base + 2000);
  await callVisit(markBookingLeaving, o, base + 1000);
  check('a late leaving report from an older page is ignored', !marked(o.id));
  check(
    'so a refreshed page keeps its hold',
    (await sweep()) === 0 && (await status(o.id)) === 'locked',
  );

  await callVisit(keepBooking, o, base + 500);
  await callVisit(markBookingLeaving, o, base + 1500);
  check('an older back report does not lower the newest page', !marked(o.id));

  await callVisit(markBookingLeaving, o, base + 3000);
  check('a leaving report from the newest page still marks', marked(o.id));

  await callVisit(keepBooking, o, base + 3000);
  check('and coming back from that page clears it', !marked(o.id));

  const legacy = await hold();
  await call(markBookingLeaving, legacy.id, legacy.token);
  check('a page without a visit number still marks', marked(legacy.id));
  await call(keepBooking, legacy.id, legacy.token);
  check('and still clears it when it comes back', !marked(legacy.id));

  // block wording
  const blockedMessage = async (seconds) => {
    const ip = `10.13.1.${++ipCounter}`;
    store.set(`block:ip:${ip}`, { value: '1', ttl: seconds });
    const res = fakeRes();
    await lockBookingSlot(
      {
        body: { availabilityId: slot, serviceId: service },
        ip,
        session: {},
      },
      res,
    );
    return res;
  };

  const expectations = [
    [7200, '2 hours'],
    [5400, '1 hour 30 minutes'],
    [3600, '1 hour'],
    [2700, '45 minutes'],
    [61, '2 minutes'],
    [1, '1 minute'],
  ];
  for (const [seconds, wording] of expectations) {
    const res = await blockedMessage(seconds);
    check(
      `a block with ${seconds} seconds left says ${wording}`,
      res.code === 429 &&
        res.body.blocked === true &&
        res.body.message.includes(`blocked from booking for ${wording}.`),
      res.body && res.body.message,
    );
  }

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
