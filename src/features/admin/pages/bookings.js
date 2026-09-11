 AdminLayout.init({ activePage: 'bookings', breadcrumb: 'Bookings' });

  const { statusBadge, formatCurrency, formatDate, skeletonTableRows } = AdminLayout;

  let currentBookingId  = null;
  let selectedStatus    = null;
  let currentRefCode    = null;  

  const statusFlow = {
    pending:     [{ value: 'in_progress', label: 'Mark In Progress', icon: 'fas fa-tools' }],
    in_progress: [{ value: 'done',        label: 'Mark Done',        icon: 'fas fa-check-circle' }],
    done:        [{ value: 'picked_up',   label: 'Mark Picked Up',   icon: 'fas fa-motorcycle' }],
    picked_up:   [],
  };

  function openStatusModal(bookingId, currentStatus, refCode) {
    currentBookingId = bookingId;
    selectedStatus   = null;
    currentRefCode   = refCode;

    document.getElementById('modalTitle').textContent = `Update: ${refCode}`;

    const options    = document.getElementById('statusOptions');
    const confirmBtn = document.getElementById('modalConfirm');
    const refStep    = document.getElementById('refConfirmStep');

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

  
  const closeModal = () => {
    document.getElementById('statusModal').style.display = 'none';
    resetRefInput();
  };

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  document.getElementById('statusModal')?.addEventListener('click', e => {
    if (e.target.id === 'statusModal') closeModal();
  });

  document.getElementById('modalConfirm')?.addEventListener('click', async () => {
    if (!selectedStatus || !currentBookingId) { alert('Select a status first.'); return; }

    const typed  = (document.getElementById('refConfirmInput')?.value || '').trim().toUpperCase();
    const target = (currentRefCode || '').trim().toUpperCase();
    if (typed !== target) {
      const wrap = document.getElementById('refInputWrap');
      wrap.classList.add('shake');
      wrap.addEventListener('animationend', () => wrap.classList.remove('shake'), { once: true });
      return;
    }

    const confirmBtn = document.getElementById('modalConfirm');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      const res  = await fetch(`/api/admin/bookings/${currentBookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const data = await res.json();
      if (data.success) { closeModal(); loadBookings(); }
      else alert('Failed: ' + (data.message || 'Unknown error'));
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Confirm';
    }
  });

  async function loadBookings() {
    const status = document.getElementById('bookingStatusFilter')?.value || '';
    const search = document.getElementById('bookingSearch')?.value || '';
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const tbody = document.getElementById('bookingsTableBody');
    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    tbody.innerHTML = AdminLayout.skeletonTableRows(8, 6);
    });

    try {
      const res  = await fetch('/api/admin/bookings?' + params.toString());
      const data = await res.json();
      cancelSkeleton();
      if (!data.success || !data.data.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-search"></i><p>No bookings found</p></div></td></tr>`;
        return;
      }
      tbody.innerHTML = data.data.map(b => `
        <tr>
          <td><strong>${b.reference_code || '-'}</strong></td>
          <td><strong>${b.guest_name || b.user_name || '-'}</strong><br><small>${b.guest_email || ''}</small></td>
          <td>${b.service_name || '-'} ${b.variant_name ? `<small>(${b.variant_name})</small>` : ''}</td>
          <td>${formatDate(b.booking_date)}</td>
          <td>${formatCurrency(b.total_price || b.variant_price)}</td>
          <td>${b.payment_method === 'cash'
            ? '<span class="status-badge status-staff">Cash</span>'
            : '<span class="status-badge status-info">Online</span>'}</td>
          <td>${statusBadge(b.status)}</td>
          <td>
            <button class="action-btn" onclick="openStatusModal('${b.id}','${b.status}','${b.reference_code}')">
              <i class="fas fa-edit"></i> Update
            </button>
          </td>
        </tr>`).join('');
    } catch (err) {
      cancelSkeleton();
      console.error('Load bookings error:', err);
    }
  }

  ['bookingSearch', 'bookingStatusFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', loadBookings);
  });

  loadBookings();