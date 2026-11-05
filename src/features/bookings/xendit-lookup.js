const { xenditInvoiceClient } = require('../../config/xendit');

const LOOKUP_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('xendit call timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const lookupInvoices = async (paymentId) =>
  withTimeout(
    xenditInvoiceClient.getInvoices({ externalId: paymentId }),
    LOOKUP_TIMEOUT_MS,
  );

const expireInvoice = async (invoiceId) =>
  withTimeout(
    xenditInvoiceClient.expireInvoice({ invoiceId }),
    LOOKUP_TIMEOUT_MS,
  );

module.exports = { lookupInvoices, expireInvoice };
