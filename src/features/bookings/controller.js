// BOOKING CONTROLLER
const path = require('path');
const pool = require('../../config/database');
const { xenditInvoiceClient } = require('../../config/xendit');
const redis = require('../../config/redis');
const { incrementAbuseCounter } = require('../../shared/utils/cron');
const { confirmPaidBooking } = require('./confirm');
const { cancelHeldBooking } = require('./cancel');
const { signBookingToken, hasValidBookingToken } = require('./booking-token');
const { markLeaving, clearLeaving } = require('./leaving');
const {
  getServiceById,
  getAvailableDates,
  MAX_USER_HOLDS,
  lockSlot,
  releaseSlot,
  getHeldBookingWithPayment,
  getUnpaidHeldBooking,
  expireHeldBooking,
  updateBookingDetails,
  createPayment,
  getInvoicedPayment,
  saveInvoiceOnPayment,
  getBookingByPaymentId,
  getBookingByReferenceCode,
} = require('./queries');

const getBookingPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'booking.html'));
};
const getPublicTrackingPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'booking-track.html'));
};

const getServiceDetails = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const service = await getServiceById(serviceId);

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, data: service });
  } catch (error) {
    console.error('Get service details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAvailability = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const dates = await getAvailableDates(serviceId);
    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// turns the seconds left on a block into the shortest natural wording
const formatWait = (seconds) => {
  const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  return parts.join(' ');
};
const notAllowed = {
  success: false,
  message:
    'This reservation could not be verified. Please refresh the page and start again.',
};

const lockBookingSlot = async (req, res) => {
  try {
    const { availabilityId, serviceId, variantId } = req.body;
    const userId = req.session?.user?.id || null;
    const ipAddress = req.ip;

    if (!availabilityId || !serviceId) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    // guests are blocked by network, logged in customers by their own account
    const ipBlocked = userId ? null : await redis.get(`block:ip:${ipAddress}`);
    if (ipBlocked) {
      const ttl = await redis.ttl(`block:ip:${ipAddress}`);
      return res.status(429).json({
        success: false,
        blocked: true,
        message: `Too many cancelled or unused reservations. You are blocked from booking for ${formatWait(ttl)}.`,
      });
    }

    // check if logged in user is blocked
    if (userId) {
      const userBlocked = await redis.get(`block:user:${userId}`);
      if (userBlocked) {
        const ttl = await redis.ttl(`block:user:${userId}`);
        return res.status(429).json({
          success: false,
          blocked: true,
          message: `Too many cancelled or unused reservations. You are blocked from booking for ${formatWait(ttl)}.`,
        });
      }
    }

    const booking = await lockSlot({
      availabilityId,
      serviceId,
      variantId,
      userId,
      ipAddress,
    });
    res.json({
      success: true,
      data: booking,
      bookingToken: signBookingToken(booking.id),
    });
  } catch (error) {
    // someone else took the last place, tell the page so it can reload the dates
    if (error.code === 'SLOT_FULL') {
      return res.status(409).json({
        success: false,
        full: true,
        message: 'This date is already full. Please choose another date.',
      });
    }

    if (error.code === 'HOLD_LIMIT') {
      return res.status(429).json({
        success: false,
        holdLimit: true,
        message:
          error.scope === 'user'
            ? `You already have ${MAX_USER_HOLDS} reservations in progress. Please finish one, or wait up to 10 minutes for an unused one to expire.`
            : 'Too many reservations are in progress from your network right now. Please try again in a few minutes.',
      });
    }

    console.error('Lock slot error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const releaseBookingSlot = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing bookingId' });
    }

    if (!hasValidBookingToken(bookingId, req.body.bookingToken)) {
      return res.status(403).json(notAllowed);
    }

    let booking;
    const held = await getHeldBookingWithPayment(bookingId);

    if (held) {
      // the customer may still pay an open invoice, so settle it with xendit first
      const result = await cancelHeldBooking(bookingId);

      if (result.outcome === 'confirmed') {
        return res.json({
          success: true,
          confirmed: true,
          paymentId: result.paymentId,
        });
      }

      if (result.outcome === 'refused') {
        return res.status(409).json({
          success: false,
          paymentStarted: true,
          message:
            'We could not reach our payment provider to cancel your payment, so your reservation cannot be cancelled right now. Please try again in a moment. If you leave it, it will be released automatically when the payment window ends.',
        });
      }

      booking = (await expireHeldBooking(bookingId)) ? held : null;
    } else {
      booking = await releaseSlot(bookingId);
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already released',
      });
    }

    await incrementAbuseCounter(booking.ip_address, booking.user_id);

    // get current abuse count to warn user, logged in customers are counted by account
    const abuseKey = booking.user_id
      ? `abuse:user:${booking.user_id}`
      : `abuse:ip:${booking.ip_address}`;
    const currentCount = await redis.get(abuseKey);

    res.json({
      success: true,
      data: booking,
      abuseCount: parseInt(currentCount) || 0,
    });
  } catch (error) {
    console.error('Release slot error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!hasValidBookingToken(bookingId, req.body?.bookingToken)) {
      return res.status(403).json(notAllowed);
    }
    const {
      guestName,
      guestEmail,
      guestPhone,
      motorcyclePlate,
      motorcycleModel,
      motorcycleColor,
      motorcycleDescription,
    } = req.body;

    // server-side field validation
    const fieldErrors = {};

    if (!guestName || guestName.trim().length < 2) {
      fieldErrors.guestName = !guestName
        ? 'Full name is required.'
        : 'Name must be at least 2 characters.';
    }

    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      fieldErrors.guestEmail = !guestEmail
        ? 'Email address is required.'
        : 'Enter a valid email address.';
    }

    if (!guestPhone) {
      fieldErrors.guestPhone = 'Phone number is required.';
    } else if (!/^09\d{9}$/.test(guestPhone.trim())) {
      fieldErrors.guestPhone = 'Enter a valid PH number (09XXXXXXXXX).';
    }

    if (!motorcyclePlate || !motorcyclePlate.trim()) {
      fieldErrors.motorcyclePlate = 'Plate number is required.';
    }

    if (!motorcycleModel || !motorcycleModel.trim()) {
      fieldErrors.motorcycleModel = 'Motorcycle model is required.';
    }

    if (!motorcycleColor || !motorcycleColor.trim()) {
      fieldErrors.motorcycleColor = 'Motorcycle color is required.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        fields: fieldErrors,
      });
    }

    const booking = await updateBookingDetails(bookingId, {
      guestName,
      guestEmail,
      guestPhone,
      motorcyclePlate,
      motorcycleModel,
      motorcycleColor,
      motorcycleDescription,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already confirmed',
      });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

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

const getBookingDetails = async (req, res) => {
  try {
    const { external_id } = req.query;
    if (!external_id)
      return res
        .status(400)
        .json({ success: false, message: 'Missing external_id' });

    const booking = await getBookingByPaymentId(external_id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPublicBookingDetails = async (req, res) => {
  try {
    const { referenceCode } = req.params;
    const booking = await getBookingByReferenceCode(referenceCode);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get public booking details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await pool.query(
      `SELECT booking_status, expires_at FROM bookings WHERE id = $1`,
      [bookingId],
    );

    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get booking session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// the page is closing, mark the hold so the cron can free it unless the customer comes back
const markBookingLeaving = async (req, res) => {
  try {
    const { bookingId, bookingToken } = req.body || {};

    if (!bookingId || !hasValidBookingToken(bookingId, bookingToken)) {
      return res.status(403).json(notAllowed);
    }

    // a hold with a payment is never marked, xendit decides what happens to it
    const held = await getUnpaidHeldBooking(bookingId);
    if (held) await markLeaving(bookingId);

    res.status(204).end();
  } catch (error) {
    console.error('Mark leaving error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
};

// the customer is back on the page, so the hold is not abandoned
const keepBooking = async (req, res) => {
  try {
    const { bookingId, bookingToken } = req.body || {};

    if (!bookingId || !hasValidBookingToken(bookingId, bookingToken)) {
      return res.status(403).json(notAllowed);
    }

    await clearLeaving(bookingId);
    res.status(204).end();
  } catch (error) {
    console.error('Keep booking error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
};

module.exports = {
  getBookingPage,
  getServiceDetails,
  getAvailability,
  lockBookingSlot,
  releaseBookingSlot,
  updateBooking,
  createInvoice,
  handleWebhook,
  getBookingDetails,
  getPublicTrackingPage,
  getPublicBookingDetails,
  getBookingSession,
  markBookingLeaving,
  keepBooking,
};
