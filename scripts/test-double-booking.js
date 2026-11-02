// T1 double booking race test
// fires many lock requests at the same moment at a date with capacity 3
// NOTE: run it before and after the atomic reservation fix, only against a local database
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

const pool = require('../src/config/database');
const { lockSlot } = require('../src/features/bookings/queries');

const CAPACITY = 3;
const REQUESTS = 50;
const ROUNDS = Number(process.argv[2] || 20);

async function oneRound(n) {
  const service = await pool.query(
    `INSERT INTO services (name, price, down_payment_amount) VALUES ('T1 race test', 1, 1) RETURNING id`
  );
  const serviceId = service.rows[0].id;
  const slot = await pool.query(
    `INSERT INTO availability (service_id, date, capacity, is_open)
     VALUES ($1, CURRENT_DATE + 1, $2, true) RETURNING id`,
    [serviceId, CAPACITY],
  );
  const availabilityId = slot.rows[0].id;

  const results = await Promise.all(
    Array.from({ length: REQUESTS }, (_, i) =>
      lockSlot({
        availabilityId,
        serviceId,
        variantId: null,
        userId: null,
        ipAddress: `10.0.0.${i}`,
      })
        .then(() => 'got a slot')
        .catch((e) =>
          e.code === 'SLOT_FULL' ? 'refused' : `error ${e.message}`,
        ),
    ),
  );

  const got = results.filter((r) => r === 'got a slot').length;
  const refused = results.filter((r) => r === 'refused').length;
  const errors = results.length - got - refused;
  const held = await pool.query(
    `SELECT COUNT(*)::int AS n FROM bookings
     WHERE availability_id = $1 AND booking_status IN ('locked', 'confirmed')`,
    [availabilityId],
  );

  await pool.query(`DELETE FROM bookings WHERE availability_id = $1`, [
    availabilityId,
  ]);
  await pool.query(`DELETE FROM availability WHERE id = $1`, [availabilityId]);
  await pool.query(`DELETE FROM services WHERE id = $1`, [serviceId]);

  const pass = held.rows[0].n <= CAPACITY && errors === 0;
  console.log(
    `round ${n}: ${REQUESTS} requests, ${got} got a slot, ${refused} refused, ${errors} errors, ${held.rows[0].n} held, capacity ${CAPACITY} -> ${pass ? 'PASS' : 'FAIL'}`,
  );
  return pass;
}

(async () => {
  let all = true;
  for (let n = 1; n <= ROUNDS; n++) all = (await oneRound(n)) && all;
  console.log(all ? 'RESULT: PASS' : 'RESULT: FAIL');
  await pool.end();
  process.exit(all ? 0 : 1);
})();
