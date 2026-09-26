let allBookings = [];
let activeFilter = 'all';
let currentBooking = null;
let currentStaffId = null;
let viewMode = 'today';
let currentPage = 1;
let totalPages = 1;
let totalBookings = 0;
let upcomingDateFilter = '';

const fmt = (amt) =>
  `PHP ${parseFloat(amt || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
  })}`;
const today = () => new Date().toISOString().split('T')[0];

const isDateMismatch = (bookingDate) => {
  if (!bookingDate) return false;
  return new Date(bookingDate).toISOString().split('T')[0] !== today();
};

const statusLabel = (s) =>
  ({
    pending: 'Pending',
    in_progress: 'In Progress',
    done: 'Done',
    picked_up: 'Picked Up',
  })[s] || s;

const showModal = (id) =>
  document.getElementById(id).classList.replace('hidden', 'flex');
const hideModal = (id) =>
  document.getElementById(id).classList.replace('flex', 'hidden');
const hideAllActionModals = () =>
  [
    'modal-inprogress',
    'modal-done',
    'modal-pickup',
    'modal-paid',
    'modal-variant',
    'modal-logout',
  ].forEach(hideModal);

const renderBookingRow = (b) => {
  const name = b.guest_name || b.customer_name || '-';
  const mismatch = isDateMismatch(b.booking_date);
  const dateLabel =
    viewMode === 'upcoming'
      ? `<span class="text-[10px] bg-white/6 text-white/40 px-1.5 py-0.5 rounded-md">${new Date(
          b.booking_date + 'T00:00:00',
        ).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
        })}</span>`
      : '';
  return `
    <div class="booking-row px-5 py-4 hover:bg-white/2 transition-colors duration-150 cursor-pointer" data-id="${
      b.id
    }">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-red-600/15 flex items-center justify-center flex-shrink-0 text-red-400 font-bold text-sm" style="font-family:'Bebas Neue',sans-serif;">${
            b.queue_number ?? '-'
          }</div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-white text-sm font-medium truncate">${name}</p>
              ${dateLabel}
              ${
                b.is_walkin
                  ? '<span class="text-[10px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-md">Walk-in</span>'
                  : ''
              }
              ${
                mismatch && viewMode === 'today'
                  ? '<span class="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-md">⚠ Date mismatch</span>'
                  : ''
              }
            </div>
            <p class="text-white/30 text-xs mt-0.5">${b.reference_code} · ${
              b.service_name
            }${b.variant_name ? ' - ' + b.variant_name : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="status-badge status-${b.status}">${statusLabel(
            b.status,
          )}</span>
          ${
            !b.is_fully_paid
              ? '<span class="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">Unpaid bal.</span>'
              : ''
          }
        </div>
      </div>
    </div>`;
};

const renderEmpty = (msg) => `
  <div class="px-5 py-12 text-center">
    <i class="ph ph-clipboard-text text-white/10 text-4xl mb-3 block"></i>
    <p class="text-white/20 text-sm">${msg}</p>
  </div>`;

const renderPagination = () => {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    )
      pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  const pageButtons = pages
    .map((p) =>
      p === '...'
        ? `<span class="pg-ellipsis">…</span>`
        : `<button class="pg-btn${
            p === currentPage ? ' active' : ''
          }" data-page="${p}">${p}</button>`,
    )
    .join('');

  el.innerHTML = `
    <div class="pg-bar">
      <span class="pg-info">${totalBookings} total · page ${currentPage} of ${totalPages}</span>
      <div class="pg-controls">
        <button class="pg-btn" id="pg-prev" ${
          currentPage === 1 ? 'disabled' : ''
        }><i class="ph ph-caret-left"></i></button>
        ${pageButtons}
        <button class="pg-btn" id="pg-next" ${
          currentPage === totalPages ? 'disabled' : ''
        }><i class="ph ph-caret-right"></i></button>
      </div>
    </div>`;

  el.querySelector('#pg-prev')?.addEventListener('click', () =>
    goToPage(currentPage - 1),
  );
  el.querySelector('#pg-next')?.addEventListener('click', () =>
    goToPage(currentPage + 1),
  );
  el.querySelectorAll('.pg-btn[data-page]').forEach((btn) =>
    btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page))),
  );
};

const goToPage = (page) => {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  viewMode === 'today'
    ? loadBookings(document.getElementById('date-picker').value, page)
    : loadUpcoming(page);
};

const applyFilter = () => {
  const filtered =
    activeFilter === 'all'
      ? allBookings
      : allBookings.filter((b) => b.status === activeFilter);
  const list = document.getElementById('bookings-list');
  list.innerHTML =
    filtered.length === 0
      ? renderEmpty('No bookings found')
      : filtered.map(renderBookingRow).join('');
  list.querySelectorAll('.booking-row').forEach((row) => {
    row.addEventListener('click', () => {
      const b = allBookings.find((x) => x.id === row.dataset.id);
      if (b) openModal(b);
    });
  });
  renderPagination();
};

const updateStats = () => {
  document.getElementById('stat-total').textContent = allBookings.length;
  document.getElementById('stat-pending').textContent = allBookings.filter(
    (b) => b.status === 'pending',
  ).length;
  document.getElementById('stat-inprogress').textContent = allBookings.filter(
    (b) => b.status === 'in_progress',
  ).length;
  document.getElementById('stat-done').textContent = allBookings.filter((b) =>
    ['done', 'picked_up'].includes(b.status),
  ).length;
};

const skeleton = () =>
  `<div class="px-5 py-4"><div class="skeleton-line h-14 rounded-xl"></div></div>`.repeat(
    3,
  );

const loadBookings = async (date, page = 1) => {
  currentPage = page;
  document.getElementById('bookings-list').innerHTML = skeleton();
  try {
    const res = await fetch(`/staff/bookings?date=${date}&page=${page}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allBookings = data.bookings;
    totalPages = data.totalPages;
    totalBookings = data.total;
    updateStats();
    applyFilter();
  } catch (err) {
    document.getElementById('bookings-list').innerHTML = renderEmpty(
      'Failed to load bookings',
    );
  }
};

const loadUpcoming = async (page = 1) => {
  currentPage = page;
  document.getElementById('bookings-list').innerHTML = skeleton();
  try {
    const dateParam = upcomingDateFilter ? `&date=${upcomingDateFilter}` : '';
    const res = await fetch(
      `/staff/bookings/upcoming?page=${page}${dateParam}`,
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allBookings = data.bookings;
    totalPages = data.totalPages;
    totalBookings = data.total;
    updateStats();
    applyFilter();
  } catch (err) {
    document.getElementById('bookings-list').innerHTML = renderEmpty(
      'Failed to load upcoming bookings',
    );
  }
};

const loadDoneList = async () => {
  try {
    const res = await fetch('/staff/bookings/done');
    const data = await res.json();
    const container = document.getElementById('done-list');
    const badge = document.getElementById('done-count');
    if (!data.success || data.bookings.length === 0) {
      container.innerHTML = `<p class="text-white/20 text-xs col-span-full py-4">No motorcycles waiting for pickup.</p>`;
      badge.classList.add('hidden');
      return;
    }
    badge.textContent = data.bookings.length;
    badge.classList.remove('hidden');
    container.innerHTML = data.bookings
      .map(
        (b) => `
      <div class="bg-[#111] border border-green-500/15 rounded-2xl px-4 py-3 cursor-pointer hover:border-green-500/30 transition-colors duration-200" onclick="openModalById('${
        b.id
      }')">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-lg font-bold text-green-400" style="font-family:'Bebas Neue',sans-serif;">#${
            b.queue_number ?? '-'
          }</span>
          <span class="status-badge status-done">Done</span>
        </div>
        <p class="text-white text-xs font-medium">${b.guest_name || '-'}</p>
        <p class="text-white/30 text-xs">${b.motorcycle_plate} · ${
          b.service_name
        }</p>
        <p class="text-white/20 text-[10px] mt-1">${b.reference_code}</p>
      </div>`,
      )
      .join('');
  } catch (err) {
    console.error('Load done list error:', err);
  }
};

// loads bookings this staff personally started and are still in_progress
const loadMyInProgress = async () => {
  try {
    const res = await fetch('/staff/bookings/mine');
    const data = await res.json();
    const container = document.getElementById('my-inprogress-list');
    const badge = document.getElementById('my-inprogress-count');
    const section = document.getElementById('my-inprogress-section');

    if (!data.success || data.bookings.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    badge.textContent = data.bookings.length;

    container.innerHTML = data.bookings
      .map(
        (b) => `
      <div class="bg-[#111] border border-blue-500/15 rounded-2xl px-4 py-3 cursor-pointer hover:border-blue-500/30 transition-colors duration-200" onclick="openModalById('${
        b.id
      }')">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-lg font-bold text-blue-400" style="font-family:'Bebas Neue',sans-serif;">#${
            b.queue_number ?? '-'
          }</span>
          <span class="status-badge status-in_progress">In Progress</span>
        </div>
        <p class="text-white text-xs font-medium">${b.guest_name || '-'}</p>
        <p class="text-white/30 text-xs">${b.motorcycle_plate} · ${
          b.service_name
        }${b.variant_name ? ' - ' + b.variant_name : ''}</p>
        <p class="text-white/20 text-[10px] mt-1">${b.reference_code}</p>
      </div>`,
      )
      .join('');
  } catch (err) {
    console.error('Load my in progress error:', err);
  }
};

const openModalById = async (id) => {
  const booking = allBookings.find((b) => b.id === id);
  if (booking) {
    openModal(booking);
    return;
  }
  try {
    const res = await fetch(`/staff/bookings/detail/${id}`);
    const data = await res.json();
    if (data.success) openModal(data.booking);
  } catch (err) {
    console.error(err);
  }
};

const modalField = (icon, label, value) => `
  <div class="flex items-center gap-3 bg-white/2 rounded-xl px-3 py-2">
    <i class="ph ${icon} text-red-500 text-sm flex-shrink-0"></i>
    <div class="min-w-0">
      <p class="text-white/30 text-[10px] uppercase tracking-widest">${label}</p>
      <p class="text-white text-xs font-medium truncate">${value}</p>
    </div>
  </div>`;

const openModal = (b) => {
  currentBooking = b;
  document.getElementById('modal-ref').textContent = b.reference_code;

  const name = b.guest_name || b.customer_name || '-';
  const phone = b.guest_phone || b.customer_phone || '-';
  const email = b.guest_email || b.customer_email || '-';
  const mismatch = isDateMismatch(b.booking_date);

  const canProgress = b.status === 'pending';
  const canDone = b.status === 'in_progress';
  const canPickup = b.status === 'done';
  const canVariant = ['pending', 'in_progress'].includes(b.status);
  const canPaid = !b.is_fully_paid && b.status !== 'picked_up';

  document.getElementById('modal-content').innerHTML = `
    ${
      mismatch
        ? `<div class="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5 mb-4">
      <i class="ph ph-warning text-yellow-400 text-base flex-shrink-0 mt-0.5"></i>
      <p class="text-yellow-300 text-xs">Booking date is <strong>${new Date(
        b.booking_date,
      ).toDateString()}</strong> but today is <strong>${new Date().toDateString()}</strong>. Confirm status changes carefully.</p>
    </div>`
        : ''
    }
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-white/3 rounded-xl px-3 py-2.5">
        <p class="text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Queue</p>
        <p class="text-white font-bold text-lg" style="font-family:'Bebas Neue',sans-serif;">#${
          b.queue_number ?? '-'
        }</p>
      </div>
      <div class="bg-white/3 rounded-xl px-3 py-2.5">
        <p class="text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Status</p>
        <span class="status-badge status-${b.status}">${statusLabel(
          b.status,
        )}</span>
      </div>
    </div>
    <div class="flex flex-col gap-2 mb-4">
      ${modalField('ph-user', 'Customer', name)}
      ${modalField('ph-phone', 'Phone', phone)}
      ${modalField('ph-envelope', 'Email', email)}
      ${modalField('ph-motorcycle', 'Plate', b.motorcycle_plate)}
      ${modalField('ph-car', 'Model', b.motorcycle_model || '-')}
      ${modalField('ph-palette', 'Color', b.motorcycle_color || '-')}
      ${modalField(
        'ph-wrench',
        'Service',
        `${b.service_name} - ${b.variant_name || '-'}`,
      )}
      ${modalField(
        'ph-calendar',
        'Booking Date',
        b.booking_date ? new Date(b.booking_date).toDateString() : '-',
      )}
    </div>
    <div class="bg-white/3 rounded-xl px-4 py-3 mb-4 text-xs space-y-1.5">
      <div class="flex justify-between text-white/50"><span>Total</span><span class="text-white">${fmt(
        b.amount,
      )}</span></div>
      <div class="flex justify-between text-white/50"><span>Paid</span><span class="text-white">${fmt(
        b.amount_paid,
      )}</span></div>
      <div class="flex justify-between text-white/50 border-t border-white/8 pt-1.5"><span>Remaining</span>
        <span class="${
          b.is_fully_paid ? 'text-green-400' : 'text-red-400'
        } font-semibold">${
          b.is_fully_paid ? 'Fully Paid' : fmt(b.remaining_balance)
        }</span>
      </div>
      <div class="flex justify-between text-white/50"><span>Payment</span><span class="text-white uppercase">${
        b.payment_method
      } · ${b.payment_type}</span></div>
    </div>
    <div class="flex flex-col gap-2">
      ${
        canProgress
          ? `<button onclick="triggerStatus('in_progress')" class="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"><i class="ph ph-wrench text-sm"></i> Mark In Progress</button>`
          : ''
      }
      ${
        canDone
          ? `<button onclick="triggerStatus('done')" class="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"><i class="ph ph-check-circle text-sm"></i> Mark Done</button>`
          : ''
      }
      ${
        canPickup
          ? `<button onclick="triggerStatus('picked_up')" class="w-full bg-white/8 hover:bg-white/12 active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"><i class="ph ph-check-square text-sm"></i> Mark Picked Up</button>`
          : ''
      }
      ${
        canVariant
          ? `<button onclick="triggerVariantSwap()" class="w-full border border-orange-500/30 hover:border-orange-500/60 text-orange-400 hover:text-orange-300 text-sm font-medium py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"><i class="ph ph-arrows-left-right text-sm"></i> Change Variant</button>`
          : ''
      }
      ${
        canPaid
          ? `<button onclick="triggerMarkPaid()" class="w-full border border-green-500/20 hover:border-green-500/40 text-green-400 text-sm font-medium py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"><i class="ph ph-money text-sm"></i> Collect & Mark Fully Paid</button>`
          : ''
      }
    </div>`;

  showModal('modal-booking');
};

const closeModal = () => {
  hideModal('modal-booking');
  currentBooking = null;
};

const warnMsg = (b) =>
  isDateMismatch(b.booking_date)
    ? `⚠ Booking date is ${new Date(
        b.booking_date,
      ).toDateString()} but today is ${new Date().toDateString()}. Proceed carefully.`
    : null;

const triggerStatus = async (status) => {
  if (!currentBooking) return;
  const warn = warnMsg(currentBooking);

  if (status === 'in_progress') {
    document.getElementById('inprogress-ref').textContent =
      currentBooking.reference_code;
    document.getElementById('inprogress-confirm-input').value = '';
    document.getElementById('inprogress-input-error').classList.add('hidden');
    const w = document.getElementById('inprogress-warn');
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');
    showModal('modal-inprogress');
    return;
  }

  if (status === 'done') {
    document.getElementById('done-ref-display').textContent =
      currentBooking.reference_code;
    document.getElementById('done-confirm-input').value = '';
    document.getElementById('done-input-error').classList.add('hidden');

    const w = document.getElementById('done-warn');
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');

    // fetch who started this booking as in_progress for ownership warning
    const ownerWarn = document.getElementById('done-owner-warn');
    ownerWarn.classList.add('hidden');
    try {
      const res = await fetch(
        `/staff/bookings/${currentBooking.id}/started-by`,
      );
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

    showModal('modal-done');
    return;
  }

  if (status === 'picked_up') {
    document.getElementById('pickup-ref').textContent =
      currentBooking.reference_code;
    const w = document.getElementById('pickup-warn');
    warn
      ? ((w.textContent = warn), w.classList.remove('hidden'))
      : w.classList.add('hidden');
    showModal('modal-pickup');
  }
};

const commitStatus = async (status) => {
  if (!currentBooking) return;
  try {
    const res = await fetch(`/staff/bookings/${currentBooking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    const idx = allBookings.findIndex((b) => b.id === currentBooking.id);
    if (idx !== -1) allBookings[idx].status = status;
    hideAllActionModals();
    closeModal();
    updateStats();
    applyFilter();
    loadDoneList();
    loadMyInProgress();
  } catch (err) {
    hideAllActionModals();
    closeModal();
    console.error('Commit status error:', err);
  }
};

const triggerVariantSwap = async () => {
  if (!currentBooking) return;
  try {
    const res = await fetch(
      `/staff/services/${currentBooking.service_id}/variants`,
    );
    const data = await res.json();
    if (!data.success) return;
    const select = document.getElementById('variant-select');
    select.innerHTML = data.variants
      .map(
        (v) =>
          `<option value="${v.id}" data-price="${v.price}"${
            v.id === currentBooking.variant_id ? ' selected' : ''
          }>${v.name} - PHP ${parseFloat(v.price).toLocaleString()}</option>`,
      )
      .join('');
    updateVariantPreview();
    showModal('modal-variant');
  } catch (err) {
    console.error(err);
  }
};

const updateVariantPreview = () => {
  const select = document.getElementById('variant-select');
  const opt = select.options[select.selectedIndex];
  if (!opt || !currentBooking) return;
  const newPrice = parseFloat(opt.dataset.price);
  const paid = parseFloat(currentBooking.amount_paid || 0);
  const diff = newPrice - paid;
  const isRefund = diff < 0;
  const isEven = diff === 0;

  document.getElementById('vp-price').textContent = fmt(newPrice);
  document.getElementById('vp-paid').textContent = fmt(paid);

  const remainingEl = document.getElementById('vp-remaining');
  const remainingLabel = document.getElementById('vp-remaining-label');

  if (isEven) {
    remainingLabel.textContent = 'Balance';
    remainingEl.textContent = 'No change';
    remainingEl.className = 'text-white/50 font-semibold';
  } else if (isRefund) {
    remainingLabel.textContent = 'Refund to Customer';
    remainingEl.textContent = fmt(Math.abs(diff));
    remainingEl.className = 'text-yellow-400 font-semibold';
  } else {
    remainingLabel.textContent = 'Remaining to Collect';
    remainingEl.textContent = fmt(diff);
    remainingEl.className = 'text-green-400 font-semibold';
  }

  document.getElementById('variant-balance-preview').classList.remove('hidden');
};

const triggerMarkPaid = () => {
  if (!currentBooking) return;
  document.getElementById('paid-ref').textContent =
    currentBooking.reference_code;
  document.getElementById('paid-amount').textContent = fmt(
    currentBooking.remaining_balance,
  );
  showModal('modal-paid');
};

const commitMarkPaid = async () => {
  if (!currentBooking) return;
  try {
    const res = await fetch(`/staff/bookings/${currentBooking.id}/paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    const idx = allBookings.findIndex((b) => b.id === currentBooking.id);
    if (idx !== -1) {
      allBookings[idx].is_fully_paid = true;
      allBookings[idx].remaining_balance = 0;
    }
    hideModal('modal-paid');
    closeModal();
    applyFilter();
  } catch (err) {
    console.error(err);
  }
};

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/staff/me');
    const data = await res.json();
    if (data.success) {
      document.getElementById('staff-name').textContent = data.user.name;
      currentStaffId = data.user.id;
    }
  } catch (_) {}

  const picker = document.getElementById('date-picker');
  const upcomingPicker = document.getElementById('upcoming-date-filter');
  picker.value = today();
  loadBookings(today());
  loadDoneList();
  loadMyInProgress();

  picker.addEventListener('change', () => {
    if (viewMode === 'today') loadBookings(picker.value, 1);
  });

  upcomingPicker.addEventListener('change', () => {
    upcomingDateFilter = upcomingPicker.value;
    loadUpcoming(1);
  });

  document.querySelectorAll('.view-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.view-toggle')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.view;
      document
        .getElementById('today-controls')
        .classList.toggle('hidden', viewMode !== 'today');
      const uc = document.getElementById('upcoming-controls');
      viewMode === 'upcoming'
        ? uc.classList.replace('hidden', 'flex')
        : uc.classList.replace('flex', 'hidden');
      currentPage = 1;
      viewMode === 'upcoming' ? loadUpcoming(1) : loadBookings(picker.value, 1);
    });
  });

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document
        .querySelectorAll('.filter-tab')
        .forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      applyFilter();
    });
  });

  document
    .getElementById('search-input')
    .addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      if (val.length === 0) {
        viewMode === 'today'
          ? loadBookings(picker.value, currentPage)
          : loadUpcoming(currentPage);
        return;
      }
      if (val.length < 3) return;
      try {
        const res = await fetch(`/staff/bookings/${encodeURIComponent(val)}`);
        const data = await res.json();
        const list = document.getElementById('bookings-list');
        document.getElementById('pagination').innerHTML = '';
        if (!data.success) {
          list.innerHTML = renderEmpty('No booking found');
          return;
        }
        list.innerHTML = renderBookingRow(data.booking);
        list
          .querySelector('.booking-row')
          ?.addEventListener('click', () => openModal(data.booking));
      } catch (_) {}
    });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-booking').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-booking')) closeModal();
  });

  // in progress - retype last 4 chars of reference code
  document.getElementById('inprogress-cancel').addEventListener('click', () => {
    hideModal('modal-inprogress');
    document.getElementById('inprogress-confirm-input').value = '';
    document.getElementById('inprogress-input-error').classList.add('hidden');
  });
  document
    .getElementById('inprogress-confirm')
    .addEventListener('click', () => {
      if (!currentBooking) return;
      const input = document
        .getElementById('inprogress-confirm-input')
        .value.toUpperCase();
      const code8 = currentBooking.reference_code
        .replace('HRC-', '')
        .toUpperCase();
      const errEl = document.getElementById('inprogress-input-error');
      if (input !== code8) {
        errEl.textContent = `Incorrect. Type the 8 characters after HRC- from ${currentBooking.reference_code}.`;
        errEl.classList.remove('hidden');
        return;
      }
      errEl.classList.add('hidden');
      commitStatus('in_progress');
    });

  // done - retype last 4 chars + ownership warning already shown in modal
  document.getElementById('done-cancel').addEventListener('click', () => {
    hideModal('modal-done');
    document.getElementById('done-confirm-input').value = '';
    document.getElementById('done-input-error').classList.add('hidden');
  });
  document.getElementById('done-confirm').addEventListener('click', () => {
    if (!currentBooking) return;
    const input = document
      .getElementById('done-confirm-input')
      .value.toUpperCase();
    const code8 = currentBooking.reference_code
      .replace('HRC-', '')
      .toUpperCase();
    const errEl = document.getElementById('done-input-error');
    if (input !== code8) {
      errEl.textContent = `Incorrect. Type the 8 characters after HRC- from ${currentBooking.reference_code}.`;
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    commitStatus('done');
  });

  // pickup
  document
    .getElementById('pickup-cancel')
    .addEventListener('click', () => hideModal('modal-pickup'));
  document
    .getElementById('pickup-confirm')
    .addEventListener('click', () => commitStatus('picked_up'));

  // paid
  document
    .getElementById('paid-cancel')
    .addEventListener('click', () => hideModal('modal-paid'));
  document
    .getElementById('paid-confirm')
    .addEventListener('click', commitMarkPaid);

  // variant
  document
    .getElementById('variant-cancel')
    .addEventListener('click', () => hideModal('modal-variant'));
  document
    .getElementById('variant-select')
    .addEventListener('change', updateVariantPreview);
  document
    .getElementById('variant-confirm')
    .addEventListener('click', async () => {
      if (!currentBooking) return;
      const variantId = document.getElementById('variant-select').value;
      try {
        const res = await fetch(
          `/staff/bookings/${currentBooking.id}/variant`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variantId }),
          },
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        const idx = allBookings.findIndex((b) => b.id === currentBooking.id);
        if (idx !== -1) {
          allBookings[idx].remaining_balance = data.remaining;
          allBookings[idx].is_fully_paid = data.isFullyPaid;
        }
        hideModal('modal-variant');
        closeModal();
        viewMode === 'today'
          ? loadBookings(picker.value, currentPage)
          : loadUpcoming(currentPage);
      } catch (err) {
        console.error(err);
      }
    });

  // logout
  document
    .getElementById('btn-logout')
    .addEventListener('click', () => showModal('modal-logout'));
  document
    .getElementById('logout-cancel')
    .addEventListener('click', () => hideModal('modal-logout'));
  document
    .getElementById('logout-confirm')
    .addEventListener('click', async () => {
      const res = await fetch('/staff/logout', { method: 'POST' });
      const data = await res.json();
      if (data.redirect) window.location.href = data.redirect;
    });
});
