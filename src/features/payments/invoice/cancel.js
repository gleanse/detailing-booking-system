const { getPaymentsByBooking } = require('./queries');
const { confirmPaidBooking } = require('./confirm');
const { lookupInvoices, expireInvoice } = require('./xendit-lookup');

const isPaid = (found) =>
  found.invoice.status === 'PAID' || found.invoice.status === 'SETTLED';
const isPending = (found) => found.invoice.status === 'PENDING';
const isExpired = (found) => found.invoice.status === 'EXPIRED';

// reads every invoice of the booking and throws when xendit does not answer
const readInvoices = async (payments) => {
  const found = [];
  for (const payment of payments) {
    const invoices = await lookupInvoices(payment.id);
    for (const invoice of invoices || []) {
      found.push({ paymentId: payment.id, invoice });
    }
  }
  return found;
};

const expirePending = async (found) => {
  for (const { invoice } of found.filter(isPending)) {
    try {
      await expireInvoice(invoice.id);
    } catch (error) {
      // the next read shows whether it is still open or was paid a moment ago
      console.error('[CANCEL] expire failed:', invoice.id, error.message);
    }
  }
};

// settles every invoice of a held booking with xendit before the booking is released
const cancelHeldBooking = async (bookingId) => {
  const payments = await getPaymentsByBooking(bookingId);

  let found;
  try {
    found = await readInvoices(payments);
    if (!found.some(isPaid) && found.some(isPending)) {
      await expirePending(found);
      found = await readInvoices(payments);
    }
  } catch (error) {
    console.error('[CANCEL] xendit not answering:', error.message);
    return { outcome: 'refused' };
  }

  const paid = found.find(isPaid);
  if (paid) {
    await confirmPaidBooking({
      bookingId,
      paymentId: paid.paymentId,
      xenditInvoiceId: paid.invoice.id,
    });
    return { outcome: 'confirmed', paymentId: paid.paymentId };
  }

  // anything that is not expired may still take a payment, so the booking stays
  if (!found.every(isExpired)) return { outcome: 'refused' };

  return { outcome: 'released' };
};

module.exports = { cancelHeldBooking };
