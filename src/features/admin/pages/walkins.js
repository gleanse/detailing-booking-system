AdminLayout.init({ activePage: 'walkins', breadcrumb: 'Walk-in Booking' });
  const { formatCurrency, skeletonListItems } = AdminLayout;

  //  State 
  const today = new Date().toISOString().split('T')[0];
  let isTodayFull    = false;
  let selectedFutDate = null;
  let services        = [];

  //  Init 
  document.getElementById('wi_date').value = today;
  document.getElementById('wi_date_display').value = new Date(today + 'T00:00:00')
    .toLocaleDateString('en-PH', {weekday:'long', month:'long', day:'numeric', year:'numeric'});

  async function init() {
    await Promise.all([loadServices(), loadTodayCapacity()]);
  }

  //  Load Services 
  async function loadServices() {
    try {
      const res  = await fetch('/api/admin/services');
      const data = await res.json();
      if (!data.success) return;
      services = data.data || [];
      const sel = document.getElementById('wi_service');
      services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        opt.dataset.variants = JSON.stringify(s.variants || []);
        sel.appendChild(opt);
      });
    } catch (_) {}
  }

  //  Load Today's Capacity 
  async function loadTodayCapacity() {
  const list = document.getElementById('todayCapList');

  const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    list.innerHTML = skeletonListItems(3);
  });

  try {
    const res  = await fetch('/api/admin/availability?date=' + today);
    const data = await res.json();
    const caps = data.data || [];

    cancelSkeleton(); 

    if (!caps.length) {
      list.innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-calendar-times"></i><p>No capacity set for today</p></div>`;
      return;
    }

    const allFull = caps.every(c => (parseInt(c.bookings_count)||0) >= c.capacity);
    isTodayFull   = allFull;

    list.innerHTML = caps.map(c => {
      const booked    = parseInt(c.bookings_count) || 0;
      const remaining = c.capacity - booked;
      const cls       = remaining <= 0 ? 'full' : remaining <= 2 ? 'mid' : 'ok';
      const label     = remaining <= 0 ? 'Full' : `${remaining} / ${c.capacity}`;
      return `<div class="cap-item">
        <span class="cap-name">${c.service_name}</span>
        <span class="cap-badge ${cls}">${label}</span>
      </div>`;
    }).join('');
  } catch (_) {
    cancelSkeleton();
    list.innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-exclamation-triangle"></i><p>Failed to load capacity</p></div>`;
  }
}

  //  Service Change 
  async function onServiceChange() {
    const sel   = document.getElementById('wi_service');
    const varEl = document.getElementById('wi_variant');
    const svcId = sel.value;

    // Populate variants
    let variants = [];
    try { variants = JSON.parse(sel.options[sel.selectedIndex]?.dataset?.variants || '[]'); } catch (_) {}

    varEl.innerHTML = variants.length
      ? '<option value="">-- Select variant --</option>' +
        variants.map(v => `<option value="${v.id}" data-price="${v.price}">${v.name} - ${formatCurrency(v.price)}</option>`).join('')
      : '<option value="">No variants</option>';
    varEl.disabled = !variants.length;

    document.getElementById('wiSummary').classList.remove('show');

    if (!svcId) {
      hideFutureMode();
      return;
    }

    // Check if this service has capacity today
    await checkServiceCapacityToday(svcId);
    updateSummary();
  }

  async function checkServiceCapacityToday(svcId) {
    try {
      const res  = await fetch('/api/admin/availability?date=' + today);
      const data = await res.json();
      const cap  = (data.data || []).find(c => c.service_id === svcId);

      const remaining = cap ? cap.capacity - (parseInt(cap.bookings_count)||0) : 0;

      if (!cap || remaining <= 0) {
        showFutureMode(svcId);
      } else {
        hideFutureMode();
      }
    } catch (_) { hideFutureMode(); }
  }

  function showFutureMode(svcId) {
    document.getElementById('capAlert').classList.add('show');
    document.getElementById('todayDateField').style.display   = 'none';
    document.getElementById('futureDateField').style.display  = 'block';
    document.getElementById('futureCapCard').style.display    = 'block';
    loadFutureDates(svcId);
  }

  function hideFutureMode() {
    document.getElementById('capAlert').classList.remove('show');
    document.getElementById('todayDateField').style.display   = 'block';
    document.getElementById('futureDateField').style.display  = 'none';
    document.getElementById('futureCapCard').style.display    = 'none';
    document.getElementById('wi_future_date').value = '';
    selectedFutDate = null;
    updateSummary();
  }

  async function loadFutureDates(svcId) {
  const list = document.getElementById('futureCapList');

  const cancelSkeleton = AdminLayout.delayedSkeleton(() => {
    list.innerHTML = skeletonListItems(3);
  });

  try {
    const res  = await fetch('/api/admin/availability');
    const data = await res.json();
    const slots = (data.data || [])
      .filter(c => c.service_id === svcId && c.date > today && (c.capacity - (parseInt(c.bookings_count)||0)) > 0)
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    cancelSkeleton(); 

    if (!slots.length) {
      list.innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-calendar-times"></i><p>No upcoming available dates</p></div>`;
      return;
    }

    list.innerHTML = slots.map(c => {
      const rem   = c.capacity - (parseInt(c.bookings_count)||0);
      const label = new Date(c.date + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'short', month:'short', day:'numeric'});
      return `<div class="fut-date-item" id="fdi_${c.date}" onclick="selectFutureDate('${c.date}')">
        <span>${label}</span>
        <span class="cap-badge ok">${rem} slot${rem>1?'s':''} left</span>
      </div>`;
    }).join('');
  } catch (_) {
    cancelSkeleton(); 
    list.innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-exclamation-triangle"></i><p>Failed to load</p></div>`;
  }
}

  function selectFutureDate(dateStr) {
    // Deselect all, select clicked
    document.querySelectorAll('.fut-date-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById('fdi_' + dateStr);
    if (el) el.classList.add('selected');
    selectedFutDate = dateStr;
    document.getElementById('wi_future_date').value = dateStr;
    clearErr('wi_future_date');
    updateSummary();
  }

  function onFutureDateChange() {
    selectedFutDate = document.getElementById('wi_future_date').value;
    // Deselect sidebar items
    document.querySelectorAll('.fut-date-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById('fdi_' + selectedFutDate);
    if (el) el.classList.add('selected');
    clearErr('wi_future_date');
    updateSummary();
  }

  //  Summary 
  function updateSummary() {
    const svcEl  = document.getElementById('wi_service');
    const varEl  = document.getElementById('wi_variant');
    const isFut  = document.getElementById('futureDateField').style.display !== 'none';
    const dateVal = isFut ? (selectedFutDate || '') : today;

    if (svcEl.value && varEl.value && dateVal) {
      const varOpt  = varEl.options[varEl.selectedIndex];
      const dateDisp = new Date(dateVal + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'short', month:'short', day:'numeric', year:'numeric'});
      document.getElementById('sum_date').textContent    = dateDisp;
      document.getElementById('sum_service').textContent = svcEl.options[svcEl.selectedIndex].text;
      document.getElementById('sum_variant').textContent = varOpt.text;
      document.getElementById('sum_amount').textContent  = formatCurrency(varOpt.dataset.price || 0);
      document.getElementById('wiSummary').classList.add('show');
    } else {
      document.getElementById('wiSummary').classList.remove('show');
    }
  }

  //  Validation helpers 
  function setErr(id, msg) {
    const inp = document.getElementById(id);
    const err = document.getElementById(id + 'Err');
    if (inp) inp.classList.toggle('err', !!msg);
    if (err) err.textContent = msg || '';
  }
  function clearErr(id) { setErr(id, ''); }

  //  Form Submit 
  document.getElementById('wiForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const isFut   = document.getElementById('futureDateField').style.display !== 'none';
    const name    = document.getElementById('wi_name').value.trim();
    const phone   = document.getElementById('wi_phone').value.trim();
    const email   = document.getElementById('wi_email').value.trim();
    const svcId   = document.getElementById('wi_service').value;
    const varId   = document.getElementById('wi_variant').value;
    const futDate = document.getElementById('wi_future_date').value;
    const bookDate = isFut ? futDate : today;

    let ok = true;
    if (!name)                           { setErr('wi_name',    'Customer name is required'); ok=false; } else clearErr('wi_name');
    if (!phone || phone.replace(/\D/g,'').length !== 11) { setErr('wi_phone', 'Valid 11-digit phone required'); ok=false; } else clearErr('wi_phone');
    if (!svcId)                          { setErr('wi_service', 'Select a service'); ok=false; } else clearErr('wi_service');
    if (!varId)                          { setErr('wi_variant', 'Select a variant'); ok=false; } else clearErr('wi_variant');
    if (isFut && !futDate)               { setErr('wi_future_date', 'Select a future date'); ok=false; } else clearErr('wi_future_date');
    if (!ok) return;

    const btn = document.getElementById('wiSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    const varOpt = document.getElementById('wi_variant').options[document.getElementById('wi_variant').selectedIndex];

    try {
      const res  = await fetch('/api/admin/bookings/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name:             name,
          guest_email:            email || null,
          guest_phone:            phone,
          service_id:             svcId,
          variant_id:             varId,
          booking_date:           bookDate,
          motorcycle_plate:       document.getElementById('wi_plate').value.trim() || null,
          motorcycle_color:       document.getElementById('wi_color').value.trim() || null,
          motorcycle_model:       document.getElementById('wi_model').value.trim() || null,
          motorcycle_description: document.getElementById('wi_desc').value.trim() || null,
          is_walkin:              true,
          payment_method:         'cash',
          is_future_date:         isFut,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const msgEl = document.getElementById('wiMsg');
        msgEl.className = 'wi-msg success';
        msgEl.innerHTML = `<i class="fas fa-check-circle"></i> Walk-in booked! Queue #${data.queue_number} - Ref: <strong>${data.reference_code}</strong>`;

        showSlip({
          queueNumber:  data.queue_number,
          referenceCode: data.reference_code,
          bookingDate:  bookDate,
          guestName:    name,
          guestPhone:   phone,
          serviceName:  document.getElementById('wi_service').options[document.getElementById('wi_service').selectedIndex].text,
          variantName:  varOpt.text,
          plate:        document.getElementById('wi_plate').value.trim(),
          model:        document.getElementById('wi_model').value.trim(),
          amount:       varOpt.dataset.price || 0,
          isFuture:     isFut,
        });

        // Reset form
        document.getElementById('wiForm').reset();
        document.getElementById('wi_date').value = today;
        document.getElementById('wi_date_display').value = new Date(today + 'T00:00:00')
          .toLocaleDateString('en-PH', {weekday:'long', month:'long', day:'numeric', year:'numeric'});
        document.getElementById('wi_variant').disabled = true;
        document.getElementById('wi_variant').innerHTML = '<option value="">-- Select service first --</option>';
        document.getElementById('wiSummary').classList.remove('show');
        hideFutureMode();
        await loadTodayCapacity();
        selectedFutDate = null;
      } else {
        const msgEl = document.getElementById('wiMsg');
        msgEl.className = 'wi-msg error';
        msgEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message || 'Booking failed. Try again.'}`;
      }
    } catch (_) {
      const msgEl = document.getElementById('wiMsg');
      msgEl.className = 'wi-msg error';
      msgEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Network error. Please try again.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Walk-in Booking';
    }
  });

  //  Slip 
  function showSlip(d) {
    const dateDisp = new Date(d.bookingDate + 'T00:00:00')
      .toLocaleDateString('en-PH', {weekday:'long', month:'long', day:'numeric', year:'numeric'});
    document.getElementById('slipQueueNum').textContent  = d.queueNumber || '-';
    document.getElementById('slipQueueDate').textContent = dateDisp;
    document.getElementById('slipRef').textContent       = d.referenceCode || '-';
    document.getElementById('slipName').textContent      = d.guestName || '-';
    document.getElementById('slipPhone').textContent     = d.guestPhone || '-';
    document.getElementById('slipService').textContent   = `${d.serviceName} - ${d.variantName}`;
    document.getElementById('slipPlate').textContent     = d.plate || '-';
    document.getElementById('slipModel').textContent     = d.model || '-';
    document.getElementById('slipAmount').textContent    = formatCurrency(d.amount);
    document.getElementById('slipTypeBadge').textContent = d.isFuture ? 'Pre-booked' : 'Walk-in';
    document.getElementById('slipPlateRow').style.display = d.plate ? '' : 'none';
    document.getElementById('slipModelRow').style.display = d.model ? '' : 'none';
    document.getElementById('slipOverlay').classList.remove('hidden');
  }

  function closeSlip() {
    document.getElementById('slipOverlay').classList.add('hidden');
  }

  init();