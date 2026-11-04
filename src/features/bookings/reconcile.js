const { xenditInvoiceClient } = require('../../config/xendit');
const {
  getHeldBookingsWithPayments,
  getPaymentsByBooking,
  expireHeldBooking,
} = require('./queries');
const { confirmPaidBooking } = require('./confirm');

const LOOKUP_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('xendit lookup timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// decides one held booking from what xendit says about each of its payments
const reconcileBooking = async (booking, onExpired) => {
  const bookingId = booking.id;
  const payments = await getPaymentsByBooking(bookingId);

  let paid = null;
  let allExpired = true;
  let sawInvoice = false;

  for (const payment of payments) {
    let invoices;
    try {
      invoices = await withTimeout(
        xenditInvoiceClient.getInvoices({ externalId: payment.id }),
        LOOKUP_TIMEOUT_MS,
      );
    } catch (error) {
      // a failed lookup is unknown, never expired
      console.error('[RECONCILE] lookup failed:', payment.id, error.message);
      allExpired = false;
      continue;
    }

    const list = invoices || [];
    const hit = list.find((i) => i.status === 'PAID' || i.status === 'SETTLED');
    if (hit) {
      paid = { paymentId: payment.id, invoiceId: hit.id };
      break;
    }

    // an empty list means no invoice was ever created for this payment
    if (list.length > 0) sawInvoice = true;
    if (!list.every((i) => i.status === 'EXPIRED')) allExpired = false;
  }

  if (paid) {
    await confirmPaidBooking({
      bookingId,
      paymentId: paid.paymentId,
      xenditInvoiceId: paid.invoiceId,
    });
    return 'confirmed';
  }

  if (allExpired) {
    const freed = await expireHeldBooking(bookingId);
    if (!freed) return 'skipped';

    // a real checkout that expired is abandonment, no invoice at all is not the customer's fault
    if (sawInvoice && onExpired) {
      await onExpired(booking.ip_address, booking.user_id);
    }
    return 'expired';
  }

  return 'waiting';
};

const reconcileHeldBookings = async ({ onExpired } = {}) => {
  const held = await getHeldBookingsWithPayments();
  const summary = {
    confirmed: 0,
    expired: 0,
    waiting: 0,
    skipped: 0,
    failed: 0,
  };

  for (const booking of held) {
    try {
      summary[await reconcileBooking(booking, onExpired)]++;
    } catch (error) {
      summary.failed++;
      console.error('[RECONCILE] booking failed:', booking.id, error.message);
    }
  }

  return summary;
};

module.exports = { reconcileHeldBookings };
