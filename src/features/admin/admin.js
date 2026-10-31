
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages    = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');
const sidebar   = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');

const pageTitles = {
  dashboard:    'Dashboard',
  bookings:     'Bookings',
  walkins:      'Walk-in Booking',
  services:     'Services',
  availability: 'Availability',
  staff:        'Staff Accounts',
  payments:     'Payments',
  audit:        'Audit Logs',
};

function navigateTo(pageName) {
  pages.forEach((p) => p.classList.remove('active'));
  navItems.forEach((n) => n.classList.remove('active'));

  const targetPage = document.getElementById('page-' + pageName);
  if (targetPage) targetPage.classList.add('active');

  const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (targetNav) targetNav.classList.add('active');

  if (pageTitle) pageTitle.textContent = pageTitles[pageName] || pageName;

  // load data for page
  if (pageName === 'dashboard') loadDashboard();
  if (pageName === 'bookings')  loadBookings();
  if (pageName === 'services')  loadServices();
  if (pageName === 'staff')     loadStaff();
  if (pageName === 'payments')  loadPayments();
  if (pageName === 'audit')     loadAuditLogs();
  if (pageName === 'availability') loadAvailability();
  if (pageName === 'walkins')   loadWalkinData();

  // close mobile sidebar
  sidebar.classList.remove('open');
}

navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

// also handle "View all" btn-text links in cards
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-page]');
  if (btn && btn.classList.contains('btn-text')) {
    e.preventDefault();
    navigateTo(btn.dataset.page);
  }
});

// Mobile menu toggle
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});

function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateEl = document.getElementById('topbarDate');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-PH', options);

  const hour = now.getHours();
  const greetEl = document.getElementById('greetingTime');
  if (greetEl) {
    greetEl.textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  }
}

updateDateTime();
setInterval(updateDateTime, 60000);

async function loadUserInfo() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.success && data.user) {
      const u = data.user;
      const nameEl   = document.getElementById('userName');
      const roleEl   = document.getElementById('userRole');
      const avatarEl = document.getElementById('userAvatar');
      const greetEl  = document.getElementById('greetingName');

      if (nameEl)   nameEl.textContent   = u.name || 'Admin';
      if (roleEl)   roleEl.textContent   = u.role || 'Administrator';
      if (greetEl)  greetEl.textContent  = (u.name || 'Admin').split(' ')[0];
      if (avatarEl) avatarEl.textContent = (u.name || 'A')[0].toUpperCase();
    }
  } catch (err) {
    console.warn('Could not load user info:', err.message);
  }
}

loadUserInfo();

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    window.location.href = '/auth/login';
  });
}

function statusBadge(status) {
  const icons = {
    pending:     'fas fa-clock',
    in_progress: 'fas fa-tools',
    done:        'fas fa-check-circle',
    picked_up:   'fas fa-motorcycle',
    confirmed:   'fas fa-check',
    expired:     'fas fa-times-circle',
    locked:      'fas fa-lock',
    paid:        'fas fa-check-circle',
    unpaid:      'fas fa-times-circle',
    failed:      'fas fa-ban',
    admin:       'fas fa-user-shield',
    staff:       'fas fa-user-cog',
  };
  const icon = icons[status] || 'fas fa-circle';
  return `<span class="status-badge status-${status}"><i class="${icon}"></i>${status.replace('_', ' ')}</span>`;
}

function formatCurrency(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

async function loadDashboard() {
  try {
    const [bookingsRes, statsRes] = await Promise.all([
      fetch('/api/admin/bookings/today'),
      fetch('/api/admin/stats/today'),
    ]);

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

    // Pickup pending
    const pickupRes = await fetch('/api/admin/bookings/pickup-pending');
    if (pickupRes.ok) {
      const pData = await pickupRes.json();
      if (pData.success && pData.data.length > 0) {
        document.getElementById('pickupCard').style.display = 'block';
        renderPickupTable(pData.data);
      }
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderTodayTable(bookings) {
  const tbody = document.getElementById('todayTableBody');
  if (!tbody) return;

  if (!bookings.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state"><i class="fas fa-calendar-times"></i><p>No bookings for today</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><strong>${b.reference_code || '-'}</strong></td>
      <td>
        <strong>${b.guest_name || b.user_name || '-'}</strong><br>
        <small>${b.guest_email || b.user_email || ''}</small>
      </td>
      <td>${b.service_name || '-'} ${b.variant_name ? `<small>(${b.variant_name})</small>` : ''}</td>
      <td>${b.booking_time || '-'}</td>
      <td>${b.payment_method === 'cash' ? '<span class="status-badge status-staff">Cash</span>' : '<span class="status-badge status-info">Online</span>'}</td>
      <td>${statusBadge(b.status)}</td>
      <td>
        <button class="action-btn" onclick="openStatusModal('${b.id}', '${b.status}', '${b.reference_code}')">
          <i class="fas fa-edit"></i> Update
        </button>
      </td>
    </tr>
  `).join('');
}

function renderPickupTable(bookings) {
  const tbody = document.getElementById('pickupTableBody');
  if (!tbody) return;

  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><strong>${b.reference_code || '-'}</strong></td>
      <td><strong>${b.guest_name || '-'}</strong></td>
      <td>${b.service_name || '-'}</td>
      <td>${b.is_fully_paid ? '<span class="status-badge status-paid">Fully Paid</span>' : '<span class="status-badge status-unpaid">Down Payment</span>'}</td>
      <td>${b.remaining_balance > 0 ? `<strong style="color:var(--warning)">${formatCurrency(b.remaining_balance)}</strong>` : '-'}</td>
      <td>
        <button class="action-btn" onclick="openStatusModal('${b.id}', 'done', '${b.reference_code}')">
          <i class="fas fa-check"></i> Mark Picked Up
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadBookings() {
  const statusFilter = document.getElementById('bookingStatusFilter')?.value || '';
  const search = document.getElementById('bookingSearch')?.value || '';

  try {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search)       params.set('search', search);

    const res  = await fetch('/api/admin/bookings?' + params.toString());
    const data = await res.json();

    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    if (!data.success || !data.data.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-state"><i class="fas fa-search"></i><p>No bookings found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.data.map((b) => `
      <tr>
        <td><strong>${b.reference_code || '-'}</strong></td>
        <td>
          <strong>${b.guest_name || b.user_name || '-'}</strong><br>
          <small>${b.guest_email || b.user_email || ''}</small>
        </td>
        <td>${b.service_name || '-'} ${b.variant_name ? `<small>(${b.variant_name})</small>` : ''}</td>
        <td>${formatDate(b.booking_date)} <small>${b.booking_time || ''}</small></td>
        <td>${formatCurrency(b.total_price || b.variant_price)}</td>
        <td>${b.payment_method === 'cash' ? '<span class="status-badge status-staff">Cash</span>' : '<span class="status-badge status-info">Online</span>'}</td>
        <td>${statusBadge(b.status)}</td>
        <td>
          <button class="action-btn" onclick="openStatusModal('${b.id}', '${b.status}', '${b.reference_code}')">
            <i class="fas fa-edit"></i> Update
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load bookings error:', err);
  }
}

// Search & filter
['bookingSearch', 'bookingStatusFilter'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => loadBookings());
});


async function loadServices() {
  try {
    const res  = await fetch('/api/admin/services');
    const data = await res.json();

    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    if (!data.success || !data.data.length) {
      grid.innerHTML = `<div class="full-width"><div class="empty-state"><i class="fas fa-spray-can"></i><p>No services yet. Add your first service.</p></div></div>`;
      return;
    }

    grid.innerHTML = data.data.map((s) => `
      <div class="service-card">
        <div class="service-card-header">
          <span class="service-name">${s.name}</span>
          <span class="service-price">from ${formatCurrency(s.price)}</span>
        </div>
        <div class="service-card-body">
          ${s.description ? `<p class="service-desc">${s.description}</p>` : ''}
          ${s.variants && s.variants.length ? `
            <ul class="variant-list">
              ${s.variants.map((v) => `
                <li class="variant-item">
                  <span>${v.name}</span>
                  <strong>${formatCurrency(v.price)}</strong>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="service-desc" style="font-style:italic;">No variants yet</p>'}
        </div>
        <div class="service-card-footer">
          <button class="action-btn" onclick="editService('${s.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="action-btn" onclick="manageVariants('${s.id}', '${s.name}')"><i class="fas fa-tags"></i> Variants</button>
          <button class="action-btn danger" onclick="deleteService('${s.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load services error:', err);
  }
}

document.getElementById('addServiceBtn')?.addEventListener('click', () => {
  alert('Add Service modal - connect to your API here.');
});

function editService(id)          { alert('Edit service: ' + id); }
function manageVariants(id, name) { alert('Manage variants for: ' + name); }
function deleteService(id)        { if (confirm('Delete this service?')) alert('Delete service: ' + id); }

async function loadAvailability() {
  try {
    const [capRes, closeRes] = await Promise.all([
      fetch('/api/admin/availability'),
      fetch('/api/admin/closed-dates'),
    ]);

    if (capRes.ok) {
      const capData = await capRes.json();
      renderCapacityTable(capData.success ? capData.data : []);
    }

    if (closeRes.ok) {
      const closeData = await closeRes.json();
      renderClosedDates(closeData.success ? closeData.data : []);
    }
  } catch (err) {
    console.error('Load availability error:', err);
  }
}

function renderCapacityTable(rows) {
  const tbody = document.getElementById('capacityTableBody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-calendar-times"></i><p>No capacity set yet</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td>${r.service_name || '-'}</td>
      <td><strong>${r.capacity}</strong></td>
      <td>${r.is_open ? '<span class="status-badge status-confirmed">Open</span>' : '<span class="status-badge status-expired">Closed</span>'}</td>
      <td>
        <button class="action-btn" onclick="editCapacity('${r.id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="action-btn danger" onclick="deleteCapacity('${r.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderClosedDates(rows) {
  const tbody = document.getElementById('closedDatesBody');
  if (!tbody) return;

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><div class="empty-state"><i class="fas fa-calendar-check"></i><p>No closures set</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${r.type === 'recurring' ? '<span class="status-badge status-staff">Recurring</span>' : '<span class="status-badge status-pending">One-time</span>'}</td>
      <td>${r.type === 'recurring' ? days[r.day_of_week] : formatDate(r.date)}</td>
      <td>${r.reason || '-'}</td>
      <td><button class="action-btn danger" onclick="deleteClosedDate('${r.id}')"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

document.getElementById('addCapacityBtn')?.addEventListener('click', () => alert('Set Capacity modal - connect to API.'));
document.getElementById('addClosedBtn')?.addEventListener('click',   () => alert('Add Closure modal - connect to API.'));

function editCapacity(id)     { alert('Edit capacity: ' + id); }
function deleteCapacity(id)   { if (confirm('Remove this capacity entry?')) alert('Delete: ' + id); }
function deleteClosedDate(id) { if (confirm('Remove this closure?')) alert('Delete: ' + id); }


async function loadStaff() {
  try {
    const res  = await fetch('/api/admin/accounts'); 
    const data = await res.json();

    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    if (!data.success || !data.data.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-users"></i><p>No staff accounts found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.data.map((u) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="user-avatar" style="width:32px;height:32px;font-size:12px;border-radius:8px;">${(u.name || '?')[0].toUpperCase()}</div>
            <strong>${u.name}</strong>
          </div>
        </td>
        <td>${u.email}</td>
        <td>${statusBadge(u.role)}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          <button class="action-btn danger" onclick="deleteStaff('${u.id}')"><i class="fas fa-user-times"></i> Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load staff error:', err);
  }
}

document.getElementById('addStaffBtn')?.addEventListener('click', () => alert('Add Staff - redirect to signup or modal.'));

function deleteStaff(id) { if (confirm('Remove this account?')) alert('Delete staff: ' + id); }

async function loadPayments() {
  try {
    const res  = await fetch('/api/admin/payments');
    const data = await res.json();

    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (!data.success || !data.data.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-state"><i class="fas fa-receipt"></i><p>No payment records</p></div></td></tr>`;
      return;
    }

    let totalPaid = 0, totalBalance = 0;

    tbody.innerHTML = data.data.map((p) => {
      totalPaid    += Number(p.amount_paid || 0);
      totalBalance += Number(p.remaining_balance || 0);
      return `
        <tr>
          <td><strong>${p.reference_code || '-'}</strong></td>
          <td>${p.guest_name || p.user_name || '-'}</td>
          <td>${formatCurrency(p.amount)}</td>
          <td><strong style="color:var(--success)">${formatCurrency(p.amount_paid)}</strong></td>
          <td>${p.remaining_balance > 0 ? `<strong style="color:var(--warning)">${formatCurrency(p.remaining_balance)}</strong>` : '-'}</td>
          <td>${p.is_fully_paid ? '<span class="status-badge status-confirmed">Paid in full</span>' : '<span class="status-badge status-pending">Deposit</span>'}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${formatDateTime(p.paid_at)}</td>
        </tr>
      `;
    }).join('');

    setText('statPaidTotal', formatCurrency(totalPaid));
    setText('statUnpaidTotal', formatCurrency(totalBalance));
  } catch (err) {
    console.error('Load payments error:', err);
  }
}

async function loadAuditLogs() {
  try {
    const res  = await fetch('/api/admin/audit-logs');
    const data = await res.json();

    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (!data.success || !data.data.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-clipboard-list"></i><p>No audit logs found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.data.map((l) => `
      <tr>
        <td><strong>${l.action}</strong></td>
        <td>${l.user_name || 'System'}</td>
        <td><code style="font-size:11px;background:var(--dark-3);padding:2px 6px;border-radius:4px;">${l.target_table || '-'}</code></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.details || '-'}</td>
        <td>${formatDateTime(l.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load audit logs error:', err);
  }
}
async function loadWalkinData() {
  try {
    // Load services for the form
    const res  = await fetch('/api/admin/services');
    const data = await res.json();

    const wiService = document.getElementById('wi_service');
    if (wiService && data.success) {
      wiService.innerHTML = '<option value="">-- Select service --</option>' +
        data.data.map((s) => `<option value="${s.id}" data-variants='${JSON.stringify(s.variants || [])}'>${s.name}</option>`).join('');
    }

    // Capacity for today
    const today = new Date().toISOString().split('T')[0];
    const capRes  = await fetch('/api/admin/availability?date=' + today);
    const capData = await capRes.json();

    const capList = document.getElementById('todayCapacityList');
    if (capList && capData.success && capData.data.length) {
      capList.innerHTML = capData.data.map((c) => {
        const used = c.bookings_count || 0;
        const remaining = c.capacity - used;
        const cls = remaining === 0 ? 'low' : remaining <= 2 ? 'mid' : 'ok';
        return `<div class="capacity-item">
          <span class="capacity-name">${c.service_name}</span>
          <span class="capacity-count ${cls}">${remaining} / ${c.capacity} left</span>
        </div>`;
      }).join('');
    } else if (capList) {
      capList.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>No capacity set for today</p></div>`;
    }
  } catch (err) {
    console.error('Load walkin data error:', err);
  }
}

// Service -> variant chain
document.getElementById('wi_service')?.addEventListener('change', function () {
  const selected = this.options[this.selectedIndex];
  const variantEl = document.getElementById('wi_variant');
  const summary = document.getElementById('walkinSummary');

  if (!variantEl) return;

  let variants = [];
  try { variants = JSON.parse(selected.dataset.variants || '[]'); } catch (_) {}

  variantEl.innerHTML = variants.length
    ? '<option value="">-- Select size/variant --</option>' + variants.map((v) => `<option value="${v.id}" data-price="${v.price}">${v.name} - ₱${Number(v.price).toLocaleString()}</option>`).join('')
    : '<option value="">No variants available</option>';

  variantEl.disabled = variants.length === 0;
  if (summary) summary.style.display = 'none';

  updateWalkinSummary();
});

document.getElementById('wi_variant')?.addEventListener('change', updateWalkinSummary);

function updateWalkinSummary() {
  const serviceEl = document.getElementById('wi_service');
  const variantEl = document.getElementById('wi_variant');
  const summary   = document.getElementById('walkinSummary');
  if (!summary) return;

  const serviceName = serviceEl?.options[serviceEl.selectedIndex]?.text || '';
  const variantOpt  = variantEl?.options[variantEl.selectedIndex];
  const variantName = variantOpt?.text || '';
  const price       = variantOpt?.dataset?.price || '0';

  if (serviceEl?.value && variantEl?.value) {
    summary.style.display = 'block';
    setText('summary_service', serviceName);
    setText('summary_variant', variantName);
    setText('summary_amount', formatCurrency(price));
  } else {
    summary.style.display = 'none';
  }
}

// Walk-in form submit
document.getElementById('walkinForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name    = document.getElementById('wi_name')?.value.trim();
  const phone   = document.getElementById('wi_phone')?.value.trim();
  const service = document.getElementById('wi_service')?.value;
  const variant = document.getElementById('wi_variant')?.value;

  let valid = true;

  if (!name || name.length < 2) {
    setWiError('wi_name', 'Name is required'); valid = false;
  } else clearWiError('wi_name');

  if (!phone || phone.replace(/\D/g,'').length !== 11) {
    setWiError('wi_phone', 'Valid 11-digit phone required'); valid = false;
  } else clearWiError('wi_phone');

  if (!service) {
    setWiError('wi_service', 'Select a service'); valid = false;
  } else clearWiError('wi_service');

  if (!variant) {
    setWiError('wi_variant', 'Select a variant'); valid = false;
  } else clearWiError('wi_variant');

  if (!valid) return;

  const btn = document.getElementById('walkinSubmit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }

  const payload = {
    guest_name:              name,
    guest_email:             document.getElementById('wi_email')?.value.trim() || null,
    guest_phone:             phone,
    service_id:              service,
    variant_id:              variant,
    motorcycle_plate:        document.getElementById('wi_plate')?.value.trim() || null,
    motorcycle_description:  document.getElementById('wi_desc')?.value.trim() || null,
    is_walkin:               true,
    payment_method:          'cash',
  };

  try {
    const res  = await fetch('/api/admin/bookings/walkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    const msgEl = document.getElementById('walkinMessage');
    if (data.success) {
      if (msgEl) {
        msgEl.className = 'form-message success';
        msgEl.innerHTML = `<i class="fas fa-check-circle"></i> Walk-in booked! Ref: <strong>${data.reference_code}</strong> - Queue #${data.queue_number}`;
        msgEl.style.display = 'flex';
      }
      document.getElementById('walkinForm').reset();
      document.getElementById('walkinSummary').style.display = 'none';
    } else {
      if (msgEl) {
        msgEl.className = 'form-message error';
        msgEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message || 'Booking failed'}`;
        msgEl.style.display = 'flex';
      }
    }
  } catch (err) {
    const msgEl = document.getElementById('walkinMessage');
    if (msgEl) {
      msgEl.className = 'form-message error';
      msgEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Network error. Try again.';
      msgEl.style.display = 'flex';
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Walk-in Booking'; }
  }
});

function setWiError(id, msg) {
  const errEl = document.getElementById(id + 'Error');
  if (errEl) errEl.textContent = msg;
  const field = document.getElementById(id);
  if (field) field.classList.add('is-error');
}

function clearWiError(id) {
  const errEl = document.getElementById(id + 'Error');
  if (errEl) errEl.textContent = '';
  const field = document.getElementById(id);
  if (field) field.classList.remove('is-error');
}

let currentBookingId = null;
let selectedStatus   = null;

const statusFlow = {
  pending:     [{ value: 'in_progress', label: 'Mark In Progress', icon: 'fas fa-tools' }],
  in_progress: [{ value: 'done',        label: 'Mark Done',        icon: 'fas fa-check-circle' }],
  done:        [{ value: 'picked_up',   label: 'Mark Picked Up',   icon: 'fas fa-motorcycle' }],
  picked_up:   [],
};

function openStatusModal(bookingId, currentStatus, refCode) {
  currentBookingId = bookingId;
  selectedStatus   = null;

  const modal     = document.getElementById('statusModal');
  const title     = document.getElementById('modalTitle');
  const options   = document.getElementById('statusOptions');
  const confirmBtn = document.getElementById('modalConfirm');

  if (!modal) return;

  title.textContent = `Update: ${refCode}`;

  const nextStatuses = statusFlow[currentStatus] || [];
  if (!nextStatuses.length) {
    options.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No further status updates available.</p>';
    confirmBtn.style.display = 'none';
  } else {
    confirmBtn.style.display = 'inline-flex';
    options.innerHTML = nextStatuses.map((s) => `
      <div class="status-option" data-value="${s.value}" onclick="selectStatus(this, '${s.value}')">
        <i class="${s.icon}"></i> ${s.label}
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
}

function selectStatus(el, value) {
  document.querySelectorAll('.status-option').forEach((o) => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedStatus = value;
}

document.getElementById('modalClose')?.addEventListener('click',  closeModal);
document.getElementById('modalCancel')?.addEventListener('click', closeModal);

document.getElementById('statusModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'statusModal') closeModal();
});

function closeModal() {
  document.getElementById('statusModal').style.display = 'none';
}

document.getElementById('modalConfirm')?.addEventListener('click', async () => {
  if (!selectedStatus || !currentBookingId) {
    alert('Please select a status first.');
    return;
  }

  try {
    const res  = await fetch(`/api/admin/bookings/${currentBookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: selectedStatus }),
    });
    const data = await res.json();

    if (data.success) {
      closeModal();
      loadDashboard();
      loadBookings();
    } else {
      alert('Failed to update: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Network error. Try again.');
  }
});


document.getElementById('refreshDashboard')?.addEventListener('click', loadDashboard);
navigateTo('dashboard');
