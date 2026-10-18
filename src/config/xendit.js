const { PaymentRequest: PaymentRequestClient } = require('xendit-node');

const xenditPaymentRequestClient = new PaymentRequestClient({
  secretKey: process.env.XENDIT_SECRET_KEY,
});

module.exports = { xenditPaymentRequestClient };
