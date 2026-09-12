// BOOKING CONTROLLER
const path = require('path');
const pool = require('../../config/database');
const { xenditInvoiceClient } = require('../../config/xendit');
const redis = require('../../config/redis');
const { incrementAbuseCounter } = require('../../shared/utils/cron');
const { sendBookingConfirmationEmail } = require('../../shared/utils/email');
const {
  getServiceById,
  getAvailableDates,
  lockSlot,
  releaseSlot,
  updateBookingDetails,
  createPayment,
  confirmBooking,
  getBookingByPaymentId,
  getBookingByReferenceCode,
} = require('./queries');

const getBookingPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking.html'));
};
const getPublicTrackingPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking-track.html'));
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

const lockBookingSlot = async (req, res) => {
  try {
    const { availabilityId, serviceId, variantId } = req.body;
    const userId = req.session?.user?.id || null;
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress;

    if (!availabilityId || !serviceId) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    // check if IP is blocked
    const ipBlocked = await redis.get(`block:ip:${ipAddress}`);
    if (ipBlocked) {
      const ttl = await redis.ttl(`block:ip:${ipAddress}`);
      const minutes = Math.ceil(ttl / 60);
      return res.status(429).json({
        success: false,
        blocked: true,
        message: `Too many cancelled bookings. You are blocked for ${minutes} more minute(s).`,
      });
    }

    // check if logged in user is blocked
    if (userId) {
      const userBlocked = await redis.get(`block:user:${userId}`);
      if (userBlocked) {
        const ttl = await redis.ttl(`block:user:${userId}`);
        const minutes = Math.ceil(ttl / 60);
        return res.status(429).json({
          success: false,
          blocked: true,
          message: `Too many cancelled bookings. You are blocked for ${minutes} more minute(s).`,
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
    res.json({ success: true, data: booking });
  } catch (error) {
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

    const booking = await releaseSlot(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already released',
      });
    }

    await incrementAbuseCounter(booking.ip_address, booking.user_id);

    // get current abuse count to warn user
    const ipKey = `abuse:ip:${booking.ip_address}`;
    const currentCount = await redis.get(ipKey);

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
    const { bookingId, paymentType } = req.body;

    if (!bookingId || !paymentType) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    // get booking details
    const bookingResult = await pool.query(
      `SELECT b.*, sv.price AS variant_price, s.price AS service_price, s.name AS service_name,
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
    const amountPaid = paymentType === 'full' ? totalPrice : totalPrice * 0.5;
    const email = booking.guest_email || booking.user_email;

    // create payment record
    const payment = await createPayment({
      bookingId,
      amount: totalPrice,
      amountPaid,
      paymentType,
    });

    // create xendit invoice
    const invoice = await xenditInvoiceClient.createInvoice({
      data: {
        externalId: payment.id,
        amount: amountPaid,
        payerEmail: email,
        description: `${booking.service_name} - ${
          booking.variant_name || 'Standard'
        } (${paymentType === 'full' ? 'Full Payment' : '50% Down Payment'})`,
        successRedirectUrl: `${process.env.APP_URL}/booking/success?external_id=${payment.id}`,
        failureRedirectUrl: `${process.env.APP_URL}/booking/failed`,
        currency: 'PHP',
      },
    });

    res.json({ success: true, invoiceUrl: invoice.invoiceUrl });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleWebhook = async (req, res) => {
  try {
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
    await confirmBooking({ bookingId: payment.booking_id, xenditInvoiceId });

    // fetch full booking details then send confirmation email
    const bookingDetails = await getBookingByPaymentId(external_id);
    await sendBookingConfirmationEmail(bookingDetails);

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
};
