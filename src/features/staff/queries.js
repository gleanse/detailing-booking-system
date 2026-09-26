//QUERY
const pool = require('../../config/database');

const getUpcomingBookings = async ({
  page = 1,
  limit = 5,
  date = null,
} = {}) => {
  const offset = (page - 1) * limit;
  const params = [];
  let dateFilter = '';

  if (date) {
    params.push(date);
    dateFilter = `AND a.date = $${params.length}`;
  }

  params.push(limit);
  params.push(offset);

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM bookings b
     LEFT JOIN availability a ON b.availability_id = a.id
     WHERE a.date >= CURRENT_DATE
       AND b.booking_status = 'confirmed'
       ${dateFilter}`,
    date ? [date] : [],
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.status,
      b.booking_status,
      b.is_walkin,
      b.payment_method,
      b.created_at,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone AS customer_phone,
      s.name AS service_name,
      s.id AS service_id,
      sv.id AS variant_id,
      sv.name AS variant_name,
      sv.price AS variant_price,
      sv.duration_hours,
      p.amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN service_variants sv ON b.variant_id = sv.id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE a.date >= CURRENT_DATE
      AND b.booking_status = 'confirmed'
      ${dateFilter}
    ORDER BY a.date ASC, b.queue_number ASC NULLS LAST, b.created_at ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    bookings: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

const getBookingsForDate = async (date, { page = 1, limit = 5 } = {}) => {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM bookings b
     LEFT JOIN availability a ON b.availability_id = a.id
     WHERE a.date = $1 AND b.booking_status = 'confirmed'`,
    [date],
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.status,
      b.booking_status,
      b.is_walkin,
      b.payment_method,
      b.created_at,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone AS customer_phone,
      s.name AS service_name,
      s.id AS service_id,
      sv.id AS variant_id,
      sv.name AS variant_name,
      sv.price AS variant_price,
      sv.duration_hours,
      p.amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN service_variants sv ON b.variant_id = sv.id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE a.date = $1
      AND b.booking_status = 'confirmed'
    ORDER BY b.queue_number ASC NULLS LAST, b.created_at ASC
    LIMIT $2 OFFSET $3`,
    [date, limit, offset],
  );

  return {
    bookings: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

const getBookingByReferenceCode = async (referenceCode) => {
  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.status,
      b.booking_status,
      b.is_walkin,
      b.payment_method,
      b.created_at,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone AS customer_phone,
      s.name AS service_name,
      s.id AS service_id,
      sv.id AS variant_id,
      sv.name AS variant_name,
      sv.price AS variant_price,
      sv.duration_hours,
      p.id AS payment_id,
      p.amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      a.id AS availability_id
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN service_variants sv ON b.variant_id = sv.id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE b.reference_code = $1
      AND b.booking_status = 'confirmed'`,
    [referenceCode.toUpperCase()],
  );
  return result.rows[0] || null;
};

const getBookingById = async (id) => {
  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.status,
      b.booking_status,
      b.is_walkin,
      b.payment_method,
      b.created_at,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone AS customer_phone,
      s.name AS service_name,
      s.id AS service_id,
      sv.id AS variant_id,
      sv.name AS variant_name,
      sv.price AS variant_price,
      sv.duration_hours,
      p.id AS payment_id,
      p.amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      a.id AS availability_id
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN service_variants sv ON b.variant_id = sv.id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE b.id = $1`,
    [id],
  );
  return result.rows[0] || null;
};

// returns the staff who marked this booking as in_progress
const getInProgressStaff = async (bookingId) => {
  const result = await pool.query(
    `SELECT u.id, u.name
     FROM booking_status_logs bsl
     LEFT JOIN users u ON bsl.changed_by = u.id
     WHERE bsl.booking_id = $1 AND bsl.status = 'in_progress'
     ORDER BY bsl.created_at DESC
     LIMIT 1`,
    [bookingId],
  );
  return result.rows[0] || null;
};

// returns all in_progress bookings that the given staff started
const getMyInProgressBookings = async (staffId) => {
  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.status,
      b.is_walkin,
      b.payment_method,
      s.name AS service_name,
      sv.name AS variant_name,
      p.amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      bsl.created_at AS started_at
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN service_variants sv ON b.variant_id = sv.id
    LEFT JOIN payments p ON p.booking_id = b.id
    LEFT JOIN availability a ON b.availability_id = a.id
    INNER JOIN booking_status_logs bsl
      ON bsl.booking_id = b.id
      AND bsl.status = 'in_progress'
      AND bsl.changed_by = $1
    WHERE b.status = 'in_progress'
      AND b.booking_status = 'confirmed'
    ORDER BY bsl.created_at ASC`,
    [staffId],
  );
  return result.rows;
};

const updateBookingStatus = async (bookingId, status, staffId) => {
  const result = await pool.query(
    `UPDATE bookings
     SET status = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, status, reference_code`,
    [status, staffId, bookingId],
  );
  return result.rows[0];
};

const logBookingStatus = async (bookingId, status, staffId) => {
  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, status, changed_by)
     VALUES ($1, $2, $3)`,
    [bookingId, status, staffId],
  );
};

const updateVariant = async (bookingId, variantId, staffId) => {
  const variantResult = await pool.query(
    `SELECT price FROM service_variants WHERE id = $1`,
    [variantId],
  );
  if (variantResult.rows.length === 0) return null;

  const newPrice = parseFloat(variantResult.rows[0].price);

  await pool.query(
    `UPDATE bookings SET variant_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
    [variantId, staffId, bookingId],
  );

  const paymentResult = await pool.query(
    `SELECT id, amount_paid FROM payments WHERE booking_id = $1`,
    [bookingId],
  );
  if (paymentResult.rows.length === 0) return null;

  const amountPaid = parseFloat(paymentResult.rows[0].amount_paid);
  const remaining = Math.max(0, newPrice - amountPaid);
  const isFullyPaid = remaining === 0;

  await pool.query(
    `UPDATE payments
     SET amount = $1, remaining_balance = $2, is_fully_paid = $3
     WHERE booking_id = $4`,
    [newPrice, remaining, isFullyPaid, bookingId],
  );

  return { newPrice, amountPaid, remaining, isFullyPaid };
};

const markFullyPaid = async (bookingId, staffId) => {
  await pool.query(
    `UPDATE payments
     SET remaining_balance = 0, is_fully_paid = true, paid_at = NOW()
     WHERE booking_id = $1`,
    [bookingId],
  );
  await pool.query(
    `UPDATE bookings SET updated_by = $1, updated_at = NOW() WHERE id = $2`,
    [staffId, bookingId],
  );
};

const getAvailabilityForDate = async (serviceId, date) => {
  const result = await pool.query(
    `SELECT a.id, a.capacity, a.is_open,
      COUNT(b.id) FILTER (WHERE b.booking_status = 'confirmed') AS confirmed_count
     FROM availability a
     LEFT JOIN bookings b ON b.availability_id = a.id
     WHERE a.service_id = $1 AND a.date = $2
     GROUP BY a.id`,
    [serviceId, date],
  );
  return result.rows[0] || null;
};

const getNextQueueNumber = async (availabilityId) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue
     FROM bookings
     WHERE availability_id = $1 AND booking_status = 'confirmed'`,
    [availabilityId],
  );
  return result.rows[0].next_queue;
};

const getAllActiveServices = async () => {
  const result = await pool.query(
    `SELECT s.id, s.name, s.price,
      json_agg(
        json_build_object('id', sv.id, 'name', sv.name, 'price', sv.price, 'duration_hours', sv.duration_hours)
        ORDER BY sv.price ASC
      ) FILTER (WHERE sv.id IS NOT NULL AND sv.is_active = true) AS variants
     FROM services s
     LEFT JOIN service_variants sv ON sv.service_id = s.id AND sv.is_active = true
     WHERE s.is_active = true
     GROUP BY s.id
     ORDER BY s.name ASC`,
  );
  return result.rows;
};

const createWalkInBooking = async ({
  serviceId,
  variantId,
  availabilityId,
  guestName,
  guestEmail,
  guestPhone,
  motorcyclePlate,
  motorcycleModel,
  motorcycleColor,
  motorcycleDescription,
  queueNumber,
  referenceCode,
  qrCode,
  staffId,
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        service_id, variant_id, availability_id,
        guest_name, guest_email, guest_phone,
        motorcycle_plate, motorcycle_model, motorcycle_color, motorcycle_description,
        queue_number, reference_code, qr_code,
        is_walkin, payment_method, status, booking_status,
        updated_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,'cash','pending','confirmed',$14,NOW())
      RETURNING id, reference_code, queue_number`,
      [
        serviceId,
        variantId,
        availabilityId,
        guestName,
        guestEmail || null,
        guestPhone || null,
        motorcyclePlate,
        motorcycleModel || null,
        motorcycleColor || null,
        motorcycleDescription || null,
        queueNumber,
        referenceCode,
        qrCode,
        staffId,
      ],
    );

    const booking = bookingResult.rows[0];

    const variantResult = await client.query(
      `SELECT price FROM service_variants WHERE id = $1`,
      [variantId],
    );
    const price = parseFloat(variantResult.rows[0].price);

    await client.query(
      `INSERT INTO payments (booking_id, amount, amount_paid, remaining_balance, payment_type, is_fully_paid, status, paid_at)
       VALUES ($1, $2, $2, 0, 'full', true, 'paid', NOW())`,
      [booking.id, price],
    );

    await client.query(
      `INSERT INTO booking_status_logs (booking_id, status, changed_by)
       VALUES ($1, 'confirmed', $2)`,
      [booking.id, staffId],
    );

    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const logAudit = async ({ userId, action, targetTable, targetId, details }) => {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, targetTable, targetId, details],
  );
};

const getDoneNotPickedUp = async () => {
  const result = await pool.query(
    `SELECT
      b.id, b.reference_code, b.queue_number,
      b.guest_name, b.motorcycle_plate, b.motorcycle_model,
      b.status, b.updated_at,
      s.name AS service_name,
      sv.name AS variant_name,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date
     FROM bookings b
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN service_variants sv ON b.variant_id = sv.id
     LEFT JOIN availability a ON b.availability_id = a.id
     WHERE b.status = 'done'
       AND b.booking_status = 'confirmed'
     ORDER BY b.updated_at ASC`,
  );
  return result.rows;
};

const getVariantsForService = async (serviceId) => {
  const result = await pool.query(
    `SELECT id, name, price, duration_hours
     FROM service_variants
     WHERE service_id = $1 AND is_active = true
     ORDER BY price ASC`,
    [serviceId],
  );
  return result.rows;
};

module.exports = {
  getUpcomingBookings,
  getBookingsForDate,
  getBookingByReferenceCode,
  getBookingById,
  getInProgressStaff,
  getMyInProgressBookings,
  updateBookingStatus,
  logBookingStatus,
  updateVariant,
  markFullyPaid,
  getAvailabilityForDate,
  getNextQueueNumber,
  getAllActiveServices,
  createWalkInBooking,
  logAudit,
  getDoneNotPickedUp,
  getVariantsForService,
};
