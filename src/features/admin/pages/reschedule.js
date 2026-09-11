 AdminLayout.init({ activePage: 'reschedule', breadcrumb: 'Reschedule' });

  let currentUser = null;

  // Access check
  async function boot() {
    try {
      const res  = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.success) { window.location.href = '/auth/login'; return; }
      currentUser = data.user;
      if (currentUser.role !== 'admin') {
        document.getElementById('pageRoot').innerHTML = `
          <div class="access-denied">
            <i class="fas fa-shield-alt ad-icon"></i>
            <h3>Admin Only</h3>
            <p>Only administrators can reschedule bookings. Contact your admin if this is needed.</p>
            <a href="/admin/dashboard" class="btn-secondary" style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;">
              <i class="fas fa-arrow-left"></i> Back to Dashboard
            </a>
          </div>`;
        return;
      }
      renderPage();
    } catch (_) { window.location.href = '/auth/login'; }
  }

  function renderPage() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('pageRoot').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Reschedule</h1>
          <p class="page-sub">Bulk move confirmed bookings to a new available date</p>
        </div>
      </div>

      <div class="rs-grid">

        <!-- Step 1: Select bookings -->
        <div class="step-card">
          <div class="step-hdr">
            <div class="step-num">1</div>
            <div class="step-hdr-text">
              <div class="t">Select Bookings</div>
              <div class="s">Choose source date and service, then pick bookings to move</div>
            </div>
          </div>
          <div class="step-body">
            <div class="rs-field">
              <label><i class="fas fa-spray-can"></i> Service <span style="color:var(--color-admin-danger, #dc2626)">*</span></label>
              <select id="rs_service" onchange="loadSourceBookings()">
                <option value="">-- Select service --</option>
              </select>
            </div>
            <div class="rs-field">
              <label><i class="fas fa-calendar"></i> Source Date <span style="color:var(--color-admin-danger, #dc2626)">*</span></label>
              <input type="date" id="rs_from_date" onchange="loadSourceBookings()">
              <p class="fhint">The date you want to move bookings FROM.</p>
            </div>

            <div id="rsBookingsWrap" style="display:none;">
              <div class="rs-select-bar">
                <label>
                  <input type="checkbox" id="rsSelectAll" onchange="toggleAll(this)">
                  Select all confirmed
                </label>
                <span><span class="rs-count" id="rsSelectedCount">0</span> selected</span>
              </div>
              <div class="rs-booking-list" id="rsBookingList"></div>
            </div>
            <div id="rsBookingsEmpty" class="empty-state" style="padding:24px;display:none;">
              <i class="fas fa-calendar-times"></i>
              <p>No confirmed bookings for this date and service</p>
            </div>
          </div>
        </div>

        <!-- Step 2 + 3 stacked -->
        <div style="display:flex;flex-direction:column;gap:16px;">

          <!-- Step 2: New date -->
          <div class="step-card">
            <div class="step-hdr">
              <div class="step-num">2</div>
              <div class="step-hdr-text">
                <div class="t">Choose New Date</div>
                <div class="s">Must have capacity for all selected bookings</div>
              </div>
            </div>
            <div class="step-body">
              <div class="rs-field">
                <label><i class="fas fa-calendar-plus"></i> New Date <span style="color:var(--color-admin-danger, #dc2626)">*</span></label>
                <input type="date" id="rs_to_date" min="${today}" onchange="checkNewDateCap()">
              </div>
              <div class="cap-check" id="rsCapCheck"></div>
            </div>
          </div>

          <!-- Step 3: Review -->
          <div class="step-card" id="rsSummaryCard" style="display:none;">
            <div class="step-hdr">
              <div class="step-num">3</div>
              <div class="step-hdr-text">
                <div class="t">Review & Confirm</div>
                <div class="s">Double-check before executing</div>
              </div>
            </div>
            <div class="step-body">
              <div class="rs-summary-box">
                <div class="rsb-row"><span>Service</span><span id="rsm_service">-</span></div>
                <div class="rsb-row"><span>From</span><span id="rsm_from">-</span></div>
                <div class="rsb-row"><span>To</span><span id="rsm_to">-</span></div>
                <div class="rsb-row big"><span>Bookings to Move</span><span id="rsm_count">0</span></div>
              </div>
              <button class="btn-primary full-width" onclick="openConfirmModal()">
                <i class="fas fa-calendar-alt"></i> Reschedule Bookings
              </button>
              <div id="rsPageMsg" style="margin-top:10px;"></div>
            </div>
          </div>

        </div>
      </div>`;

    loadServicesDropdown();
  }

  async function loadServicesDropdown() {
    try {
      const res  = await fetch('/api/admin/services');
      const data = await res.json();
      const sel  = document.getElementById('rs_service');
      if (!sel || !data.success) return;
      data.data.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name; sel.appendChild(opt);
      });
    } catch (_) {}
  }

  //  Load source bookings 
  async function loadSourceBookings() {
    const svcId    = document.getElementById('rs_service')?.value;
    const fromDate = document.getElementById('rs_from_date')?.value;
    const wrap     = document.getElementById('rsBookingsWrap');
    const emptyEl  = document.getElementById('rsBookingsEmpty');
    const list     = document.getElementById('rsBookingList');

    if (wrap)    wrap.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    hideSummary();

    if (!svcId || !fromDate) return;

    const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    if (list) list.innerHTML = AdminLayout.skeletonListItems(3);
    });
    if (wrap) wrap.style.display = 'block';

    try {
      const params = new URLSearchParams({ service_id: svcId, date: fromDate, status: 'confirmed' });
      const res  = await fetch('/api/admin/bookings/by-date?' + params.toString());
      const data = await res.json();
      cancelSkeleton();

      if (!data.success || !data.data.length) {
        wrap.style.display  = 'none';
        emptyEl.style.display = 'flex';
        return;
      }

      list.innerHTML = data.data.map(b => `
        <div class="rs-bk-item" onclick="toggleBooking('${b.id}', this)">
          <input type="checkbox" class="rs-cb" data-id="${b.id}" id="rscb_${b.id}"
            onclick="event.stopPropagation(); onCbChange()">
          <div class="rs-bk-info">
            <div class="rs-bk-name">${b.guest_name || b.user_name || 'Guest'}</div>
            <div class="rs-bk-meta">${b.service_name || ''}${b.variant_name ? ` · ${b.variant_name}` : ''}</div>
            <div class="rs-bk-ref">${b.reference_code || ''}</div>
          </div>
          ${b.guest_email ? `<i class="fas fa-envelope rs-email-icon" title="Has email - will be notified"></i>` : ''}
        </div>`).join('');

      onCbChange();
    } catch (_) {
      cancelSkeleton();
      if (list) list.innerHTML = `<div class="empty-state" style="padding:16px;"><i class="fas fa-exclamation-triangle"></i><p>Failed to load bookings</p></div>`;
    }
  }

  function toggleBooking(id, row) {
    const cb = document.getElementById('rscb_' + id);
    if (cb) cb.checked = !cb.checked;
    onCbChange();
  }

  function toggleAll(masterCb) {
    document.querySelectorAll('.rs-cb').forEach(cb => { cb.checked = masterCb.checked; });
    onCbChange();
  }

  function onCbChange() {
    const selected  = getSelectedIds();
    const allCbs    = document.querySelectorAll('.rs-cb');
    const countEl   = document.getElementById('rsSelectedCount');
    const masterCb  = document.getElementById('rsSelectAll');

    if (countEl) countEl.textContent = selected.length;
    if (masterCb && allCbs.length) {
      masterCb.indeterminate = selected.length > 0 && selected.length < allCbs.length;
      masterCb.checked = selected.length === allCbs.length && allCbs.length > 0;
    }

    checkSummaryReady();
  }

  function getSelectedIds() {
    return [...document.querySelectorAll('.rs-cb:checked')].map(cb => cb.dataset.id);
  }

  //  Check new date capacity 
  async function checkNewDateCap() {
    const svcId  = document.getElementById('rs_service')?.value;
    const toDate = document.getElementById('rs_to_date')?.value;
    const capEl  = document.getElementById('rsCapCheck');
    if (capEl) capEl.className = 'cap-check';

    if (!svcId || !toDate) return;

    const selected = getSelectedIds().length;

    try {
      const res  = await fetch('/api/admin/availability?date=' + toDate);
      const data = await res.json();
      const cap  = (data.data || []).find(c => c.service_id === svcId);

      if (!cap) {
        capEl.className = 'cap-check err';
        capEl.innerHTML = `<i class="fas fa-times-circle"></i> No capacity configured for this service on this date. <a href="/admin/availability" style="color:var(--color-admin-danger);text-decoration:underline;margin-left:4px;">Set it up →</a>`;
        checkSummaryReady(); return;
      }

      const rem = cap.capacity - (parseInt(cap.bookings_count) || 0);

      if (selected > 0 && rem < selected) {
        capEl.className = 'cap-check err';
        capEl.innerHTML = `<i class="fas fa-times-circle"></i> Not enough slots: <strong>${rem}</strong> available, <strong>${selected}</strong> bookings selected.`;
      } else {
        capEl.className = 'cap-check ok';
        capEl.innerHTML = `<i class="fas fa-check-circle"></i> <strong>${rem}</strong> slot(s) available on this date - enough for <strong>${selected || 'selected'}</strong> booking(s).`;
      }
    } catch (_) {
      capEl.className = 'cap-check warn';
      capEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Could not verify capacity.';
    }

    checkSummaryReady();
  }

  function checkSummaryReady() {
    const svcId    = document.getElementById('rs_service')?.value;
    const fromDate = document.getElementById('rs_from_date')?.value;
    const toDate   = document.getElementById('rs_to_date')?.value;
    const count    = getSelectedIds().length;
    const card     = document.getElementById('rsSummaryCard');
    if (!card) return;

    if (svcId && fromDate && toDate && count > 0) {
      card.style.display = 'block';
      const svcName  = document.getElementById('rs_service').options[document.getElementById('rs_service').selectedIndex]?.text || '-';
      const fmtDate  = d => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'short', month:'long', day:'numeric', year:'numeric'});
      document.getElementById('rsm_service').textContent = svcName;
      document.getElementById('rsm_from').textContent    = fmtDate(fromDate);
      document.getElementById('rsm_to').textContent      = fmtDate(toDate);
      document.getElementById('rsm_count').textContent   = count;
    } else {
      card.style.display = 'none';
    }
  }

  function hideSummary() {
    const card = document.getElementById('rsSummaryCard');
    if (card) card.style.display = 'none';
    const capEl = document.getElementById('rsCapCheck');
    if (capEl) capEl.className = 'cap-check';
  }

  //  Confirm Modal 
  function openConfirmModal() {
    const capEl = document.getElementById('rsCapCheck');
    if (capEl.classList.contains('err')) {
      alert('Resolve the capacity issue before proceeding.'); return;
    }

    const svcName  = document.getElementById('rs_service').options[document.getElementById('rs_service').selectedIndex]?.text || '-';
    const fromDate = document.getElementById('rs_from_date').value;
    const toDate   = document.getElementById('rs_to_date').value;
    const count    = getSelectedIds().length;
    const fmtDate  = d => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'long', month:'long', day:'numeric', year:'numeric'});

    document.getElementById('rs_confirm_service').textContent = svcName;
    document.getElementById('rs_confirm_from').textContent    = fmtDate(fromDate);
    document.getElementById('rs_confirm_to').textContent      = fmtDate(toDate);
    document.getElementById('rs_confirm_count').textContent   = `${count} booking(s)`;
    document.getElementById('rsConfirmPassword').value = '';
    document.getElementById('rsConfirmPassword').type  = 'password';
    document.getElementById('rsPwIcon').className      = 'fas fa-eye';
    document.getElementById('rsConfirmMsg').className  = 'modal-msg';
    document.getElementById('confirmRescheduleModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('rsConfirmPassword').focus(), 100);
  }

  document.getElementById('rsCancelBtn').addEventListener('click', () => {
    document.getElementById('confirmRescheduleModal').classList.add('hidden');
  });
  document.getElementById('confirmRescheduleModal').addEventListener('click', e => {
    if (e.target.id === 'confirmRescheduleModal') document.getElementById('confirmRescheduleModal').classList.add('hidden');
  });

  document.getElementById('rsPwToggle').addEventListener('click', () => {
    const inp  = document.getElementById('rsConfirmPassword');
    const icon = document.getElementById('rsPwIcon');
    const hide = inp.type === 'password';
    inp.type       = hide ? 'text' : 'password';
    icon.className = hide ? 'fas fa-eye-slash' : 'fas fa-eye';
  });

  document.getElementById('rsConfirmPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('rsExecuteBtn').click();
  });

  document.getElementById('rsExecuteBtn').addEventListener('click', async () => {
    const password = document.getElementById('rsConfirmPassword').value;
    if (!password) { showConfirmMsg('error', 'Please enter your password.'); return; }

    const btn = document.getElementById('rsExecuteBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const res  = await fetch('/api/admin/bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ids: getSelectedIds(),
          from_date:   document.getElementById('rs_from_date').value,
          new_date:    document.getElementById('rs_to_date').value,
          service_id:  document.getElementById('rs_service').value,
          password,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showConfirmMsg('success', `✓ ${data.rescheduled} booking(s) moved. ${data.notified || 0} customer(s) notified.`);
        setTimeout(() => {
          document.getElementById('confirmRescheduleModal').classList.add('hidden');
          // Reset
          document.getElementById('rs_service').value   = '';
          document.getElementById('rs_from_date').value = '';
          document.getElementById('rs_to_date').value   = '';
          document.getElementById('rsBookingsWrap').style.display = 'none';
          hideSummary();
        }, 1800);
      } else {
        showConfirmMsg('error', data.message || 'Reschedule failed.');
      }
    } catch (_) {
      showConfirmMsg('error', 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-calendar-alt"></i> Execute Reschedule';
    }
  });

  function showConfirmMsg(type, text) {
    const el = document.getElementById('rsConfirmMsg');
    el.className = 'modal-msg ' + type;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${text}`;
  }

  boot();