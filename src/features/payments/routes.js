// PAYMENT ROUTES
const express = require('express');
const router = express.Router();
const {
  createGCashPayment,
  handleWebhook,
  getBookingDetails,
} = require('./controller');

router.post('/gcash', createGCashPayment);
router.get('/details', getBookingDetails);
router.post('/webhook', handleWebhook);

module.exports = router;
