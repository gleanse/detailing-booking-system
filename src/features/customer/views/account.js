// ACCOUNT PAGE JS
const toggle = document.getElementById('menu-toggle');
const menu = document.getElementById('mobile-menu');
const bar1 = document.getElementById('bar1');
const bar2 = document.getElementById('bar2');
const bar3 = document.getElementById('bar3');
let menuOpen = false;
toggle.addEventListener('click', () => {
  menuOpen = !menuOpen;
  menu.classList.toggle('open', menuOpen);
  bar1.style.transform = menuOpen ? 'translateY(6px) rotate(45deg)' : '';
  bar2.style.opacity = menuOpen ? '0' : '';
  bar3.style.transform = menuOpen ? 'translateY(-6px) rotate(-45deg)' : '';
});

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
  const isDownPayment = b.payment_type === 'downpayment' && !b.is_fully_paid;

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
  const isDownPayment = b.payment_type === 'downpayment';

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

// EMAIL CHANGE FLOW
let otpExpiryInterval = null;
let resendCooldownInterval = null;

function startOtpExpiryTimer() {
  clearInterval(otpExpiryInterval);
  let seconds = 600;
  const expiryEl = document.getElementById('otp-expires-in');
  expiryEl.className = 'text-yellow-400 text-xs mb-3';

  otpExpiryInterval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(otpExpiryInterval);
      expiryEl.className = 'text-red-400 text-xs mb-3';
      expiryEl.textContent = 'Code expired. Request a new one.';
      return;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    expiryEl.textContent = `Expires in ${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function startResendCooldown() {
  clearInterval(resendCooldownInterval);
  let seconds = 60;
  const btn = document.getElementById('btn-resend-otp');
  const text = document.getElementById('resend-otp-text');
  btn.disabled = true;
  btn.classList.remove('hover:text-red-400', 'text-white/30');
  btn.classList.add('text-white/20');
  text.textContent = `Resend code (${seconds}s)`;

  resendCooldownInterval = setInterval(() => {
    seconds--;
    text.textContent = `Resend code (${seconds}s)`;
    if (seconds <= 0) {
      clearInterval(resendCooldownInterval);
      btn.disabled = false;
      text.textContent = 'Resend code';
      btn.classList.remove('text-white/20');
      btn.classList.add('hover:text-red-400', 'text-white/30');
    }
  }, 1000);
}

function resetEmailChangeForm() {
  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('email-step-1').classList.remove('hidden');
  document.getElementById('email-step-2').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('flex');
  document.getElementById('email-step2-error').classList.add('hidden');
  document.getElementById('email-step1-error').classList.add('hidden');
  document.getElementById('email-step1-success').classList.add('hidden');
  document.getElementById('change-email-input').value = '';
  document.getElementById('otp-input').value = '';
  document.getElementById('otp-expires-in').textContent = '';
  const resendBtn = document.getElementById('btn-resend-otp');
  resendBtn.disabled = false;
  document.getElementById('resend-otp-text').textContent = 'Resend code';
  resendBtn.classList.remove('text-white/20');
  resendBtn.classList.add('hover:text-red-400', 'text-white/30');
}

document.getElementById('btn-change-email').addEventListener('click', () => {
  const section = document.getElementById('change-email-section');
  const isHidden = section.classList.contains('hidden');
  closeAllForms();
  if (isHidden) {
    section.classList.remove('hidden');
    resetEmailChangeForm();
  }
});

document.getElementById('btn-cancel-email').addEventListener('click', () => {
  document.getElementById('change-email-section').classList.add('hidden');
  resetEmailChangeForm();
});

document.getElementById('btn-back-email').addEventListener('click', () => {
  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('email-step-2').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('flex');
  document.getElementById('email-step-1').classList.remove('hidden');
  document.getElementById('email-step2-error').classList.add('hidden');
  document.getElementById('otp-expires-in').textContent = '';
});

async function sendOtp() {
  const email = document.getElementById('change-email-input').value.trim();
  const errorEl = document.getElementById('email-step1-error');
  const successEl = document.getElementById('email-step1-success');
  const btn = document.getElementById('btn-send-otp');
  const icon = document.getElementById('send-otp-icon');
  const text = document.getElementById('send-otp-text');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!email) {
    errorEl.textContent = 'Email is required.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  icon.className = 'ph ph-spinner animate-spin text-sm';
  text.textContent = 'Sending...';

  const res = await fetch('/api/customer/email', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const json = await res.json();
  btn.disabled = false;
  icon.className = 'ph ph-paper-plane-tilt text-sm';
  text.textContent = 'Send Code';

  if (!json.success) {
    errorEl.textContent = json.message;
    errorEl.classList.remove('hidden');
    return;
  }

  successEl.textContent = json.message;
  successEl.classList.remove('hidden');
  document.getElementById('email-step-1').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('hidden');
  document.getElementById('email-step-2').classList.add('flex');
  startOtpExpiryTimer();
  startResendCooldown();
}

async function verifyOtp() {
  const otp = document.getElementById('otp-input').value.trim();
  const errorEl = document.getElementById('email-step2-error');
  const successEl = document.getElementById('email-step2-success');
  const btn = document.getElementById('btn-verify-otp');
  const icon = document.getElementById('verify-otp-icon');
  const text = document.getElementById('verify-otp-text');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!otp) {
    errorEl.textContent = 'Verification code is required.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  icon.className = 'ph ph-spinner animate-spin text-sm';
  text.textContent = 'Verifying...';

  const res = await fetch('/api/customer/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  });

  const json = await res.json();
  btn.disabled = false;
  icon.className = 'ph ph-check text-sm';
  text.textContent = 'Verify';

  if (!json.success) {
    errorEl.textContent = json.message;
    errorEl.classList.remove('hidden');
    return;
  }

  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('profile-email').textContent = json.user.email;
  document.getElementById('profile-email-2').textContent = json.user.email;
  document.getElementById('change-email-section').classList.add('hidden');
  resetEmailChangeForm();
}

document.getElementById('btn-send-otp').addEventListener('click', sendOtp);
document.getElementById('btn-verify-otp').addEventListener('click', verifyOtp);

document.getElementById('otp-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyOtp();
});

document
  .getElementById('btn-resend-otp')
  .addEventListener('click', async () => {
    const email = document.getElementById('change-email-input').value.trim();
    const errorEl = document.getElementById('email-step2-error');
    const successEl = document.getElementById('email-step2-success');
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const res = await fetch('/api/customer/email', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!json.success) {
      errorEl.textContent = json.message;
      errorEl.classList.remove('hidden');
      return;
    }

    successEl.textContent = 'New code sent.';
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 3000);
    startOtpExpiryTimer();
    startResendCooldown();
  });

async function loadProfile() {
  const res = await fetch('/api/customer/me');
  const json = await res.json();
  if (!json.success) return;
  const u = json.user;
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('profile-phone').textContent = u.phone || '-';
  document.getElementById('profile-email-2').textContent = u.email;
  document.getElementById('edit-name').value = u.name;
  document.getElementById('edit-phone').value = u.phone || '';

  // update navbar with first name
  const firstName = u.name.split(' ')[0];

  const desktopNav = document.querySelector('nav.hidden.md\\:flex');
  if (desktopNav) {
    const accountLink = desktopNav.querySelector('a[href="/customer/account"]');
    if (accountLink) {
      accountLink.innerHTML = `<i class="ph ph-user-circle text-red-500 text-base"></i> ${firstName}`;
      accountLink.className =
        'nav-link active text-sm tracking-wide flex items-center gap-1.5';
    }
  }

  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) {
    const accountLink = mobileMenu.querySelector('a[href="/customer/account"]');
    if (accountLink) {
      accountLink.textContent = `Hi, ${firstName}`;
    }
  }
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
            <a href="/services" class="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs mt-3 transition-colors">
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

document.getElementById('btn-edit-profile').addEventListener('click', () => {
  const form = document.getElementById('edit-profile-form');
  const isHidden = form.classList.contains('hidden');
  closeAllForms();
  if (isHidden) form.classList.remove('hidden');
});

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
  document.getElementById('edit-profile-form').classList.add('hidden');
  document.getElementById('edit-form-error').classList.add('hidden');
  document.getElementById('edit-form-success').classList.add('hidden');
});

document.getElementById('edit-phone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

document
  .getElementById('btn-save-profile')
  .addEventListener('click', async () => {
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const errorName = document.getElementById('edit-error-name');
    const errorPhone = document.getElementById('edit-error-phone');
    const formError = document.getElementById('edit-form-error');
    const formSuccess = document.getElementById('edit-form-success');

    errorName.classList.add('hidden');
    errorPhone.classList.add('hidden');
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');

    let valid = true;
    if (!name || name.length < 2) {
      errorName.textContent = !name
        ? 'Name is required.'
        : 'Name must be at least 2 characters.';
      errorName.classList.remove('hidden');
      valid = false;
    }
    if (!phone) {
      errorPhone.textContent = 'Phone number is required.';
      errorPhone.classList.remove('hidden');
      valid = false;
    } else if (!/^09\d{9}$/.test(phone)) {
      errorPhone.textContent = 'Enter a valid PH number (09XXXXXXXXX).';
      errorPhone.classList.remove('hidden');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('btn-save-profile');
    const icon = document.getElementById('save-icon');
    const text = document.getElementById('save-text');
    btn.disabled = true;
    icon.className = 'ph ph-spinner animate-spin text-sm';
    text.textContent = 'Saving...';

    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });

    const json = await res.json();
    btn.disabled = false;
    icon.className = 'ph ph-floppy-disk text-sm';
    text.textContent = 'Save';

    if (!json.success) {
      formError.textContent = json.message;
      formError.classList.remove('hidden');
      return;
    }

    document.getElementById('profile-name').textContent = json.user.name;
    document.getElementById('profile-phone').textContent = json.user.phone;
    document.getElementById('edit-profile-form').classList.add('hidden');
    formSuccess.textContent = 'Profile updated successfully.';
    formSuccess.classList.remove('hidden');
  });

document.getElementById('btn-logout').addEventListener('click', async () => {
  const res = await fetch('/api/customer/logout', { method: 'POST' });
  const json = await res.json();
  if (json.success) window.location.href = json.redirect;
});

// change password
document.getElementById('btn-change-password').addEventListener('click', () => {
  const section = document.getElementById('change-password-section');
  const isHidden = section.classList.contains('hidden');
  closeAllForms();
  if (isHidden) section.classList.remove('hidden');
});

document.getElementById('btn-cancel-password').addEventListener('click', () => {
  document.getElementById('change-password-section').classList.add('hidden');
  resetPasswordForm();
});

function resetPasswordForm() {
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('error-current-password').classList.add('hidden');
  document.getElementById('error-new-password').classList.add('hidden');
  document.getElementById('error-confirm-password').classList.add('hidden');
  document.getElementById('change-password-error').classList.add('hidden');
  document.getElementById('change-password-success').classList.add('hidden');
}

document
  .getElementById('btn-save-password')
  .addEventListener('click', async () => {
    const currentPassword = document
      .getElementById('current-password')
      .value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmPassword = document
      .getElementById('confirm-password')
      .value.trim();

    const errorCurrent = document.getElementById('error-current-password');
    const errorNew = document.getElementById('error-new-password');
    const errorConfirm = document.getElementById('error-confirm-password');
    const formError = document.getElementById('change-password-error');
    const formSuccess = document.getElementById('change-password-success');

    errorCurrent.classList.add('hidden');
    errorNew.classList.add('hidden');
    errorConfirm.classList.add('hidden');
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');

    let valid = true;

    if (!currentPassword) {
      errorCurrent.textContent = 'Current password is required.';
      errorCurrent.classList.remove('hidden');
      valid = false;
    }

    if (!newPassword) {
      errorNew.textContent = 'New password is required.';
      errorNew.classList.remove('hidden');
      valid = false;
    } else if (newPassword.length < 8) {
      errorNew.textContent = 'Password must be at least 8 characters.';
      errorNew.classList.remove('hidden');
      valid = false;
    }

    if (!confirmPassword) {
      errorConfirm.textContent = 'Please confirm your new password.';
      errorConfirm.classList.remove('hidden');
      valid = false;
    } else if (newPassword && confirmPassword !== newPassword) {
      errorConfirm.textContent = 'Passwords do not match.';
      errorConfirm.classList.remove('hidden');
      valid = false;
    }

    if (!valid) return;

    const btn = document.getElementById('btn-save-password');
    const icon = document.getElementById('save-password-icon');
    const text = document.getElementById('save-password-text');
    btn.disabled = true;
    icon.className = 'ph ph-spinner animate-spin text-sm';
    text.textContent = 'Saving...';

    const res = await fetch('/api/customer/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const json = await res.json();
    btn.disabled = false;
    icon.className = 'ph ph-floppy-disk text-sm';
    text.textContent = 'Save';

    if (!json.success) {
      formError.textContent = json.message;
      formError.classList.remove('hidden');
      return;
    }

    formSuccess.textContent = 'Password changed successfully.';
    formSuccess.classList.remove('hidden');
    resetPasswordForm();
    document
      .getElementById('change-password-success')
      .classList.remove('hidden');
    document.getElementById('change-password-success').textContent =
      'Password changed successfully.';
  });

function closeAllForms() {
  document.getElementById('edit-profile-form').classList.add('hidden');
  document.getElementById('change-email-section').classList.add('hidden');
  document.getElementById('change-password-section').classList.add('hidden');
  resetEmailChangeForm();
  resetPasswordForm();
}

document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').className = isPassword
      ? 'ph ph-eye-slash text-lg'
      : 'ph ph-eye text-lg';
  });
});

loadProfile();
loadBookings();
