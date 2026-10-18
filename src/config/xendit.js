const { Xendit, PaymentRequest: PaymentRequestClient } = require('xendit-node');

const xenditClient = new Xendit({
  secretKey: process.env.XENDIT_SECRET_KEY,
});

const xenditPaymentRequestClient = new PaymentRequestClient({
  secretKey: process.env.XENDIT_SECRET_KEY,
});

module.exports = { xenditClient, xenditPaymentRequestClient };
