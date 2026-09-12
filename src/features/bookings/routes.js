// BOOKING ROUTES
const express = require('express');
const path = require('path');
const router = express.Router();
const {
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
} = require('./controller');

// STATIC assets
router.get('/booking.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking.js'));
});
router.get('/details', getBookingDetails);
router.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking-success.html'));
});
router.get('/failed', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking-failed.html'));
});
router.get('/booking-track.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking-track.js'));
});
router.get('/booking-success.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'booking-success.js'));
});

// public tracking - must be BEFORE /:serviceId wildcard
router.get('/public/:referenceCode', getPublicTrackingPage);

// API routes
router.get('/public/:referenceCode/details', getPublicBookingDetails);
router.get('/session/:bookingId', getBookingSession);
router.get('/service/:serviceId', getServiceDetails);
router.get('/availability/:serviceId', getAvailability);
router.post('/lock', lockBookingSlot);
router.patch('/release', releaseBookingSlot);
router.post('/release', releaseBookingSlot);
router.post('/pay', createInvoice);
router.post('/webhook', handleWebhook);
router.patch('/:bookingId', updateBooking);

// PAGE route
router.get('/:serviceId', getBookingPage);

module.exports = router;
