const { confirmBooking, getBookingByPaymentId } = require('./queries');
const { sendBookingConfirmationEmail } = require('../../shared/utils/email');

// confirms a paid booking and sends the email once, shared by the webhook and the reconcile job
const confirmPaidBooking = async ({
  bookingId,
  paymentId,
  xenditInvoiceId,
}) => {
  const confirmed = await confirmBooking({ bookingId, xenditInvoiceId });

  // an earlier delivery already confirmed it, so skip the email
  if (!confirmed) return false;

  // a failed email must not fail the caller, xendit would retry the webhook
  try {
    const bookingDetails = await getBookingByPaymentId(paymentId);
    await sendBookingConfirmationEmail(bookingDetails);
  } catch (emailError) {
    console.error('Confirmation email error:', emailError);
  }

  return true;
};

module.exports = { confirmPaidBooking };
