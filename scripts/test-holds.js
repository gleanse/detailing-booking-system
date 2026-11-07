// T11 hold caps, runs the real lock and release handlers against a local database
// logged in customers are capped per account, guests per network, email redis and xendit are replaced by stubs
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
const redis = {
  incrKeys: [],
  get: async (key) => (store.has(key) ? store.get(key).value : null),
  set: async (key, value, ...args) => {
    const at = args.indexOf('EX');
    store.set(key, {
      value: String(value),
      ttl: at >= 0 ? args[at + 1] : -1,
    });
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
  expire: async (key, seconds) => {
    if (store.has(key)) store.get(key).ttl = seconds;
    return 1;
  },
};
stub('../src/config/redis', redis);

const pool = require('../src/config/database');
const {
  MAX_USER_HOLDS,
  MAX_GUEST_IP_HOLDS,
} = require('../src/features/bookings/queries');
const {
  lockBookingSlot,
  releaseBookingSlot,
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

const lock = (ip, userId) => {
  const req = {
    body: { availabilityId: slot, serviceId: service },
    ip,
    session: userId ? { user: { id: userId } } : {},
  };
  const res = fakeRes();
  return lockBookingSlot(req, res).then(() => res);
};

const release = (bookingId) => {
  const res = fakeRes();
  return releaseBookingSlot({ body: { bookingId } }, res).then(() => res);
};

const lockMany = (count, ip, userId) =>
  Promise.all(Array.from({ length: count }, () => lock(ip, userId)));

const granted = (list) => list.filter((r) => r.code === 200).length;
const refused = (list) =>
  list.filter((r) => r.code === 429 && r.body.holdLimit).length;

const activeFor = async (column, value) =>
  (
    await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE ${column} = $1 AND booking_status = 'locked' AND expires_at > NOW()`,
      [value],
    )
  ).rows[0].n;

const makeUser = async (tag) =>
  (
    await pool.query(
      `INSERT INTO users (name, email, phone, password, role, email_verified)
       VALUES ('Hold Test', $1, '09170000000', 'x', 'customer', true)
       RETURNING id`,
      [`t11-${tag}@example.test`],
    )
  ).rows[0].id;

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
       (SELECT id FROM services WHERE name = 'T11 hold test')`,
  );
  await pool.query(
    `DELETE FROM availability WHERE service_id IN
       (SELECT id FROM services WHERE name = 'T11 hold test')`,
  );
  await pool.query(`DELETE FROM services WHERE name = 'T11 hold test'`);
  await pool.query(`DELETE FROM users WHERE email LIKE 't11-%'`);
};

(async () => {
  await cleanup();

  service = (
    await pool.query(
      `INSERT INTO services (name, price, down_payment_amount)
       VALUES ('T11 hold test', 1, 1) RETURNING id`,
    )
  ).rows[0].id;
  slot = (
    await pool.query(
      `INSERT INTO availability (service_id, date, capacity, is_open)
       VALUES ($1, CURRENT_DATE + 1, 500, true) RETURNING id`,
      [service],
    )
  ).rows[0].id;

  let r;
  let list;

  // guests are capped per network
  const guestIp = '10.11.0.1';
  list = [];
  for (let i = 0; i < MAX_GUEST_IP_HOLDS; i++) list.push(await lock(guestIp));
  check(
    `a guest can hold ${MAX_GUEST_IP_HOLDS} dates from one network`,
    granted(list) === MAX_GUEST_IP_HOLDS,
  );

  r = await lock(guestIp);
  check(
    'the next guest hold from that network is refused with holdLimit',
    r.code === 429 && r.body.holdLimit === true,
    `answered ${r.code}`,
  );
  check(
    'and the message talks about the network, not the account',
    /network/i.test(r.body.message),
  );
  check(
    'and the refusal created no booking',
    (await activeFor('ip_address', guestIp)) === MAX_GUEST_IP_HOLDS,
  );
  check('and the refusal added no strike', redis.incrKeys.length === 0);

  // a freed or stale hold lets the next one through
  const oldest = await pool.query(
    `SELECT id FROM bookings WHERE ip_address = $1 AND booking_status = 'locked' LIMIT 1`,
    [guestIp],
  );
  await pool.query(
    `UPDATE bookings SET booking_status = 'expired' WHERE id = $1`,
    [oldest.rows[0].id],
  );
  r = await lock(guestIp);
  check('a freed hold lets the next guest hold through', r.code === 200);

  r = await lock(guestIp);
  check('and the cap applies again right after', r.code === 429);

  const stale = await pool.query(
    `SELECT id FROM bookings WHERE ip_address = $1 AND booking_status = 'locked' LIMIT 1`,
    [guestIp],
  );
  await pool.query(
    `UPDATE bookings SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
    [stale.rows[0].id],
  );
  r = await lock(guestIp);
  check(
    'a hold past its expiry no longer counts before the sweep runs',
    r.code === 200,
  );

  // logged in customers are capped per account
  const userA = await makeUser('a');
  list = [];
  for (let i = 0; i < MAX_USER_HOLDS; i++) {
    list.push(await lock('10.11.0.2', userA));
  }
  check(
    `a logged in customer can hold ${MAX_USER_HOLDS} dates`,
    granted(list) === MAX_USER_HOLDS,
  );

  r = await lock('10.11.0.2', userA);
  check(
    'the next hold on that account is refused with holdLimit',
    r.code === 429 && r.body.holdLimit === true,
    `answered ${r.code}`,
  );
  check(
    'and the message talks about the account',
    /already have/i.test(r.body.message),
  );

  r = await lock('10.11.0.3', userA);
  check(
    'the account cap follows the customer to another network',
    r.code === 429 && r.body.holdLimit === true,
  );

  // other people are unaffected
  const userB = await makeUser('b');
  r = await lock('10.11.0.2', userB);
  check('another customer on the same network is unaffected', r.code === 200);

  r = await lock('10.11.0.4');
  check('a guest on another network is unaffected', r.code === 200);

  // plan B, a logged in customer is not held back by a guest network
  const fullIp = '10.11.0.5';
  await lockMany(MAX_GUEST_IP_HOLDS, fullIp);
  r = await lock(fullIp);
  check('guests on a full network are refused', r.code === 429);

  const userC = await makeUser('c');
  r = await lock(fullIp, userC);
  check(
    'a logged in customer on that same network still gets through',
    r.code === 200,
  );

  // blocks, strikes still land on both but each side only checks its own
  const blockedIp = '10.11.0.6';
  await redis.set(`block:ip:${blockedIp}`, '1', 'EX', 600);
  r = await lock(blockedIp);
  check(
    'a guest on a blocked network is refused as blocked',
    r.code === 429 && r.body.blocked === true,
  );

  const userD = await makeUser('d');
  r = await lock(blockedIp, userD);
  check(
    'a logged in customer on a blocked network is not blocked by it',
    r.code === 200,
  );

  const userE = await makeUser('e');
  await redis.set(`block:user:${userE}`, '1', 'EX', 600);
  r = await lock('10.11.0.7', userE);
  check(
    'a blocked account is refused as blocked on any network',
    r.code === 429 && r.body.blocked === true,
  );

  // the warning count follows the account for logged in customers
  const userF = await makeUser('f');
  const held = await lock('10.11.0.8', userF);
  await redis.set(`abuse:user:${userF}`, '1', 'EX', 600);
  r = await release(held.body.data.id);
  check(
    'a logged in release reports the account strike count',
    r.code === 200 && r.body.abuseCount === 2,
    `abuseCount ${r.body && r.body.abuseCount}`,
  );

  const guestHeld = await lock('10.11.0.9');
  r = await release(guestHeld.body.data.id);
  check(
    'a guest release reports the network strike count',
    r.code === 200 && r.body.abuseCount === 1,
    `abuseCount ${r.body && r.body.abuseCount}`,
  );

  // the race, many requests at once must not slip past the cap
  const raceIp = '10.11.0.10';
  list = await lockMany(10, raceIp);
  check(
    `10 simultaneous guest holds from one network leave exactly ${MAX_GUEST_IP_HOLDS}`,
    granted(list) === MAX_GUEST_IP_HOLDS &&
      refused(list) === 10 - MAX_GUEST_IP_HOLDS &&
      (await activeFor('ip_address', raceIp)) === MAX_GUEST_IP_HOLDS,
    `${granted(list)} granted, ${refused(list)} refused`,
  );

  const userG = await makeUser('g');
  list = await lockMany(8, '10.11.0.11', userG);
  check(
    `8 simultaneous holds on one account leave exactly ${MAX_USER_HOLDS}`,
    granted(list) === MAX_USER_HOLDS &&
      refused(list) === 8 - MAX_USER_HOLDS &&
      (await activeFor('user_id', userG)) === MAX_USER_HOLDS,
    `${granted(list)} granted, ${refused(list)} refused`,
  );

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
