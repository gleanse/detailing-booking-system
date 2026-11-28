const pool = require('../../../config/database');
const { xenditInvoiceClient } = require('../../../config/xendit');
const { confirmPaidBooking } = require('./confirm');
const {
  hasValidBookingToken,
  notAllowed,
} = require('../../bookings/booking-token');
const {
  createPayment,
  getInvoicedPayment,
  saveInvoiceOnPayment,
} = require('./queries');

const createInvoice = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    if (!hasValidBookingToken(bookingId, req.body.bookingToken)) {
      return res.status(403).json(notAllowed);
    }

    // get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, sv.price AS variant_price, s.price AS service_price, s.down_payment_amount, s.name AS service_name,
              sv.name AS variant_name, u.email AS user_email, b.guest_email
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN service_variants sv ON sv.id = b.variant_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 AND b.booking_status = 'locked'`,
      [bookingId],
    );

    if (!bookingResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already confirmed',
      });
    }

    const booking = bookingResult.rows[0];
    const totalPrice = parseFloat(
      booking.variant_price || booking.service_price,
    );
    const amountPaid = Math.min(
      parseFloat(booking.down_payment_amount),
      totalPrice,
    );
    const email = booking.guest_email || booking.user_email;

    // a second press inside the window gets the same checkout, after it the payment window is over
    const existing = await getInvoicedPayment(bookingId);
    if (existing) {
      if (existing.status === 'unpaid' && existing.within_window) {
        return res.json({
          success: true,
          invoiceUrl: existing.invoice_url,
          paymentId: existing.id,
          reused: true,
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Your payment window has ended. Please start a new booking.',
      });
    }

    // create payment record
    const payment = await createPayment({
      bookingId,
      amount: totalPrice,
      amountPaid,
    });

    // create xendit invoice
    const invoice = await xenditInvoiceClient.createInvoice({
      data: {
        externalId: payment.id,
        amount: amountPaid,
        payerEmail: email,
        description: `${booking.service_name} - ${
          booking.variant_name || 'Standard'
        } (Down Payment)`,
        successRedirectUrl: `${process.env.APP_URL}/booking/success?external_id=${payment.id}`,
        failureRedirectUrl: `${process.env.APP_URL}/booking/failed`,
        currency: 'PHP',
        invoiceDuration: 900,
      },
    });

    await saveInvoiceOnPayment({
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
    });

    // payment started so push the hold out, the invoice stops taking payment a minute before it ends
    await pool.query(
      `UPDATE bookings
       SET expires_at = NOW() + INTERVAL '16 minutes'
       WHERE id = $1 AND booking_status = 'locked'`,
      [bookingId],
    );

    res.json({
      success: true,
      invoiceUrl: invoice.invoiceUrl,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const token = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!token || req.headers['x-callback-token'] !== token)
      return res.sendStatus(401);

    const { external_id, status, id: xenditInvoiceId } = req.body;

    if (status !== 'PAID') {
      return res.json({ success: true });
    }

    // external_id is the payment id
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [external_id],
    );

    if (!paymentResult.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    await confirmPaidBooking({
      bookingId: payment.booking_id,
      paymentId: external_id,
      xenditInvoiceId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createInvoice, handleWebhook };
