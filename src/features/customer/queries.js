// CUSTOMER ACCOUNT QUERIES
const pool = require('../../config/database');

const getBookingsByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.status,
      b.booking_status,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.qr_code,
      b.payment_method,
      b.is_walkin,
      b.created_at,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      s.name AS service_name,
      sv.name AS variant_name,
      p.amount AS total_amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid
    FROM bookings b
    JOIN availability a ON a.id = b.availability_id
    JOIN services s ON s.id = b.service_id
    LEFT JOIN service_variants sv ON sv.id = b.variant_id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE b.user_id = $1
    AND b.booking_status IN ('confirmed', 'expired')
    ORDER BY b.created_at DESC`,
    [userId],
  );
  return result.rows;
};

const getBookingByReferenceCode = async (referenceCode, userId) => {
  const bookingResult = await pool.query(
    `SELECT
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.status,
      b.booking_status,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.is_walkin,
      b.payment_method,
      b.qr_code,
      b.created_at,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      s.name AS service_name,
      sv.name AS variant_name,
      p.amount AS total_amount,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid
    FROM bookings b
    JOIN availability a ON a.id = b.availability_id
    JOIN services s ON s.id = b.service_id
    LEFT JOIN service_variants sv ON sv.id = b.variant_id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE b.reference_code = $1 AND b.user_id = $2`,
    [referenceCode, userId],
  );

  if (!bookingResult.rows.length) return null;

  const booking = bookingResult.rows[0];

  const logsResult = await pool.query(
    `SELECT
      bsl.status,
      bsl.created_at,
      u.name AS changed_by_name
    FROM booking_status_logs bsl
    LEFT JOIN users u ON u.id = bsl.changed_by
    WHERE bsl.booking_id = $1
    ORDER BY bsl.created_at ASC`,
    [booking.id],
  );

  return { ...booking, status_logs: logsResult.rows };
};

const updateUserEmail = async (userId, newEmail) => {
  const result = await pool.query(
    `UPDATE users SET email = $1 WHERE id = $2 RETURNING id, name, email, phone, role`,
    [newEmail, userId],
  );
  return result.rows[0];
};

// getLastBookingByUserId for rebook autofill
const getLastBookingByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.motorcycle_description,
      b.guest_phone,
      b.service_id,
      b.variant_id,
      s.name AS service_name,
      sv.name AS variant_name
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    LEFT JOIN service_variants sv ON sv.id = b.variant_id
    WHERE b.user_id = $1
    AND b.booking_status = 'confirmed'
    ORDER BY b.created_at DESC
    LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
};

module.exports = {
  getBookingsByUserId,
  getBookingByReferenceCode,
  updateUserEmail,
  getLastBookingByUserId,
};
