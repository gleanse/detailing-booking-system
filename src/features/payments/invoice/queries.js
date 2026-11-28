const pool = require('../../../config/database');
const { saveBookingQr } = require('../../../shared/utils/qr');

const getInvoicedPayment = async (bookingId) => {
  const result = await pool.query(
    `
    SELECT id, status, invoice_url,
           (created_at > NOW() - INTERVAL '14 minutes') AS within_window
    FROM payments
    WHERE booking_id = $1 AND invoice_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [bookingId],
  );
  return result.rows[0] || null;
};

const saveInvoiceOnPayment = async ({ paymentId, invoiceId, invoiceUrl }) => {
  await pool.query(
    `UPDATE payments SET xendit_invoice_id = $2, invoice_url = $3 WHERE id = $1`,
    [paymentId, invoiceId, invoiceUrl],
  );
};

const createPayment = async ({ bookingId, amount, amountPaid }) => {
  const result = await pool.query(
    `
    INSERT INTO payments (
      booking_id,
      amount,
      amount_paid,
      remaining_balance,
      status
    ) VALUES ($1, $2, $3, $4, 'unpaid')
    RETURNING *
  `,
    [bookingId, amount, amountPaid, amount - amountPaid],
  );
  return result.rows[0];
};

const confirmBooking = async ({ bookingId, xenditInvoiceId }) => {
  const result = await pool.query(
    `
    UPDATE bookings
    SET
      booking_status = 'confirmed',
      reference_code = 'HRC-' || UPPER(SUBSTRING(id::text, 1, 8)),
      queue_number = (
        SELECT COALESCE(MAX(queue_number), 0) + 1
        FROM bookings
        WHERE availability_id = (
          SELECT availability_id FROM bookings WHERE id = $1
        )
      ),
      updated_at = NOW()
    WHERE id = $1 AND booking_status IN ('locked', 'expired')
    RETURNING *
  `,
    [bookingId],
  );

  const booking = result.rows[0];
  if (!booking) return null;

  const qrUrl = await saveBookingQr(booking.reference_code);

  // Store URL in DB
  await pool.query(`UPDATE bookings SET qr_code = $2 WHERE id = $1`, [
    bookingId,
    qrUrl,
  ]);

  await pool.query(
    `
    UPDATE payments
    SET
      status = 'paid',
      xendit_invoice_id = $2,
      paid_at = NOW()
    WHERE booking_id = $1
  `,
    [bookingId, xenditInvoiceId],
  );

  await pool.query(
    `INSERT INTO booking_status_logs (booking_id, status, changed_by)
     VALUES ($1, 'confirmed', NULL)`,
    [bookingId],
  );

  return { ...booking, qr_code: qrUrl };
};

const getPaymentsByBooking = async (bookingId) => {
  const result = await pool.query(
    'SELECT id FROM payments WHERE booking_id = $1',
    [bookingId],
  );
  return result.rows;
};

const getLockedBookingForInvoice = async (bookingId) => {
  const result = await pool.query(
    `SELECT b.*, sv.price AS variant_price, s.price AS service_price, s.down_payment_amount, s.name AS service_name,
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

const extendHoldForPayment = async (bookingId) => {
  await pool.query(
    `UPDATE bookings
     SET expires_at = NOW() + INTERVAL '16 minutes'
     WHERE id = $1 AND booking_status = 'locked'`,
    [bookingId],
  );
};

const getPaymentById = async (paymentId) => {
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [
    paymentId,
  ]);
  return result.rows[0] || null;
};

module.exports = {
  getInvoicedPayment,
  saveInvoiceOnPayment,
  createPayment,
  confirmBooking,
  getPaymentsByBooking,
  getLockedBookingForInvoice,
  extendHoldForPayment,
  getPaymentById,
};
