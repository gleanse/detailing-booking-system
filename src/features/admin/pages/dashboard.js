AdminLayout.init({ activePage: 'dashboard', breadcrumb: 'Dashboard' });

// Greeting time
const hour = new Date().getHours();
const greetEl = document.getElementById('greetingTime');
if (greetEl) greetEl.textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

// Helpers
const { statusBadge, formatCurrency, formatDate, skeletonTableRows } = AdminLayout;
const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

//  Status Modal 
let currentBookingId = null, selectedStatus = null, currentRefCode = null;
const statusFlow = {
  pending:     [{ value: 'in_progress', label: 'Mark In Progress', icon: 'fas fa-tools' }],
  in_progress: [{ value: 'done',        label: 'Mark Done',        icon: 'fas fa-check-circle' }],
  done:        [{ value: 'picked_up',   label: 'Mark Picked Up',   icon: 'fas fa-motorcycle' }],
  picked_up:   [],
};

//  Open Modal 
function openStatusModal(bookingId, currentStatus, refCode) {
  currentBookingId = bookingId;
  selectedStatus   = null;
  currentRefCode   = refCode;

  document.getElementById('modalTitle').textContent = `Update: ${refCode}`;

  const options    = document.getElementById('statusOptions');
  const confirmBtn = document.getElementById('modalConfirm');
  const refStep    = document.getElementById('refConfirmStep');

  // Reset ref confirmation
  resetRefInput();
  refStep.style.display = 'none';
  confirmBtn.disabled   = true;

  const nextStatuses = statusFlow[currentStatus] || [];
  if (!nextStatuses.length) {
    options.innerHTML = '<p style="color:var(--color-admin-muted);font-size:13px;">No further updates available.</p>';
    confirmBtn.style.display = 'none';
  } else {
    confirmBtn.style.display = 'inline-flex';
    options.innerHTML = nextStatuses.map(s => `
      <div class="status-option" data-value="${s.value}" onclick="selectStatus(this,'${s.value}')">
        <i class="${s.icon}"></i> ${s.label}
      </div>`).join('');
  }

  document.getElementById('statusModal').style.display = 'flex';
}

function selectStatus(el, value) {
  document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedStatus = value;

  // Show the ref confirmation step
  const refStep = document.getElementById('refConfirmStep');
  refStep.style.display = 'block';
  resetRefInput();
  document.getElementById('refConfirmInput').focus();
}

function resetRefInput() {
  const input   = document.getElementById('refConfirmInput');
  const wrap    = document.getElementById('refInputWrap');
  const errMsg  = document.getElementById('refErrorMsg');
  const confirm = document.getElementById('modalConfirm');

  if (input)   { input.value = ''; input.className = ''; }
  if (wrap)    { wrap.className = 'ref-input-wrap'; }
  if (errMsg)  { errMsg.style.display = 'none'; }
  if (confirm) { confirm.disabled = true; }
}

document.getElementById('refConfirmInput')?.addEventListener('input', function () {
  const typed   = this.value.trim().toUpperCase();
  const target  = (currentRefCode || '').trim().toUpperCase();
  const wrap    = document.getElementById('refInputWrap');
  const errMsg  = document.getElementById('refErrorMsg');
  const confirm = document.getElementById('modalConfirm');

  if (!typed) {
    wrap.className    = 'ref-input-wrap';
    errMsg.style.display = 'none';
    confirm.disabled  = true;
    return;
  }

  if (typed === target) {
    wrap.className       = 'ref-input-wrap is-success';
    errMsg.style.display = 'none';
    confirm.disabled     = false;
  } else {
    wrap.className       = 'ref-input-wrap is-error';
    errMsg.style.display = 'block';
    confirm.disabled     = true;
  }
});

const closeModal = () => document.getElementById('statusModal').style.display = 'none';
document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalCancel')?.addEventListener('click', closeModal);
document.getElementById('statusModal')?.addEventListener('click', e => { if (e.target.id === 'statusModal') closeModal(); });

document.getElementById('modalConfirm')?.addEventListener('click', async () => {
  if (!selectedStatus || !currentBookingId) { alert('Select a status first.'); return; }
  const res  = await fetch(`/api/admin/bookings/${currentBookingId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: selectedStatus }),
  });
  const data = await res.json();
  if (data.success) { closeModal(); loadDashboard(); }
  else alert('Failed: ' + (data.message || 'Unknown error'));
});

//  Render 
function renderTodayTable(bookings) {
  const tbody = document.getElementById('todayTableBody');
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-calendar-times"></i><p>No bookings for today</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td><strong>${b.reference_code || '-'}</strong></td>
      <td><strong>${b.guest_name || b.user_name || '-'}</strong><br><small>${b.guest_email || ''}</small></td>
      <td>${b.service_name || '-'} ${b.variant_name ? `<small>(${b.variant_name})</small>` : ''}</td>
      <td>${b.payment_method === 'cash'
        ? '<span class="status-badge status-staff">Cash</span>'
        : '<span class="status-badge status-info">Online</span>'}</td>
      <td>${statusBadge(b.status)}</td>
      <td><button class="action-btn" onclick="openStatusModal('${b.id}','${b.status}','${b.reference_code}')">
        <i class="fas fa-edit"></i> Update</button></td>
    </tr>`).join('');
}

function renderPickupTable(bookings) {
  const tbody = document.getElementById('pickupTableBody');
  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td><strong>${b.reference_code || '-'}</strong></td>
      <td><strong>${b.guest_name || '-'}</strong></td>
      <td>${b.service_name || '-'}</td>
      <td>${b.is_fully_paid
        ? '<span class="status-badge status-paid">Fully Paid</span>'
        : '<span class="status-badge status-unpaid">Down Payment</span>'}</td>
      <td>${b.remaining_balance > 0
        ? `<strong style="color:var(--color-admin-warning)">${formatCurrency(b.remaining_balance)}</strong>`
        : '-'}</td>
      <td><button class="action-btn" onclick="openStatusModal('${b.id}','done','${b.reference_code}')">
        <i class="fas fa-check"></i> Mark Picked Up</button></td>
    </tr>`).join('');
}

//  Load 
async function loadDashboard() {
  const tbody = document.getElementById('todayTableBody');
  const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    tbody.innerHTML = skeletonTableRows(6, 5);
  });
  try {
    const [bookingsRes, statsRes] = await Promise.all([
      fetch('/api/admin/bookings/today'),
      fetch('/api/admin/stats/today'),
    ]);
    cancelSkeleton();
    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (stats.success) {
        const s = stats.data;
        setText('statBookingsToday', s.total    ?? '-');
        setText('statPending',       s.pending  ?? '-');
        setText('statInProgress',    s.in_progress ?? '-');
        setText('statDone',          s.done     ?? '-');
        const badge = document.getElementById('pendingBadge');
        if (badge) badge.textContent = s.pending || 0;
      }
    }
    if (bookingsRes.ok) {
      const bData = await bookingsRes.json();
      renderTodayTable(bData.success ? bData.data : []);
    }
    const pickupRes = await fetch('/api/admin/bookings/pickup-pending');
    if (pickupRes.ok) {
      const pData = await pickupRes.json();
      if (pData.success && pData.data.length > 0) {
        document.getElementById('pickupCard').style.display = 'block';
        renderPickupTable(pData.data);
      } else {
        document.getElementById('pickupCard').style.display = 'none';
      }
    }
  } catch (err) {
    cancelSkeleton();
    console.error('Dashboard load error:', err);
  }
}

document.getElementById('refreshDashboard')?.addEventListener('click', async () => {
  const btn = document.getElementById('refreshDashboard');
  const icon = btn?.querySelector('i');
  btn.disabled = true;
  icon?.classList.add('fa-spin');
  await loadDashboard();
  icon?.classList.remove('fa-spin');
  btn.disabled = false;
});

loadDashboard();