// PAYMENT CONTROLLER
const { xenditPaymentRequestClient } = require('../../config/xendit');
const { sendBookingConfirmationEmail } = require('../../shared/utils/email');
const { confirmBooking } = require('../bookings/queries');
const {
  getLockedBookingForPayment,
  createPayment,
  getPaymentById,
  getBookingByPaymentId,
} = require('./queries');

const createGCashPayment = async (req, res) => {
  try {
    const { bookingId, paymentType } = req.body;

    if (!bookingId || !paymentType) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    const booking = await getLockedBookingForPayment(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already confirmed',
      });
    }

    const totalPrice = parseFloat(
      booking.variant_price || booking.service_price,
    );
    const amountPaid = paymentType === 'full' ? totalPrice : totalPrice * 0.5;

    const payment = await createPayment({
      bookingId,
      amount: totalPrice,
      amountPaid,
      paymentType,
    });

    const response = await xenditPaymentRequestClient.createPaymentRequest({
      data: {
        country: 'PH',
        currency: 'PHP',
        amount: amountPaid,
        referenceId: payment.id,
        paymentMethod: {
          type: 'EWALLET',
          reusability: 'ONE_TIME_USE',
          ewallet: {
            channelCode: 'GCASH',
            channelProperties: {
              successReturnUrl: `${process.env.APP_URL}/booking/success?external_id=${payment.id}`,
              failureReturnUrl: `${process.env.APP_URL}/booking/failed`,
            },
          },
        },
      },
    });

    const redirectAction = response.actions?.find(
      (action) => action.type === 'REDIRECT_CUSTOMER',
    );

    if (!redirectAction) {
      throw new Error('No redirect action returned from Xendit');
    }

    res.json({ success: true, redirectUrl: redirectAction.value });
  } catch (error) {
    console.error('Create GCash payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleWebhook = async (req, res) => {
  try {
    if (req.headers['x-callback-token'] !== process.env.XENDIT_WEBHOOK_TOKEN)
      return res.sendStatus(401);
    const { event, data } = req.body;

    if (event !== 'payment.capture' || data.status !== 'SUCCEEDED') {
      return res.json({ success: true });
    }

    const paymentId = data.reference_id;
    const payment = await getPaymentById(paymentId);

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    await confirmBooking({
      bookingId: payment.booking_id,
      xenditInvoiceId: data.payment_id,
    });

    const bookingDetails = await getBookingByPaymentId(paymentId);
    await sendBookingConfirmationEmail(bookingDetails);

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { external_id } = req.query;
    if (!external_id)
      return res
        .status(400)
        .json({ success: false, message: 'Missing external_id' });

    const booking = await getBookingByPaymentId(external_id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createGCashPayment,
  handleWebhook,
  getBookingDetails,
};
