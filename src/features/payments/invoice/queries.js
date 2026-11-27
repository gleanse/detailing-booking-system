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

module.exports = {
  getInvoicedPayment,
  saveInvoiceOnPayment,
  createPayment,
  confirmBooking,
  getPaymentsByBooking,
};
