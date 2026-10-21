AdminLayout.init({ activePage: 'availability', breadcrumb: 'Availability' });

  const { formatDate, skeletonTableRows } = AdminLayout;
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function openOverlay(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }

  function showMsg(msgId, type, text) {
    const el = document.getElementById(msgId);
    el.className = 'modal-msg ' + type;
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${text}`;
  }
  function hideMsg(msgId) { document.getElementById(msgId).className = 'modal-msg'; }

  function showCapacityWarn(text) {
    document.getElementById('capacityWarnText').textContent = text;
    document.getElementById('capacityWarnBanner').classList.add('visible');
    document.getElementById('capacityModalProceed').classList.remove('hidden');
    document.getElementById('capacityModalSave').classList.add('hidden');
  }
  function hideCapacityWarn() {
    document.getElementById('capacityWarnBanner').classList.remove('visible');
    document.getElementById('capacityModalProceed').classList.add('hidden');
    document.getElementById('capacityModalSave').classList.remove('hidden');
  }


  const WARN_TITLES = {
    NO_STAFF:             'No Staff Accounts',
    LOW_STAFF:            'Limited Staff',
    EXCEEDS_HOURS:        'Exceeds Working Hours',
    TODAY_DATE:           'Modifying Today\'s Capacity',
    VARIANT_DURATION_EXCEEDS: 'Variant Duration Warning',
  };

  async function loadAvailability() {
  const capBody   = document.getElementById('capacityTableBody');
  const closeBody = document.getElementById('closedDatesBody');

  const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    capBody.innerHTML   = skeletonTableRows(6, 4);
    closeBody.innerHTML = skeletonTableRows(4, 3);
  });

  try {
    const [capRes, closeRes] = await Promise.all([
      fetch('/api/admin/availability'),
      fetch('/api/admin/closed-dates'),
    ]);
    cancelSkeleton();
    if (capRes.ok)   renderCapacity((await capRes.json()).data || []);
    if (closeRes.ok) renderClosedDates((await closeRes.json()).data || []);
  } catch (err) {
    cancelSkeleton();
    console.error('Load availability error:', err);
  }
}


  async function renderCapacity(rows) {
    const tbody = document.getElementById('capacityTableBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-calendar-times"></i><p>No capacity set yet. Click "Set Capacity" to add.</p></div></td></tr>`;
      return;
    }

    let staffCount = 0;
    try {
      const sr = await fetch('/api/admin/accounts'); 
      const sd = await sr.json();
      staffCount = sd.success ? sd.data.length : 0;
    } catch (_) {}

    tbody.innerHTML = rows.map(r => {
      const booked    = parseInt(r.bookings_count) || 0;
      const cap       = parseInt(r.capacity);
      const rowDate   = new Date(r.date + 'T00:00:00');
      const today     = new Date(); today.setHours(0,0,0,0);
      const isPast    = rowDate < today;
      const isToday   = rowDate.getTime() === today.getTime();

      let chips = '';
      if (isPast) {
        chips += `<span class="warn-chip" title="Past date"><i class="fas fa-history"></i> Past</span> `;
      }
      if (isToday) {
        chips += `<span class="warn-chip" title="Active today"><i class="fas fa-clock"></i> Today</span> `;
      }
      if (staffCount === 0) {
        chips += `<span class="warn-chip" title="No staff accounts"><i class="fas fa-user-slash"></i> No Staff</span> `;
      } else if (staffCount === 1 && cap > 3) {
        chips += `<span class="warn-chip" title="High capacity for 1 staff"><i class="fas fa-user-friends"></i> 1 Staff</span> `;
      }
      if (booked > cap) {
        chips += `<span class="warn-chip" style="background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.2);" title="Overbooked!"><i class="fas fa-exclamation-circle"></i> Overbooked</span> `;
      }

      return `
      <tr>
        <td>
          ${formatDate(r.date)}
          ${chips ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${chips}</div>` : ''}
        </td>
        <td>${r.service_name || '-'}</td>
        <td><strong>${r.capacity}</strong></td>
        <td>${booked}</td>
        <td>${r.is_open
          ? '<span class="status-badge status-confirmed">Open</span>'
          : '<span class="status-badge status-expired">Closed</span>'}</td>
        <td>
          ${!isPast ? `
          <button class="action-btn" onclick="openEditCapacity(${JSON.stringify(r).split('"').join('&quot;')})">
            <i class="fas fa-edit"></i> Edit
          </button>` : ''}
          <button class="action-btn danger" onclick="openDeleteCapacity('${r.id}', '${r.service_name}', '${r.date}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }
  function renderClosedDates(rows) {
    const tbody = document.getElementById('closedDatesBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-calendar-check"></i><p>No closures set yet.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.type === 'recurring'
          ? '<span class="status-badge status-staff">Recurring</span>'
          : '<span class="status-badge status-pending">One-time</span>'}</td>
        <td>${r.type === 'recurring' ? DAYS[r.day_of_week] : formatDate(r.date)}</td>
        <td>${r.reason || '-'}</td>
        <td>
          <button class="action-btn danger" onclick="openDeleteClosure('${r.id}', ${r.type === 'recurring' ? `'${DAYS[r.day_of_week]}'` : `'${formatDate(r.date)}'`})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`).join('');
  }

  let editingCapacityId   = null;
  let pendingWarnCallback = null; 

  async function loadServicesDropdown() {
    const select = document.getElementById('cap_service');
    try {
      const res  = await fetch('/api/admin/services');
      const data = await res.json();
      select.innerHTML = '<option value="">-- Select service --</option>';
      if (data.success && data.data.length) {
        data.data.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Load services dropdown error:', err);
    }
  }

  document.getElementById('addCapacityBtn').addEventListener('click', async () => {
    editingCapacityId = null;
    document.getElementById('capacityModalTitle').innerHTML = '<i class="fas fa-calendar-alt"></i> Set Capacity';
    document.getElementById('capacityModalSaveLabel').textContent = 'Save Capacity';
    document.getElementById('cap_date').value     = '';
    document.getElementById('cap_capacity').value = '';
    document.getElementById('cap_is_open').value  = 'true';
    document.getElementById('capacityServiceField').style.display = 'block';
    hideMsg('capacityModalMsg');
    hideCapacityWarn();
    await loadServicesDropdown();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cap_date').min = today; 
    openOverlay('capacityModal');
    document.getElementById('cap_service').focus();
  });

  function openEditCapacity(row) {
    editingCapacityId = row.id;
    document.getElementById('capacityModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Capacity';
    document.getElementById('capacityModalSaveLabel').textContent = 'Update Capacity';
    document.getElementById('capacityServiceField').style.display = 'none';
    const dateStr = row.date ? row.date.split('T')[0] : '';
    document.getElementById('cap_date').value     = dateStr;
    document.getElementById('cap_capacity').value = row.capacity;
    document.getElementById('cap_is_open').value  = row.is_open ? 'true' : 'false';
    hideMsg('capacityModalMsg');
    hideCapacityWarn();
    openOverlay('capacityModal');
    document.getElementById('cap_capacity').focus();
  }

  ['capacityModalClose','capacityModalCancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      closeOverlay('capacityModal');
      hideCapacityWarn();
    });
  });
  document.getElementById('capacityModal').addEventListener('click', e => {
    if (e.target.id === 'capacityModal') { closeOverlay('capacityModal'); hideCapacityWarn(); }
  });

  document.getElementById('capacityModalProceed').addEventListener('click', () => {
    if (pendingWarnCallback) pendingWarnCallback(true);
  });

  document.getElementById('capacityModalSave').addEventListener('click', () => saveCapacity(false));

  async function saveCapacity(force) {
    const service  = document.getElementById('cap_service').value;
    const date     = document.getElementById('cap_date').value;
    const capacity = document.getElementById('cap_capacity').value;
    const is_open  = document.getElementById('cap_is_open').value;

    if (!date)                              { showMsg('capacityModalMsg', 'error', 'Please select a date.');        return; }
    if (!capacity || parseInt(capacity) < 1){ showMsg('capacityModalMsg', 'error', 'Capacity must be at least 1.'); return; }
    if (!editingCapacityId && !service)    { showMsg('capacityModalMsg', 'error', 'Please select a service.');      return; }

    const btn = document.getElementById(force ? 'capacityModalProceed' : 'capacityModalSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      let res, data;
      if (editingCapacityId) {
        res  = await fetch(`/api/admin/availability/${editingCapacityId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capacity: parseInt(capacity), is_open: is_open === 'true', date, force }),
        });
      } else {
        res  = await fetch('/api/admin/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_id: service, date, capacity: parseInt(capacity), is_open: is_open === 'true', force }),
        });
      }
      data = await res.json();
      if (!data.success && !data.warning) {
        hideCapacityWarn();
        showMsg('capacityModalMsg', 'error', data.message || 'Failed to save.');
        return;
      }

      if (!data.success && data.warning) {
        hideMsg('capacityModalMsg');
        showCapacityWarn(data.message);
        pendingWarnCallback = (f) => saveCapacity(f); 
        return;
      }

      if (data.success) {
        showMsg('capacityModalMsg', 'success', data.message || 'Saved successfully!');
        hideCapacityWarn();
        pendingWarnCallback = null;
        setTimeout(() => { closeOverlay('capacityModal'); loadAvailability(); }, 800);
      }
    } catch (err) {
      showMsg('capacityModalMsg', 'error', 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      const label = editingCapacityId ? 'Update Capacity' : 'Save Capacity';
      if (force) {
        btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Proceed Anyway`;
      } else {
        btn.innerHTML = `<i class="fas fa-save"></i> <span id="capacityModalSaveLabel">${label}</span>`;
      }
    }
  }

  function setClosureType(type) {
    document.getElementById('closure_type').value = type;
    document.getElementById('typeRecurring').classList.toggle('active', type === 'recurring');
    document.getElementById('typeSpecific').classList.toggle('active', type === 'specific');
    document.getElementById('field_dow').classList.toggle('visible', type === 'recurring');
    document.getElementById('field_date').classList.toggle('visible', type === 'specific');
  }

  document.getElementById('addClosedBtn').addEventListener('click', () => {
    setClosureType('recurring');
    document.getElementById('closure_dow').value    = '0';
    document.getElementById('closure_date').value   = '';
    document.getElementById('closure_reason').value = '';
    hideMsg('closureModalMsg');
    document.getElementById('closure_date').min = new Date().toISOString().split('T')[0];
    openOverlay('closureModal');
  });

  ['closureModalClose','closureModalCancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => closeOverlay('closureModal'));
  });
  document.getElementById('closureModal').addEventListener('click', e => {
    if (e.target.id === 'closureModal') closeOverlay('closureModal');
  });

  document.getElementById('closureModalSave').addEventListener('click', async () => {
    const type   = document.getElementById('closure_type').value;
    const dow    = document.getElementById('closure_dow').value;
    const date   = document.getElementById('closure_date').value;
    const reason = document.getElementById('closure_reason').value.trim();

    if (type === 'specific' && !date) {
      showMsg('closureModalMsg', 'error', 'Please select a specific date.');
      return;
    }

    const btn = document.getElementById('closureModalSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    const payload = { type, reason: reason || null };
    if (type === 'recurring') payload.day_of_week = parseInt(dow);
    else                      payload.date = date;

    try {
      const res  = await fetch('/api/admin/closed-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showMsg('closureModalMsg', 'success', 'Closure added successfully!');
        setTimeout(() => { closeOverlay('closureModal'); loadAvailability(); }, 800);
      } else {
        showMsg('closureModalMsg', 'error', data.message || 'Failed to add closure.');
      }
    } catch (err) {
      showMsg('closureModalMsg', 'error', 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i> Add Closure';
    }
  });

  let warnResolve = null;

  function showWarnModal(title, message) {
    return new Promise((resolve) => {
      document.getElementById('warnModalTitle').textContent = title;
      document.getElementById('warnModalMsg').textContent   = message;
      warnResolve = resolve;
      openOverlay('warnModal');
    });
  }

  document.getElementById('warnModalCancel').addEventListener('click', () => {
    closeOverlay('warnModal');
    if (warnResolve) warnResolve(false);
  });
  document.getElementById('warnModalConfirm').addEventListener('click', () => {
    closeOverlay('warnModal');
    if (warnResolve) warnResolve(true);
  });
  document.getElementById('warnModal').addEventListener('click', e => {
    if (e.target.id === 'warnModal') {
      closeOverlay('warnModal');
      if (warnResolve) warnResolve(false);
    }
  });

  let deleteTarget = null;

  function openDeleteCapacity(id, serviceName, date) {
    deleteTarget = { type: 'capacity', id };
    document.getElementById('deleteModalMsg').textContent =
      `Remove capacity entry for "${serviceName}" on ${formatDate(date)}? This cannot be undone.`;
    openOverlay('deleteModal');
  }

  function openDeleteClosure(id, label) {
    deleteTarget = { type: 'closure', id };
    document.getElementById('deleteModalMsg').textContent =
      `Remove the closure for "${label}"? This cannot be undone.`;
    openOverlay('deleteModal');
  }

  document.getElementById('deleteModalCancel').addEventListener('click', () => closeOverlay('deleteModal'));
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target.id === 'deleteModal') closeOverlay('deleteModal');
  });

  document.getElementById('deleteModalConfirm').addEventListener('click', async () => {
    if (!deleteTarget) return;

    const btn = document.getElementById('deleteModalConfirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
      const url = deleteTarget.type === 'capacity'
        ? `/api/admin/availability/${deleteTarget.id}`
        : `/api/admin/closed-dates/${deleteTarget.id}`;

      const res  = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        closeOverlay('deleteModal');
        loadAvailability();
      } else {
        alert('Failed to delete: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error. Try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      deleteTarget = null;
    }
  });
  loadAvailability();
