const ACTIVE_STATUSES = ['pending', 'in_progress', 'done'];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPrice(price) {
  return (
    '₱' +
    parseFloat(price).toLocaleString('en-PH', { minimumFractionDigits: 2 })
  );
}

function statusBadge(status) {
  const map = {
    pending: {
      label: 'Pending',
      color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    },
    in_progress: {
      label: 'In Progress',
      color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    done: {
      label: 'Done',
      color: 'bg-green-500/10 text-green-400 border border-green-500/20',
    },
    picked_up: {
      label: 'Picked Up',
      color: 'bg-white/10 text-white/50 border border-white/10',
    },
  };
  const s = map[status] || {
    label: status,
    color: 'bg-white/10 text-white/50 border border-white/10',
  };
  return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}">${s.label}</span>`;
}

function renderActiveBooking(b) {
  const isDownPayment = !b.is_fully_paid && b.remaining_balance > 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = b.booking_date.split('-');
  const bookingDate = new Date(y, m - 1, d);
  const isToday = bookingDate.getTime() === today.getTime();

  const badge =
    b.status === 'pending' && !isToday
      ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Confirmed</span>`
      : statusBadge(b.status);

  return `
        <div class="bg-[#111] border border-red-500/20 rounded-2xl p-5 cursor-pointer hover:border-red-500/40 transition-all duration-200 booking-card" data-ref="${
          b.reference_code
        }">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <p class="text-white font-semibold">${b.service_name}</p>
              <p class="text-white/40 text-xs mt-0.5">${
                b.variant_name ? b.variant_name + ' · ' : ''
              }${formatDate(b.booking_date)}</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              ${badge}
              ${
                isDownPayment
                  ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Balance Due</span>`
                  : ''
              }
            </div>
          </div>
          <div class="flex items-center justify-between text-xs text-white/40 border-t border-white/5 pt-3 flex-wrap gap-2">
            <span class="flex items-center gap-1.5"><i class="ph ph-hash"></i> Queue #${
              b.queue_number
            }</span>
            <span class="flex items-center gap-1.5"><i class="ph ph-barcode"></i> ${
              b.reference_code
            }</span>
            ${
              isDownPayment
                ? `<span class="text-yellow-400 flex items-center gap-1.5"><i class="ph ph-warning"></i> ${formatPrice(
                    b.remaining_balance,
                  )} due</span>`
                : ''
            }
          </div>
        </div>
      `;
}

function renderHistoryBooking(b) {
  const isExpired = b.booking_status === 'expired';
  const badge = isExpired
    ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Expired</span>`
    : statusBadge(b.status);
  return `
        <div class="bg-[#111] border border-white/6 rounded-2xl p-4 ${
          isExpired
            ? 'opacity-50 cursor-default'
            : 'cursor-pointer hover:border-white/14 booking-card'
        } transition-all duration-200" ${
          !isExpired ? `data-ref="${b.reference_code}"` : ''
        }>
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-white/80 font-medium text-sm">${b.service_name}</p>
              <p class="text-white/30 text-xs mt-0.5">${
                b.variant_name ? b.variant_name + ' · ' : ''
              }${formatDate(b.booking_date)}</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              ${badge}
            </div>
          </div>
        </div>
      `;
}

function renderStatusTimeline(logs) {
  const steps = ['confirmed', 'in_progress', 'done', 'picked_up'];
  const stepLabels = {
    confirmed: 'Booking Confirmed',
    in_progress: 'Service In Progress',
    done: 'Service Complete',
    picked_up: 'Motorcycle Picked Up',
  };
  const completedSet = new Set(logs.map((l) => l.status));

  return steps
    .map((step, i) => {
      const done = completedSet.has(step);
      const log = logs.find((l) => l.status === step);
      const isLast = i === steps.length - 1;
      return `
          <div class="flex gap-3">
            <div class="flex flex-col items-center">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-red-500' : 'bg-white/5 border border-white/10'
              }">
                <i class="ph ph-check text-white text-xs ${
                  done ? '' : 'opacity-0'
                }"></i>
              </div>
              ${
                !isLast
                  ? `<div class="w-px flex-1 mt-1 min-h-[20px] ${
                      done ? 'bg-red-500/30' : 'bg-white/5'
                    }"></div>`
                  : ''
              }
            </div>
            <div class="pb-5">
              <p class="text-sm font-medium ${
                done ? 'text-white' : 'text-white/30'
              }">${stepLabels[step]}</p>
              ${
                log
                  ? `<p class="text-white/30 text-xs mt-0.5">${new Date(
                      log.created_at,
                    ).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</p>`
                  : ''
              }
            </div>
          </div>
        `;
    })
    .join('');
}

async function openBookingModal(referenceCode) {
  const modal = document.getElementById('modal-booking');
  const content = document.getElementById('modal-content');
  document.getElementById('modal-ref').textContent = referenceCode;
  content.innerHTML = '<div class="skeleton-line h-40 rounded-xl"></div>';
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const res = await fetch(`/api/customer/bookings/${referenceCode}`);
  const json = await res.json();

  if (!json.success) {
    content.innerHTML = `<p class="text-red-400 text-sm">${json.message}</p>`;
    return;
  }

  const b = json.data;
  const isDownPayment = !b.is_fully_paid && b.remaining_balance > 0;

  const serviceBlock = `
    <div class="bg-white/3 border border-white/5 rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <i class="ph ph-wrench text-red-500 text-sm"></i>
        <p class="text-xs text-white/40 uppercase tracking-widest">Service</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <p class="text-white/30 text-xs mb-1">Service</p>
          <p class="text-white text-sm font-medium">${b.service_name}</p>
        </div>
        <div>
          <p class="text-white/30 text-xs mb-1">Variant</p>
          <p class="text-white text-sm font-medium">${b.variant_name || '-'}</p>
        </div>
        <div>
          <p class="text-white/30 text-xs mb-1">Date</p>
          <p class="text-white text-sm font-medium">${formatDate(
            b.booking_date,
          )}</p>
        </div>
        <div>
          <p class="text-white/30 text-xs mb-1">Queue</p>
          <p class="text-white text-sm font-semibold">#${b.queue_number}</p>
        </div>
        <div class="col-span-2">
          <p class="text-white/30 text-xs mb-1">Motorcycle</p>
          <p class="text-white text-sm font-medium">${b.motorcycle_model} · ${
            b.motorcycle_color
          } · ${b.motorcycle_plate}</p>
        </div>
      </div>
    </div>`;

  const paymentBlock = `
    <div class="bg-white/3 border border-white/5 rounded-xl p-5 flex flex-col gap-3">
      <div class="flex items-center gap-2 mb-1">
        <i class="ph ph-receipt text-red-500 text-sm"></i>
        <p class="text-xs text-white/40 uppercase tracking-widest">Payment</p>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-white/40 text-sm">Total</span>
        <span class="text-white text-sm font-medium">${formatPrice(
          b.total_amount,
        )}</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-white/40 text-sm">Paid</span>
        <span class="text-green-400 text-sm font-semibold">${formatPrice(
          b.amount_paid,
        )}</span>
      </div>
      ${
        isDownPayment
          ? `
      <div class="flex justify-between items-center border-t border-white/5 pt-3 mt-1">
        <span class="text-yellow-400/80 text-sm">Balance Due</span>
        <span class="text-yellow-400 text-sm font-bold">${formatPrice(
          b.remaining_balance,
        )}</span>
      </div>`
          : `
      <div class="flex items-center gap-1.5 border-t border-white/5 pt-3 mt-1">
        <i class="ph ph-check-circle text-green-500 text-sm"></i>
        <span class="text-green-400/70 text-xs">Fully paid</span>
      </div>`
      }
    </div>`;

  const timelineBlock = `
    <div class="bg-white/3 border border-white/5 rounded-xl p-5">
      <div class="flex items-center gap-2 mb-5">
        <i class="ph ph-clock-clockwise text-red-500 text-sm"></i>
        <p class="text-xs text-white/40 uppercase tracking-widest">Status Timeline</p>
      </div>
      ${renderStatusTimeline(b.status_logs || [])}
    </div>`;

  const qrBlock = b.qr_code
    ? `
    <div class="bg-white/3 border border-white/5 rounded-xl p-5 flex flex-col items-center gap-3">
      <div class="flex items-center gap-2">
        <i class="ph ph-qr-code text-red-500 text-sm"></i>
        <p class="text-xs text-white/40 uppercase tracking-widest">QR Code</p>
      </div>
      <div class="p-2 bg-white rounded-xl shadow-[0_0_24px_rgba(229,53,53,0.15)]">
        <img src="${b.qr_code}" alt="QR Code" class="w-32 h-32 rounded-lg block" />
      </div>
      <p class="text-white/20 text-xs tracking-widest">${b.reference_code}</p>
    </div>`
    : '';

  // desktop: service full width, payment + timeline side by side, qr centered bottom
  // mobile: single column stacked
  content.innerHTML = `
    <div class="hidden md:flex md:flex-col md:gap-4">
      ${serviceBlock}
      <div class="grid grid-cols-2 gap-4">
        ${paymentBlock}
        ${timelineBlock}
      </div>
      ${qrBlock}
    </div>
    <div class="flex flex-col gap-4 md:hidden">
      ${serviceBlock}
      ${paymentBlock}
      ${qrBlock}
      ${timelineBlock}
    </div>
  `;
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-booking').classList.add('hidden');
  document.getElementById('modal-booking').classList.remove('flex');
});

document.getElementById('modal-booking').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-booking')) {
    document.getElementById('modal-booking').classList.add('hidden');
    document.getElementById('modal-booking').classList.remove('flex');
  }
});

function attachBookingCardListeners() {
  document.querySelectorAll('.booking-card').forEach((card) => {
    card.addEventListener('click', () => openBookingModal(card.dataset.ref));
  });
}
async function loadBookings() {
  const res = await fetch('/api/customer/bookings');
  const json = await res.json();
  const activeContainer = document.getElementById('active-bookings-container');
  const historyContainer = document.getElementById(
    'history-bookings-container',
  );

  if (!json.success) {
    activeContainer.innerHTML = `<p class="text-red-400 text-sm">Failed to load bookings.</p>`;
    historyContainer.innerHTML = '';
    return;
  }

  const bookings = json.data;
  const active = bookings.filter(
    (b) =>
      b.booking_status === 'confirmed' && ACTIVE_STATUSES.includes(b.status),
  );
  const history = bookings.filter((b) => !active.includes(b));

  if (active.length === 0) {
    activeContainer.innerHTML = `
          <div class="bg-[#111] border border-white/6 rounded-2xl p-6 text-center">
            <i class="ph ph-calendar-blank text-3xl text-white/20 mb-2 block"></i>
            <p class="text-white/30 text-sm">No active bookings.</p>
            <a href="/customer/services" class="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs mt-3 transition-colors">
              <i class="ph ph-calendar-plus"></i> Book a service
            </a>
          </div>`;
  } else {
    activeContainer.innerHTML = active.map(renderActiveBooking).join('');
  }

  if (history.length === 0) {
    historyContainer.innerHTML = `<p class="text-white/20 text-sm text-center py-4">No past bookings yet.</p>`;
  } else {
    historyContainer.innerHTML = history.map(renderHistoryBooking).join('');
  }

  attachBookingCardListeners();
}
loadBookings();
