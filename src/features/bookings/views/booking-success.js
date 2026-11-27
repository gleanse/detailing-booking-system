// Hard CODED FOR NOW business hours: Morning 8AM-11AM, Afternoon 1PM-4PM
function getRecommendedArrival(queueNumber, totalBookings) {
  const morningCount = Math.ceil(totalBookings / 2);
  if (queueNumber <= morningCount) {
    return { block: 'Morning Block', time: '8:00AM – 11:00AM' };
  }
  return { block: 'Afternoon Block', time: '1:00PM – 4:00PM' };
}

const params = new URLSearchParams(window.location.search);
const externalId = params.get('external_id');

// payment ids are uuids, anything else is a wrong link and not a failure to wait out
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadBookingDetails(quiet = false) {
  if (!externalId || !UUID_PATTERN.test(externalId)) {
    document.getElementById('loadingCard').classList.add('hidden');
    document.getElementById('errorCard').classList.remove('hidden');
    return;
  }

  try {
    let res;
    try {
      res = await fetch(`/api/booking/details?external_id=${externalId}`);
    } catch {
      // a connection failure is not an answer about the booking so keep waiting
      return 'pending';
    }
    // a server failure is not an answer either
    if (res.status >= 500) return 'pending';
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    const b = data.data;

    // webhook has not confirmed the booking yet so the caller keeps waiting
    if (b.queue_number === null) {
      pendingBooking = b;
      return 'pending';
    }

    // booking details
    document.getElementById('referenceCode').textContent = b.reference_code;
    document.getElementById('queueNumber').textContent = `#${b.queue_number}`;
    document.getElementById('serviceName').textContent = b.variant_name
      ? `${b.service_name} - ${b.variant_name}`
      : b.service_name;
    const [year, month, day] = b.booking_date.split('-');
    document.getElementById('bookingDate').textContent = new Date(
      year,
      month - 1,
      day,
    ).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    document.getElementById('guestName').textContent = b.guest_name;
    document.getElementById('downPaymentLabel').textContent = 'Down Payment';
    document.getElementById('amountPaid').textContent = `₱${parseFloat(
      b.amount_paid,
    ).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    // remaining balance
    if (!b.is_fully_paid && b.remaining_balance > 0) {
      const formatted = `₱${parseFloat(b.remaining_balance).toLocaleString(
        'en-PH',
        { minimumFractionDigits: 2 },
      )}`;
      document.getElementById('remainingRow').classList.remove('hidden');
      document.getElementById('remainingRow').classList.add('flex');
      document.getElementById('remainingBalance').textContent = formatted;
      // show remaining in what's next
      document.getElementById('remainingNextItem').classList.remove('hidden');
      document.getElementById('remainingNextItem').classList.add('flex');
      document.getElementById('remainingNextAmount').textContent = formatted;
    }

    // QR code
    if (b.qr_code) {
      document.getElementById('qrCode').src = b.qr_code;
      document.getElementById('qrContainer').classList.remove('hidden');
      document.getElementById('qrContainer').classList.add('flex');
    }

    // recommended arrival
    const total = parseInt(b.date_capacity) || 10;
    const arrival = getRecommendedArrival(b.queue_number, total);
    document.getElementById('arrivalBlock').textContent = arrival.block;
    document.getElementById('arrivalTime').textContent = arrival.time;

    // show main content
    document.getElementById('loadingCard').classList.add('hidden');
    document.getElementById('pendingCard').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('grid');
  } catch (err) {
    console.error(err);
    if (quiet) return 'pending';
    document.getElementById('loadingCard').classList.add('hidden');
    document.getElementById('errorCard').classList.remove('hidden');
  }
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 60000;
const LATE_POLL_INTERVAL_MS = 10000;
const LATE_POLL_MAX_MS = 10 * 60 * 1000;

let pendingBooking = null;

const STATUS_LINES = [
  'Confirming your payment',
  'Waiting for payment confirmation',
  'Checking with our server',
  'Almost there',
];
const STATUS_INTERVAL_MS = 3000;

let statusTimer = null;

function showConfirming() {
  if (statusTimer) return;

  document.getElementById('loadingSpinner').classList.add('hidden');
  document.getElementById('loadingText').classList.add('hidden');
  const block = document.getElementById('confirmingBlock');
  block.classList.remove('hidden');
  block.classList.add('flex');

  const bar = document.getElementById('confirmingBar');
  bar.style.transition = `width ${POLL_MAX_MS}ms linear`;
  // force a reflow so the width change animates
  void bar.offsetWidth;
  bar.style.width = '100%';

  const status = document.getElementById('confirmingStatus');
  let index = 0;
  statusTimer = setInterval(() => {
    status.style.opacity = 0;
    setTimeout(() => {
      index = (index + 1) % STATUS_LINES.length;
      status.textContent = STATUS_LINES[index];
      status.style.opacity = 1;
    }, 300);
  }, STATUS_INTERVAL_MS);
}

function stopConfirming() {
  clearInterval(statusTimer);
  statusTimer = null;
}

function showDelayed() {
  document.getElementById('loadingCard').classList.add('hidden');
  document.getElementById('pendingPaymentId').textContent = externalId;
  const who = [pendingBooking?.guest_name, pendingBooking?.guest_email]
    .filter(Boolean)
    .join(' - ');
  if (who) {
    const el = document.getElementById('pendingWho');
    el.textContent = who;
    el.classList.remove('hidden');
  }
  const pending = document.getElementById('pendingCard');
  pending.classList.remove('hidden');
  pending.classList.add('flex');
}

async function waitForConfirmation() {
  const startedAt = Date.now();
  let delayed = false;

  while (true) {
    const result = await loadBookingDetails(pendingBooking !== null);
    if (result !== 'pending') {
      stopConfirming();
      return;
    }

    const elapsed = Date.now() - startedAt;

    if (delayed && elapsed >= LATE_POLL_MAX_MS) return;

    if (!delayed && elapsed >= POLL_MAX_MS) {
      stopConfirming();
      showDelayed();
      delayed = true;
    } else if (!delayed) {
      showConfirming();
    }

    await new Promise((resolve) =>
      setTimeout(resolve, delayed ? LATE_POLL_INTERVAL_MS : POLL_INTERVAL_MS),
    );
  }
}

waitForConfirmation();
