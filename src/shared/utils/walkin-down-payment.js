const { todayInManila } = require('./date');

const resolveWalkInDownPayment = ({ bookingDate, downPayment, totalPrice }) => {
  const isFutureDate = bookingDate > todayInManila();
  const hasValue =
    downPayment !== undefined &&
    downPayment !== null &&
    String(downPayment).trim() !== '';
  const amount = hasValue ? parseFloat(downPayment) : 0;

  if (hasValue && (isNaN(amount) || amount <= 0)) {
    return {
      error: 'Down payment must be greater than 0, or leave it empty for none',
    };
  }
  if (isFutureDate && amount <= 0) {
    return { error: 'A down payment is required when booking a future date' };
  }
  if (amount > totalPrice) {
    return {
      error: `Down payment cannot be higher than the estimated price (${totalPrice})`,
    };
  }

  return { amountPaid: amount };
};

module.exports = { resolveWalkInDownPayment };
