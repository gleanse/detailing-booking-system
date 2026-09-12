const STATUS_CONFIG = {
  confirmed: {
    icon: 'ph-check-circle',
    iconColor: 'text-green-400',
    borderColor: 'border-green-500/20',
    bgColor: 'bg-green-500/10',
    labelColor: 'text-green-400',
    label: 'Booking Confirmed',
    heading: "You're All Set!",
    sub: 'Your booking is confirmed. Please arrive on your scheduled date with your queue number ready.',
  },
  in_progress: {
    icon: 'ph-gear',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    bgColor: 'bg-blue-500/10',
    labelColor: 'text-blue-400',
    label: 'In Progress',
    heading: 'Work Has Begun',
    sub: "Our team is currently working on your motorcycle. We'll notify you once it's done.",
  },
  done: {
    icon: 'ph-star',
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/20',
    bgColor: 'bg-yellow-500/10',
    labelColor: 'text-yellow-400',
    label: 'Service Complete',
    heading: 'Ready for Pickup!',
    sub: 'Your motorcycle is done! Please come by to pick it up at your earliest convenience.',
  },
  picked_up: {
    icon: 'ph-check-circle',
    iconColor: 'text-green-400',
    borderColor: 'border-green-500/20',
    bgColor: 'bg-green-500/10',
    labelColor: 'text-green-400',
    label: 'Picked Up',
    heading: 'All Done!',
    sub: 'Your motorcycle has been picked up. Thank you for choosing Herco Detailing Garage!',
  },
  expired: {
    icon: 'ph-x-circle',
    iconColor: 'text-red-400',
    borderColor: 'border-red-500/20',
    bgColor: 'bg-red-500/10',
    labelColor: 'text-red-400',
    label: 'Booking Expired',
    heading: 'This Booking Expired',
    sub: 'This booking has expired. Please create a new booking to avail our services.',
  },
};

const TIMELINE_STEPS = [
  { status: 'confirmed', label: 'Booking Confirmed' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Service Complete' },
  { status: 'picked_up', label: 'Picked Up' },
];

const fmtDate = (d) => {
  const [year, month, day] = d.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtMoney = (v) =>
  `₱${parseFloat(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// Hard coded business hours: Morning 8AM-11AM, Afternoon 1PM-4PM
function getRecommendedArrival(queueNumber, totalBookings) {
  const morningCount = Math.ceil(totalBookings / 2);
  if (queueNumber <= morningCount) {
    return { block: 'Morning Block', time: '8:00AM – 11:00AM' };
  }
  return { block: 'Afternoon Block', time: '1:00PM – 4:00PM' };
}

// get reference code from URL /booking/public/HRC-XXXXXXXX
const referenceCode = window.location.pathname.split('/').pop();

async function load() {
  try {
    const res = await fetch(`/api/booking/public/${referenceCode}/details`);
    const json = await res.json();

    if (!res.ok || !json.success) {
      showError();
      return;
    }

    render(json.data);
  } catch (e) {
    showError();
  }
}

function showError() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error').classList.remove('hidden');
  document.getElementById('error').classList.add('flex');
}

function render(b) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  // determine current status
  const currentStatus =
    b.booking_status === 'confirmed'
      ? b.status || 'confirmed'
      : b.booking_status;
  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['confirmed'];

  // status hero
  const iconEl = document.getElementById('status-icon');
  iconEl.className = `w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${cfg.bgColor} ${cfg.borderColor}`;
  iconEl.innerHTML = `<i class="ph ${cfg.icon} text-2xl ${cfg.iconColor}"></i>`;

  const labelEl = document.getElementById('status-label');
  labelEl.textContent = cfg.label;
  labelEl.className = `text-xs uppercase tracking-widest mb-2 ${cfg.labelColor}`;

  document.getElementById('status-heading').textContent = cfg.heading;
  document.getElementById('status-sub').textContent = cfg.sub;

  // booking details
  document.getElementById('ref-code').textContent = b.reference_code;
  document.getElementById('queue-number').textContent = `#${b.queue_number}`;
  document.getElementById('service-name').textContent = b.variant_name
    ? `${b.service_name} - ${b.variant_name}`
    : b.service_name;
  document.getElementById('booking-date').textContent = fmtDate(b.booking_date);
  document.getElementById('guest-name').textContent = b.guest_name;

  // motorcycle
  document.getElementById('moto-plate').textContent =
    b.motorcycle_plate?.toUpperCase() || '-';
  document.getElementById('moto-model').textContent = b.motorcycle_model || '-';
  document.getElementById('moto-color').textContent = b.motorcycle_color || '-';
  if (b.motorcycle_description) {
    document.getElementById('moto-desc-row').classList.remove('hidden');
    document.getElementById('moto-desc-row').classList.add('flex');
    document.getElementById('moto-desc').textContent = b.motorcycle_description;
  } else {
    document.getElementById('moto-desc-row').classList.add('hidden');
  }

  // payment
  document.getElementById('payment-type').textContent =
    b.payment_type === 'full' ? 'Full Payment' : '50% Down Payment';
  document.getElementById('total-amount').textContent = fmtMoney(
    b.total_amount,
  );
  document.getElementById('amount-paid').textContent = fmtMoney(b.amount_paid);

  if (parseFloat(b.remaining_balance) > 0) {
    document.getElementById('remaining-row').classList.remove('hidden');
    document.getElementById('remaining-row').classList.add('flex');
    document.getElementById('remaining-balance').textContent = fmtMoney(
      b.remaining_balance,
    );
  } else {
    document.getElementById('remaining-row').classList.add('hidden');
  }

  const payStatusEl = document.getElementById('payment-status');
  if (b.is_fully_paid) {
    payStatusEl.innerHTML = `
      <span class="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 text-green-400 text-xs">
        <i class="ph ph-check-circle"></i> Fully Paid
      </span>`;
  } else {
    payStatusEl.innerHTML = `
      <span class="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1 text-yellow-400 text-xs">
        <i class="ph ph-warning-circle"></i> Balance Due
      </span>`;
  }

  // recommended arrival - only show if booking is confirmed and not yet picked up
  if (['pending', 'confirmed', 'in_progress', 'done'].includes(currentStatus)) {
    const total = parseInt(b.date_capacity) || 10;
    const arrival = getRecommendedArrival(b.queue_number, total);
    document.getElementById('arrival-block').textContent = arrival.block;
    document.getElementById('arrival-time').textContent = arrival.time;
    document.getElementById('arrival-card').classList.remove('hidden');
  }

  // timeline
  renderTimeline(b.status_logs || [], currentStatus);
}

function renderTimeline(logs, currentStatus) {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const logMap = {};
  logs.forEach((l) => {
    logMap[l.status] = l;
  });

  const statusOrder = ['confirmed', 'in_progress', 'done', 'picked_up'];
  const currentIdx = statusOrder.indexOf(currentStatus);

  TIMELINE_STEPS.forEach((step, i) => {
    const log = logMap[step.status];
    const isDone = log != null;
    const isActive = i === currentIdx && !log;
    const isPending = !isDone && !isActive;
    const isLast = i === TIMELINE_STEPS.length - 1;

    const div = document.createElement('div');
    div.className = 'flex gap-4 ' + (!isLast ? 'pb-6' : '');

    let dotClass, dotIcon;
    if (isDone) {
      dotClass =
        'w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 mt-0.5';
      dotIcon = `<i class="ph ph-check text-green-400" style="font-size:10px;"></i>`;
    } else if (isActive) {
      dotClass =
        'w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5';
      dotIcon = `<div class="w-2 h-2 rounded-full bg-blue-400"></div>`;
    } else {
      dotClass =
        'w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5';
      dotIcon = '';
    }

    const lineHtml = !isLast
      ? `<div class="w-px flex-1 mt-1 ml-2.25 absolute top-6 bottom-0 ${
          isDone ? 'bg-green-500/20' : 'bg-white/5'
        }"></div>`
      : '';

    div.innerHTML = `
      <div class="relative flex flex-col items-center">
        <div class="${dotClass}">${dotIcon}</div>
        ${lineHtml}
      </div>
      <div class="pb-1 flex-1">
        <p class="text-sm font-semibold ${
          isPending ? 'text-white/30' : 'text-white'
        }">${step.label}</p>
        ${
          log
            ? `<p class="text-xs text-white/30 mt-0.5">${fmtDateTime(
                log.created_at,
              )}</p>`
            : ''
        }
        ${
          log && log.changed_by_name
            ? `<p class="text-xs text-white/20 mt-0.5">by ${log.changed_by_name}</p>`
            : ''
        }
        ${
          !log
            ? `<p class="text-xs text-white/20 mt-0.5">${
                isActive ? 'In progress...' : 'Pending'
              }</p>`
            : ''
        }
      </div>
    `;

    container.appendChild(div);
  });
}

load();

async function updateNav() {
  try {
    const res = await fetch('/api/customer/me');
    const json = await res.json();
    if (!json.success) return;
    const u = json.user;
    const firstName = u.name.split(' ')[0];

    const desktopNav = document.querySelector('nav.hidden.md\\:flex');
    if (desktopNav) {
      const accountLink = desktopNav.querySelector('a[href="/customer/login"]');
      if (accountLink) {
        accountLink.href = '/customer/account';
        accountLink.innerHTML = `<i class="ph ph-user-circle text-red-500 text-base"></i> ${firstName}`;
        accountLink.className =
          'nav-link text-sm tracking-wide flex items-center gap-1.5';
      }
    }

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
      const accountLink = mobileMenu.querySelector('a[href="/customer/login"]');
      if (accountLink) {
        accountLink.href = '/customer/account';
        accountLink.textContent = `Hi, ${firstName}`;
        accountLink.className =
          'text-sm text-white py-3 border-b border-white/5';
      }
    }
  } catch {
    // fail silently
  }
}

updateNav();
