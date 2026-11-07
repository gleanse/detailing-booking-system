// T6 the hold must outlast the xendit invoice, otherwise a customer could pay for a slot that was freed
// reads the controller source, no database needed
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../src/features/bookings/controller.js'),
  'utf8',
);

const invoiceSeconds = Number(/invoiceDuration:\s*(\d+)/.exec(source)?.[1]);
const holdMinutes = Number(
  /SET expires_at = NOW\(\) \+ INTERVAL '(\d+) minutes'/.exec(source)?.[1],
);

const invoiceMinutes = invoiceSeconds / 60;
console.log(
  `invoice lasts ${invoiceMinutes} minutes, hold lasts ${holdMinutes}`,
);

const ok =
  Number.isFinite(invoiceMinutes) &&
  Number.isFinite(holdMinutes) &&
  holdMinutes > invoiceMinutes;

console.log(
  ok
    ? 'PASS  the hold outlasts the invoice'
    : 'FAIL  the hold must be longer than the invoice',
);
process.exit(ok ? 0 : 1);
