// CUSTOMER ROUTES
const express = require('express');
const router = express.Router();
const path = require('path');
const { isCustomer } = require('../../shared/middlewares/auth');
const {
  getLoginPage,
  getRegisterPage,
  register,
  verifySignup,
  resendSignupCode,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require('./controller');
const {
  getAccountPage,
  getBookings,
  getBooking,
  updateProfile,
  requestEmailChange,
  verifyEmailChange,
  getLastBooking,
  changePassword,
} = require('./account.controller');

// STATIC ASSETS
router.get('/customer.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'customer.css'));
});

router.get('/customer-auth.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'customer-auth.js'));
});

router.get('/account.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'account.js'));
});

// PAGE ROUTES
router.get('/login', getLoginPage);
router.get('/register', getRegisterPage);
router.get('/account', isCustomer, getAccountPage);

// API ROUTES
router.post('/register', register);
router.post('/register/verify', verifySignup);
router.post('/register/resend', resendSignupCode);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getMe);
router.get('/bookings', isCustomer, getBookings);
router.get('/bookings/:referenceCode', isCustomer, getBooking);
router.patch('/profile', isCustomer, updateProfile);
router.patch('/email', isCustomer, requestEmailChange);
router.post('/email/verify', isCustomer, verifyEmailChange);
router.get('/last-booking', isCustomer, getLastBooking);
router.patch('/password', isCustomer, changePassword);
router.post('/password/forgot', forgotPassword);
router.post('/password/verify-otp', verifyOtp);
router.post('/password/reset', resetPassword);

module.exports = router;
