//ROUTES
const express = require('express');
const router = express.Router();
const path = require('path');
const { isStaff } = require('../../shared/middlewares/auth');
const {
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
} = require('./controller');

// STATIC ASSETS
router.get('/staff.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/staff.css'));
});
router.get('/scan.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/scan.js'));
});
router.get('/dashboard.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/dashboard.js'));
});
router.get('/walkin.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/walkin.js'));
});

// PAGE ROUTES
router.get('/', isStaff, (req, res) => res.redirect('/staff/dashboard'));
router.get('/dashboard', isStaff, getDashboardPage);
router.get('/scan/:ref', isStaff, getScanPage);
router.get('/walkin', isStaff, getWalkinPage);

// API ROUTES
router.get('/me', isStaff, getMe);
router.post('/logout', isStaff, logout);
router.get('/bookings', isStaff, getBookingsToday);
router.get('/bookings/upcoming', isStaff, getUpcoming);
router.get('/bookings/done', isStaff, getDoneList);
// mine must be above :ref to avoid wildcard collision
router.get('/bookings/mine', isStaff, getMyInProgress);
router.get('/bookings/detail/:id', isStaff, getBookingByIdHandler);
router.get('/bookings/:ref', isStaff, searchBooking);
router.patch('/bookings/:id/status', isStaff, patchStatus);
router.patch('/bookings/:id/variant', isStaff, patchVariant);
router.patch('/bookings/:id/paid', isStaff, patchFullyPaid);
// started-by must be above :id wildcard routes
router.get('/bookings/:id/started-by', isStaff, getStartedBy);
router.get('/services', isStaff, getServices);
router.get('/services/:serviceId/variants', isStaff, getVariants);
router.get('/services/:serviceId/availability', isStaff, getDateAvailability);
router.post('/walkin', isStaff, postWalkIn);
router.get('/slip/:id', isStaff, downloadSlip);

module.exports = router;
