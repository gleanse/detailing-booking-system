// PAYMENT QUERIES
const pool = require('../../config/database');

const getLockedBookingForPayment = async (bookingId) => {
  const result = await pool.query(
    `SELECT b.*, sv.price AS variant_price, s.price AS service_price, s.name AS service_name,
            sv.name AS variant_name, u.email AS user_email, b.guest_email
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     LEFT JOIN service_variants sv ON sv.id = b.variant_id
     LEFT JOIN users u ON u.id = b.user_id
     WHERE b.id = $1 AND b.booking_status = 'locked'`,
    [bookingId],
  );
  return result.rows[0] || null;
};

const createPayment = async ({
  bookingId,
  amount,
  amountPaid,
  paymentType,
}) => {
  const result = await pool.query(
    `
    INSERT INTO payments (
      booking_id,
      amount,
      amount_paid,
      remaining_balance,
      payment_type,
      is_fully_paid,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'unpaid')
    RETURNING *
  `,
    [
      bookingId,
      amount,
      amountPaid,
      amount - amountPaid,
      paymentType,
      paymentType === 'full',
    ],
  );
  return result.rows[0];
};

const getPaymentById = async (paymentId) => {
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [
    paymentId,
  ]);
  return result.rows[0] || null;
};

const getBookingByPaymentId = async (paymentId) => {
  const result = await pool.query(
    `SELECT 
      b.id,
      b.reference_code,
      b.queue_number,
      b.guest_name,
      b.guest_email,
      b.booking_status,
      b.motorcycle_plate,
      b.motorcycle_model,
      b.motorcycle_color,
      b.qr_code,
      TO_CHAR(a.date, 'YYYY-MM-DD') AS booking_date,
      a.capacity AS date_capacity,
      s.name AS service_name,
      sv.name AS variant_name,
      p.amount_paid,
      p.remaining_balance,
      p.payment_type,
      p.is_fully_paid
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN availability a ON a.id = b.availability_id
    JOIN services s ON s.id = b.service_id
    LEFT JOIN service_variants sv ON sv.id = b.variant_id
    WHERE p.id = $1`,
    [paymentId],
  );
  return result.rows[0] || null;
};

module.exports = {
  getLockedBookingForPayment,
  createPayment,
  getPaymentById,
  getBookingByPaymentId,
};