// BOOKING CONTROLLER
const path = require('path');
const redis = require('../../config/redis');
const { incrementAbuseCounter } = require('../../shared/utils/cron');
const {
  getServiceById,
  getAvailableDates,
  lockSlot,
  releaseSlot,
  updateBookingDetails,
  getBookingByReferenceCode,
  getBookingSessionById,
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
    const ipAddress = req.ip;

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
    const session = await getBookingSessionById(bookingId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: session });
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
  getPublicTrackingPage,
  getPublicBookingDetails,
  getBookingSession,
};
