//CONTROLLER
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const {
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
} = require('./queries');
const {
  sendBookingInProgressEmail,
  sendBookingDoneEmail,
  sendBookingPickedUpEmail,
} = require('../../shared/utils/email');

const getDashboardPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'views/dashboard.html'));
};

const getWalkinPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'views/walkin.html'));
};

const getScanPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'views/scan.html'));
};

const getMe = (req, res) => {
  if (!req.session?.user) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authenticated' });
  }
  res.json({ success: true, user: req.session.user });
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, redirect: '/auth/login' });
  });
};

const getBookingsToday = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const page = parseInt(req.query.page) || 1;
    const result = await getBookingsForDate(date, { page, limit: 5 });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Get bookings today error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const date = req.query.date || null;
    const result = await getUpcomingBookings({ page, limit: 5, date });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Get upcoming bookings error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const searchBooking = async (req, res) => {
  try {
    const { ref } = req.params;
    const booking = await getBookingByReferenceCode(ref);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error('Search booking error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const patchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const staffId = req.session.user.id;

    const allowed = ['in_progress', 'done', 'picked_up'];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid status' });
    }

    const booking = await getBookingById(id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    const validTransitions = {
      pending: ['in_progress'],
      in_progress: ['done'],
      done: ['picked_up'],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${booking.status} to ${status}`,
      });
    }

    const updated = await updateBookingStatus(id, status, staffId);
    await logBookingStatus(id, status, staffId);

    await logAudit({
      userId: staffId,
      action: `status_changed_to_${status}`,
      targetTable: 'bookings',
      targetId: id,
      details: `Booking ${booking.reference_code} marked as ${status}`,
    });

    const emailAddress = booking.guest_email || booking.customer_email;
    const emailName = booking.guest_name || booking.customer_name;
    const emailPayload = {
      email: emailAddress,
      name: emailName,
      referenceCode: booking.reference_code,
      queueNumber: booking.queue_number,
      serviceName: booking.service_name,
      variantName: booking.variant_name,
    };

    if (emailAddress) {
      try {
        if (status === 'in_progress')
          await sendBookingInProgressEmail(emailPayload);
        else if (status === 'done') await sendBookingDoneEmail(emailPayload);
        else if (status === 'picked_up')
          await sendBookingPickedUpEmail(emailPayload);
      } catch (emailErr) {
        console.error(`${status} email send failed:`, emailErr);
      }
    }

    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error('Patch status error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const patchVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId } = req.body;
    const staffId = req.session.user.id;

    const booking = await getBookingById(id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    const result = await updateVariant(id, variantId, staffId);
    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: 'Variant not found' });
    }

    await logAudit({
      userId: staffId,
      action: 'variant_updated',
      targetTable: 'bookings',
      targetId: id,
      details: `Variant changed on booking ${booking.reference_code}. New price: ${result.newPrice}, Remaining: ${result.remaining}`,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Patch variant error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const patchFullyPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.session.user.id;

    const booking = await getBookingById(id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    await markFullyPaid(id, staffId);

    await logAudit({
      userId: staffId,
      action: 'marked_fully_paid',
      targetTable: 'bookings',
      targetId: id,
      details: `Remaining balance collected for booking ${booking.reference_code}`,
    });

    res.json({ success: true, message: 'Booking marked as fully paid' });
  } catch (err) {
    console.error('Patch fully paid error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getServices = async (req, res) => {
  try {
    const services = await getAllActiveServices();
    res.json({ success: true, services });
  } catch (err) {
    console.error('Get services error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getVariants = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const variants = await getVariantsForService(serviceId);
    res.json({ success: true, variants });
  } catch (err) {
    console.error('Get variants error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getDateAvailability = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;
    if (!serviceId || !date) {
      return res
        .status(400)
        .json({ success: false, message: 'serviceId and date are required' });
    }
    const availability = await getAvailabilityForDate(serviceId, date);
    if (!availability || !availability.is_open) {
      return res.json({
        success: true,
        available: false,
        full: false,
        noSlot: true,
      });
    }
    const confirmed = parseInt(availability.confirmed_count);
    const remaining = availability.capacity - confirmed;
    return res.json({
      success: true,
      available: true,
      full: remaining <= 0,
      remaining,
      capacity: availability.capacity,
      confirmed,
    });
  } catch (err) {
    console.error('Get date availability error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

// returns bookings this staff personally marked as in_progress that are still in_progress
const getMyInProgress = async (req, res) => {
  try {
    const staffId = req.session.user.id;
    const bookings = await getMyInProgressBookings(staffId);
    res.json({ success: true, bookings });
  } catch (err) {
    console.error('Get my in progress error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

// returns who marked a booking as in_progress - used by frontend to show ownership warning
const getStartedBy = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await getInProgressStaff(id);
    res.json({ success: true, startedBy: staff || null });
  } catch (err) {
    console.error('Get started by error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const postWalkIn = async (req, res) => {
  try {
    const {
      serviceId,
      variantId,
      date,
      guestName,
      guestEmail,
      guestPhone,
      motorcyclePlate,
      motorcycleModel,
      motorcycleColor,
      motorcycleDescription,
    } = req.body;

    const staffId = req.session.user.id;

    if (!serviceId || !variantId || !date || !guestName || !motorcyclePlate) {
      return res.status(400).json({
        success: false,
        message: 'Service, variant, date, name, and plate are required',
      });
    }

    const availability = await getAvailabilityForDate(serviceId, date);
    if (!availability || !availability.is_open) {
      return res.status(400).json({
        success: false,
        message: 'No availability for this service on that date',
      });
    }

    const confirmed = parseInt(availability.confirmed_count);
    const todayStr = new Date().toISOString().split('T')[0];
    if (confirmed >= availability.capacity && date === todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Date is at full capacity',
        full: true,
      });
    }

    const queueNumber = await getNextQueueNumber(availability.id);
    const referenceCode =
      'HRC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrData = `${
      process.env.BASE_URL || 'http://localhost:3000'
    }/staff/scan/${referenceCode}`;
    const qrPath = `public/uploads/qr/${referenceCode}.png`;
    await QRCode.toFile(qrPath, qrData, { width: 300, margin: 2 });

    const booking = await createWalkInBooking({
      serviceId,
      variantId,
      availabilityId: availability.id,
      guestName,
      guestEmail,
      guestPhone,
      motorcyclePlate,
      motorcycleModel,
      motorcycleColor,
      motorcycleDescription,
      queueNumber,
      referenceCode,
      qrCode: `/uploads/qr/${referenceCode}.png`,
      staffId,
    });

    await logAudit({
      userId: staffId,
      action: 'walkin_created',
      targetTable: 'bookings',
      targetId: booking.id,
      details: `Walk-in booking created: ${referenceCode} for ${guestName}`,
    });

    res.json({
      success: true,
      message: 'Walk-in booking created',
      booking: {
        ...booking,
        referenceCode,
        queueNumber,
        qrCode: `/uploads/qr/${referenceCode}.png`,
      },
    });
  } catch (err) {
    console.error('Walk-in create error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const downloadSlip = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const filename = `slip-${booking.reference_code}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('HERCO DETAILING GARAGE', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text('Booking Reference Slip', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ccc');
    doc.moveDown(0.5);

    doc.fillColor('#000');
    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(`Reference: ${booking.reference_code}`, { align: 'center' });
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(`Queue No: ${booking.queue_number ?? '-'}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#eee');
    doc.moveDown(0.5);

    const field = (label, value) => {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#555')
        .text(label.toUpperCase(), { continued: false });
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#000')
        .text(value || '-');
      doc.moveDown(0.3);
    };

    field('Customer Name', booking.guest_name || booking.customer_name);
    field('Phone', booking.guest_phone || booking.customer_phone || '-');
    field('Service', booking.service_name);
    field('Variant', booking.variant_name);
    field(
      'Date',
      booking.booking_date
        ? new Date(booking.booking_date).toDateString()
        : '-',
    );
    field('Motorcycle Plate', booking.motorcycle_plate);
    field('Motorcycle Model', booking.motorcycle_model);
    field('Color', booking.motorcycle_color);

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#eee');
    doc.moveDown(0.5);

    field('Amount', `PHP ${parseFloat(booking.amount || 0).toFixed(2)}`);
    field(
      'Amount Paid',
      `PHP ${parseFloat(booking.amount_paid || 0).toFixed(2)}`,
    );
    field(
      'Remaining Balance',
      `PHP ${parseFloat(booking.remaining_balance || 0).toFixed(2)}`,
    );
    field('Payment Type', booking.payment_type?.toUpperCase());
    field('Payment Method', booking.payment_method?.toUpperCase());

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor('#999')
      .text(
        'This slip serves as proof of booking. Present upon drop-off and pickup.',
        { align: 'center' },
      );

    doc.end();
  } catch (err) {
    console.error('Download slip error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getBookingByIdHandler = async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (err) {
    console.error('Get booking by id error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const getDoneList = async (req, res) => {
  try {
    const bookings = await getDoneNotPickedUp();
    res.json({ success: true, bookings });
  } catch (err) {
    console.error('Get done list error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

module.exports = {
  getDashboardPage,
  getWalkinPage,
  getScanPage,
  getMe,
  logout,
  getBookingsToday,
  getUpcoming,
  searchBooking,
  patchStatus,
  patchVariant,
  patchFullyPaid,
  getServices,
  getVariants,
  getDateAvailability,
  getMyInProgress,
  getStartedBy,
  getBookingByIdHandler,
  postWalkIn,
  downloadSlip,
  getDoneList,
};
