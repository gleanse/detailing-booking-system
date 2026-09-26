const fmt = (amt) =>
  `PHP ${parseFloat(amt || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
  })}`;
const today = () => new Date().toISOString().split('T')[0];
const isDateMismatch = (d) =>
  d && new Date(d).toISOString().split('T')[0] !== today();
const showEl = (id) => {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('flex', 'items-center', 'justify-center');
};
const hideEl = (id) => {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.classList.remove('flex', 'items-center', 'justify-center');
};
const showBlock = (id) => {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
};
const showFlex = (id) => {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.add('flex');
};
const hideBlock = (id) => {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.classList.remove('flex');
};

let booking = null;
let currentStaffId = null;

const statusConfig = {
  pending: {
    icon: 'ph-clock',
    color: '#facc15',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.2)',
    label: 'Pending',
  },
  in_progress: {
    icon: 'ph-wrench',
    color: '#60a5fa',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    label: 'In Progress',
  },
  done: {
    icon: 'ph-check-circle',
    color: '#4ade80',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.2)',
    label: 'Done',
  },
  picked_up: {
    icon: 'ph-check-square',
    color: 'rgba(255,255,255,0.4)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.1)',
    label: 'Picked Up',
  },
};

const infoRow = (id, icon, label, value) =>
  (document.getElementById(id).innerHTML = `
    <i class="ph ${icon} row-icon"></i>
    <div><p class="row-label">${label}</p><p class="row-value">${value}</p></div>`);

const renderBooking = (b) => {
  booking = b;
  hideBlock('state-loading');
  showBlock('state-booking');

  const ref = b.reference_code;
  document.getElementById('booking-ref').textContent = ref;

  const cfg = statusConfig[b.status] || statusConfig.pending;
  const banner = document.getElementById('status-banner');
  banner.style.backgroundColor = cfg.bg;
  banner.style.borderColor = cfg.border;
  document.getElementById('status-icon').className =
    `ph ${cfg.icon} text-4xl flex-shrink-0`;
  document.getElementById('status-icon').style.color = cfg.color;
  document.getElementById('status-label').textContent = cfg.label;
  document.getElementById('status-label').style.color = cfg.color;
  document.getElementById('status-badge-scan').className =
    `status-badge status-${b.status}`;
  document.getElementById('status-badge-scan').textContent = cfg.label;

  if (isDateMismatch(b.booking_date)) {
    document.getElementById('date-warn-text').textContent =
      `Booking date is ${new Date(
        b.booking_date,
      ).toDateString()} but today is ${new Date().toDateString()}. Confirm changes carefully.`;
    showFlex('date-warn');
  }

  document.getElementById('b-queue').textContent = `#${b.queue_number ?? '-'}`;
  document.getElementById('b-date').textContent = b.booking_date
    ? new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '-';

  infoRow(
    'b-row-name',
    'ph-user',
    'Customer',
    b.guest_name || b.customer_name || '-',
  );
  infoRow('b-row-plate', 'ph-motorcycle', 'Plate', b.motorcycle_plate || '-');
  infoRow('b-row-model', 'ph-car', 'Model', b.motorcycle_model || '-');
  infoRow(
    'b-row-service',
    'ph-wrench',
    'Service',
    `${b.service_name}${b.variant_name ? ' - ' + b.variant_name : ''}`,
  );

  document.getElementById('b-total').textContent = fmt(b.amount);
  document.getElementById('b-paid').textContent = fmt(b.amount_paid);
  const remEl = document.getElementById('b-remaining');
  remEl.textContent = b.is_fully_paid ? 'Fully Paid' : fmt(b.remaining_balance);
  remEl.className = `font-semibold ${
    b.is_fully_paid ? 'text-green-400' : 'text-red-400'
  }`;
  document.getElementById('b-method').textContent =
    `${b.payment_method} · ${b.payment_type}`;

  renderActions(b);
};

const renderActions = (b) => {
  const container = document.getElementById('action-buttons');
  const canProgress = b.status === 'pending';
  const canDone = b.status === 'in_progress';
  const canPickup = b.status === 'done';
  const canPaid = !b.is_fully_paid && b.status !== 'picked_up';
  const isComplete = b.status === 'picked_up';

  if (isComplete) {
    container.innerHTML = `
      <div class="flex items-center gap-3 bg-white/4 border border-white/8 rounded-2xl px-5 py-4 text-center">
        <i class="ph ph-check-square text-white/30 text-xl flex-shrink-0"></i>
        <p class="text-white/40 text-sm">This booking is complete. No further actions needed.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    ${
      canProgress
        ? `<button id="btn-inprogress" class="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-sm"><i class="ph ph-wrench text-sm"></i> Mark In Progress</button>`
        : ''
    }
    ${
      canDone
        ? `<button id="btn-done"       class="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-sm"><i class="ph ph-check-circle text-sm"></i> Mark Done</button>`
        : ''
    }
    ${
      canPickup
        ? `<button id="btn-pickup"     class="w-full bg-white/8 hover:bg-white/12 active:scale-95 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-sm"><i class="ph ph-check-square text-sm"></i> Mark Picked Up</button>`
        : ''
    }
    ${
      canPaid
        ? `<button id="btn-paid"       class="w-full border border-green-500/20 hover:border-green-500/40 text-green-400 font-medium py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-sm"><i class="ph ph-money text-sm"></i> Collect & Mark Fully Paid</button>`
        : ''
    }`;

  document.getElementById('btn-inprogress')?.addEventListener('click', () => {
    document.getElementById('inprogress-ref').textContent =
      booking.reference_code;
    document.getElementById('inprogress-confirm-input').value = '';
    document.getElementById('inprogress-input-error').classList.add('hidden');
    const w = document.getElementById('inprogress-warn');
    const warn = isDateMismatch(booking.booking_date)
      ? `⚠ Booking date is ${new Date(
          booking.booking_date,
        ).toDateString()} but today is ${new Date().toDateString()}.`
      : null;
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');
    showEl('modal-inprogress');
  });

  document.getElementById('btn-done')?.addEventListener('click', async () => {
    document.getElementById('done-ref-display').textContent =
      booking.reference_code;
    document.getElementById('done-confirm-input').value = '';
    document.getElementById('done-input-error').classList.add('hidden');

    const w = document.getElementById('done-warn');
    const warn = isDateMismatch(booking.booking_date)
      ? `⚠ Booking date is ${new Date(
          booking.booking_date,
        ).toDateString()} but today is ${new Date().toDateString()}.`
      : null;
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');

    const ownerWarn = document.getElementById('done-owner-warn');
    ownerWarn.classList.add('hidden');
    try {
      const res = await fetch(`/staff/bookings/${booking.id}/started-by`);
      const data = await res.json();
      if (
        data.success &&
        data.startedBy &&
        data.startedBy.id !== currentStaffId
      ) {
        ownerWarn.textContent = `⚠ This booking was started by ${data.startedBy.name}. You can still proceed but make sure this is correct.`;
        ownerWarn.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Started by fetch error:', err);
    }

    showEl('modal-done');
  });

  document.getElementById('btn-pickup')?.addEventListener('click', () => {
    document.getElementById('pickup-ref').textContent = booking.reference_code;
    document.getElementById('pickup-confirm-input').value = '';
    document.getElementById('pickup-input-error').classList.add('hidden');
    const w = document.getElementById('pickup-warn');
    const warn = isDateMismatch(booking.booking_date)
      ? `⚠ Booking date is ${new Date(
          booking.booking_date,
        ).toDateString()} but today is ${new Date().toDateString()}.`
      : null;
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');
    showEl('modal-pickup');
  });

  document.getElementById('btn-paid')?.addEventListener('click', () => {
    document.getElementById('paid-ref').textContent = booking.reference_code;
    document.getElementById('paid-amount').textContent = fmt(
      booking.remaining_balance,
    );
    showEl('modal-paid');
  });
};

const commitStatus = async (status) => {
  try {
    const res = await fetch(`/staff/bookings/${booking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    booking.status = status;
    ['modal-inprogress', 'modal-done', 'modal-pickup'].forEach((id) =>
      hideEl(id),
    );

    const cfg = statusConfig[status];
    const banner = document.getElementById('status-banner');
    banner.style.backgroundColor = cfg.bg;
    banner.style.borderColor = cfg.border;
    document.getElementById('status-icon').className =
      `ph ${cfg.icon} text-4xl flex-shrink-0`;
    document.getElementById('status-icon').style.color = cfg.color;
    document.getElementById('status-label').textContent = cfg.label;
    document.getElementById('status-label').style.color = cfg.color;
    document.getElementById('status-badge-scan').className =
      `status-badge status-${status}`;
    document.getElementById('status-badge-scan').textContent = cfg.label;

    renderActions(booking);

    const msgs = {
      in_progress: [
        'Status Updated',
        'Marked as In Progress. Customer notified via email.',
      ],
      done: ['Status Updated', 'Marked as Done. Customer notified via email.'],
      picked_up: [
        'Booking Complete',
        'Motorcycle released. Customer notified via email.',
      ],
    };
    const [title, sub] = msgs[status] || ['Updated', ''];
    document.getElementById('success-title').textContent = title;
    document.getElementById('success-sub').textContent = sub;
    showFlex('action-success');
  } catch (err) {
    console.error('Commit status error:', err);
  }
};

const commitMarkPaid = async () => {
  try {
    const res = await fetch(`/staff/bookings/${booking.id}/paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    booking.is_fully_paid = true;
    booking.remaining_balance = 0;
    hideEl('modal-paid');

    document.getElementById('b-remaining').textContent = 'Fully Paid';
    document.getElementById('b-remaining').className =
      'font-semibold text-green-400';
    document.getElementById('b-paid').textContent = fmt(booking.amount);

    renderActions(booking);

    document.getElementById('success-title').textContent = 'Payment Collected';
    document.getElementById('success-sub').textContent =
      'Balance marked as fully paid.';
    showFlex('action-success');
  } catch (err) {
    console.error('Mark paid error:', err);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/staff/me');
    const data = await res.json();
    if (data.success) {
      document.getElementById('staff-name').textContent = data.user.name;
      currentStaffId = data.user.id;
    }
  } catch (_) {}

  const ref = window.location.pathname.split('/').pop();
  if (!ref) {
    hideBlock('state-loading');
    showBlock('state-notfound');
    document.getElementById('notfound-ref').textContent =
      'No reference code provided.';
    return;
  }

  try {
    const res = await fetch(`/staff/bookings/${encodeURIComponent(ref)}`);
    const data = await res.json();
    if (!data.success || !data.booking) {
      hideBlock('state-loading');
      showBlock('state-notfound');
      document.getElementById('notfound-ref').textContent = `Reference: ${ref}`;
      return;
    }
    renderBooking(data.booking);
  } catch (err) {
    hideBlock('state-loading');
    showBlock('state-notfound');
    document.getElementById('notfound-ref').textContent = `Reference: ${ref}`;
  }

  // in progress - retype 8 chars after HRC-
  document.getElementById('inprogress-cancel').addEventListener('click', () => {
    hideEl('modal-inprogress');
    document.getElementById('inprogress-confirm-input').value = '';
    document.getElementById('inprogress-input-error').classList.add('hidden');
  });
  document
    .getElementById('inprogress-confirm')
    .addEventListener('click', () => {
      const input = document
        .getElementById('inprogress-confirm-input')
        .value.toUpperCase();
      const code8 = booking.reference_code.replace('HRC-', '').toUpperCase();
      const errEl = document.getElementById('inprogress-input-error');
      if (input !== code8) {
        errEl.textContent = `Incorrect. Type the 8 characters after HRC- from ${booking.reference_code}.`;
        errEl.classList.remove('hidden');
        return;
      }
      errEl.classList.add('hidden');
      commitStatus('in_progress');
    });

  // done - retype 8 chars after HRC-
  document.getElementById('done-cancel').addEventListener('click', () => {
    hideEl('modal-done');
    document.getElementById('done-confirm-input').value = '';
    document.getElementById('done-input-error').classList.add('hidden');
  });
  document.getElementById('done-confirm').addEventListener('click', () => {
    const input = document
      .getElementById('done-confirm-input')
      .value.toUpperCase();
    const code8 = booking.reference_code.replace('HRC-', '').toUpperCase();
    const errEl = document.getElementById('done-input-error');
    if (input !== code8) {
      errEl.textContent = `Incorrect. Type the 8 characters after HRC- from ${booking.reference_code}.`;
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    commitStatus('done');
  });

  // picked up - retype 8 chars after HRC-
  document.getElementById('pickup-cancel').addEventListener('click', () => {
    hideEl('modal-pickup');
    document.getElementById('pickup-confirm-input').value = '';
    document.getElementById('pickup-input-error').classList.add('hidden');
  });
  document.getElementById('pickup-confirm').addEventListener('click', () => {
    const input = document
      .getElementById('pickup-confirm-input')
      .value.toUpperCase();
    const code8 = booking.reference_code.replace('HRC-', '').toUpperCase();
    const errEl = document.getElementById('pickup-input-error');
    if (input !== code8) {
      errEl.textContent = `Incorrect. Type the 8 characters after HRC- from ${booking.reference_code}.`;
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    commitStatus('picked_up');
  });

  document
    .getElementById('paid-cancel')
    .addEventListener('click', () => hideEl('modal-paid'));
  document
    .getElementById('paid-confirm')
    .addEventListener('click', commitMarkPaid);
});
