// INVOICE ROUTES
const express = require('express');
const router = express.Router();
const { createInvoice, handleWebhook } = require('./controller');

router.post('/pay', createInvoice);
router.post('/webhook', handleWebhook);

module.exports = router;
