// T10 email verification on sign up, runs the real customer handlers against a local database
// email and redis are replaced by stubs, so no mail is sent and no redis is needed
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

const mail = { sent: [], failNext: false };
stub('../src/shared/utils/email', {
  sendEmailVerificationEmail: async ({ email, otp }) => {
    if (mail.failNext) {
      mail.failNext = false;
      throw new Error('email service is down');
    }
    mail.sent.push({ email, otp });
  },
  sendPasswordResetEmail: async () => {},
});

const store = new Map();
const redis = {
  get: async (key) => (store.has(key) ? store.get(key).value : null),
  set: async (key, value, ...args) => {
    if (args.includes('NX') && store.has(key)) return null;
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

const bcrypt = require('bcrypt');
const pool = require('../src/config/database');
const {
  register,
  login,
  verifySignup,
  resendSignupCode,
} = require('../src/features/customer/controller');

const call = async (handler, body) => {
  const req = { body, session: { cookie: {} } };
  const res = { code: 200, body: null };
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (json) => {
    res.body = json;
    return res;
  };
  await handler(req, res);
  return { res, session: req.session };
};

const signUp = (email, extra = {}) =>
  call(register, {
    name: 'Test Ten',
    email,
    phone: '09171234567',
    password: 'password123',
    ...extra,
  });

const lastCode = (email) => {
  const mine = mail.sent.filter((m) => m.email === email);
  return mine.length ? mine[mine.length - 1].otp : null;
};

const userRow = async (email) =>
  (
    await pool.query(
      `SELECT id, name, password, role, email_verified FROM users WHERE email = $1`,
      [email],
    )
  ).rows[0];

const wrongCodeFor = (email) =>
  lastCode(email) === '000000' ? '111111' : '000000';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`,
  );
};

const A = 't10-a@example.test';
const B = 't10-b@example.test';
const C = 't10-c@example.test';
const D = 't10-d@example.test';
const V = 't10-verified@example.test';
const S = 't10-staff@example.test';

(async () => {
  await pool.query(`DELETE FROM users WHERE email LIKE 't10-%'`);

  let r;
  let row;

  // sign up sends a code and gives no session
  r = await signUp(A);
  row = await userRow(A);
  check(
    'T10 sign up answers verify and creates no session',
    r.res.code === 200 && r.res.body.verify === true && !r.session.user,
    `answered ${r.res.code}`,
  );
  check(
    'T10 and the account starts unverified',
    row && row.email_verified === false,
  );
  check(
    'T10 and a 6 digit code is mailed',
    /^\d{6}$/.test(lastCode(A) || ''),
    `code ${lastCode(A)}`,
  );

  // an unverified account cannot log in
  r = await call(login, { email: A, password: 'password123' });
  check(
    'T10 an unverified account is refused at login with needsVerification',
    r.res.code === 403 &&
      r.res.body.needsVerification === true &&
      !r.session.user,
    `answered ${r.res.code}`,
  );

  // wrong and badly formed codes
  r = await call(verifySignup, { email: A, otp: wrongCodeFor(A) });
  row = await userRow(A);
  check(
    'T10 a wrong code is refused and nothing changes',
    r.res.code === 400 && row.email_verified === false && !r.session.user,
    `answered ${r.res.code}`,
  );
  r = await call(verifySignup, { email: A, otp: '12ab' });
  check('T10 a badly formed code is refused', r.res.code === 400);

  // the right code verifies and logs in
  r = await call(verifySignup, { email: A, otp: lastCode(A) });
  row = await userRow(A);
  check(
    'T10 the right code verifies the account and starts a session',
    r.res.code === 200 &&
      row.email_verified === true &&
      r.session.user &&
      r.session.user.id === row.id,
    `answered ${r.res.code}`,
  );
  const oldCode = lastCode(A);
  r = await call(verifySignup, { email: A, otp: oldCode });
  check(
    'T10 the same code cannot be used a second time',
    r.res.code === 400 && !r.session.user,
    `answered ${r.res.code}`,
  );

  // after verifying, login works and registering again is refused
  r = await call(login, { email: A, password: 'password123' });
  check(
    'T10 a verified account logs in',
    r.res.code === 200 && r.session.user,
    `answered ${r.res.code}`,
  );
  r = await signUp(A);
  check(
    'T10 signing up again with a verified email is refused',
    r.res.code === 400,
    `answered ${r.res.code}`,
  );

  // five wrong codes kill the code
  await signUp(B);
  for (let i = 0; i < 5; i++) {
    r = await call(verifySignup, { email: B, otp: wrongCodeFor(B) });
  }
  const realCode = lastCode(B);
  r = await call(verifySignup, { email: B, otp: realCode });
  row = await userRow(B);
  check(
    'T10 after five wrong codes the right code no longer works',
    r.res.code === 400 && row.email_verified === false,
    `answered ${r.res.code}`,
  );

  // resend has a cooldown, then replaces the code
  r = await call(resendSignupCode, { email: B });
  check(
    'T10 a resend inside the cooldown answers 429 with retryAfter',
    r.res.code === 429 && r.res.body.retryAfter > 0,
    `answered ${r.res.code}`,
  );
  store.delete(`signup_resend:${B}`);
  const before = lastCode(B);
  r = await call(resendSignupCode, { email: B });
  const fresh = lastCode(B);
  check(
    'T10 a resend after the cooldown mails a new code',
    r.res.code === 200 && /^\d{6}$/.test(fresh),
    `answered ${r.res.code}`,
  );
  if (fresh !== before) {
    r = await call(verifySignup, { email: B, otp: before });
    check('T10 and the old code stops working', r.res.code === 400);
  } else {
    check('T10 and the old code stops working', true, 'same random code');
  }
  r = await call(verifySignup, { email: B, otp: fresh });
  row = await userRow(B);
  check(
    'T10 and the new code verifies the account',
    r.res.code === 200 && row.email_verified === true,
    `answered ${r.res.code}`,
  );

  // signing up again over an unverified account replaces it
  await signUp(C, { name: 'First Name', password: 'firstpass123' });
  const firstRow = await userRow(C);
  store.delete(`signup_resend:${C}`);
  r = await signUp(C, { name: 'Second Name', password: 'secondpass123' });
  row = await userRow(C);
  check(
    'T10 signing up again over an unverified email replaces it, same account',
    r.res.code === 200 &&
      row.id === firstRow.id &&
      row.name === 'Second Name' &&
      (await bcrypt.compare('secondpass123', row.password)),
    `answered ${r.res.code}`,
  );

  // a staff row that was never verified is not overwritten by a sign up
  const staffHash = await bcrypt.hash('staffpass123', 10);
  await pool.query(
    `INSERT INTO users (name, email, phone, password, role, email_verified)
     VALUES ('Staff Ten', $1, '09170000000', $2, 'staff', false)`,
    [S, staffHash],
  );
  r = await signUp(S, { password: 'attackerpass1' });
  row = await userRow(S);
  check(
    'T10 a sign up cannot take over an unverified staff account',
    r.res.code === 400 &&
      row.role === 'staff' &&
      (await bcrypt.compare('staffpass123', row.password)),
    `answered ${r.res.code}`,
  );

  // a verified customer is not affected
  const verifiedHash = await bcrypt.hash('verifiedpass1', 10);
  await pool.query(
    `INSERT INTO users (name, email, phone, password, role, email_verified)
     VALUES ('Verified Ten', $1, '09170000001', $2, 'customer', true)`,
    [V, verifiedHash],
  );
  r = await call(login, { email: V, password: 'verifiedpass1' });
  check(
    'T10 a verified customer still logs in',
    r.res.code === 200 && r.session.user,
    `answered ${r.res.code}`,
  );

  // a failing email service must not leave the customer waiting out the cooldown
  mail.failNext = true;
  r = await signUp(D);
  check(
    'T10 a failing email service answers 500 on sign up',
    r.res.code === 500,
    `answered ${r.res.code}`,
  );
  r = await signUp(D);
  check(
    'T10 and asking again right away works, no cooldown is left behind',
    r.res.code === 200 && r.res.body.verify === true && !!lastCode(D),
    `answered ${r.res.code}`,
  );

  await pool.query(`DELETE FROM users WHERE email LIKE 't10-%'`);

  const all = results.every(Boolean);
  console.log(`${results.filter(Boolean).length} of ${results.length} checks`);
  console.log(all ? 'RESULT: PASS' : 'RESULT: FAIL');
  await pool.end();
  process.exit(all ? 0 : 1);
})();
