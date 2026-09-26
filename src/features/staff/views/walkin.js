let services = [];
let lastCreatedId = null;
let todayIsFull = false;

const today = () => new Date().toISOString().split('T')[0];

const setLoading = (loading) => {
  const btn = document.getElementById('btn-submit');
  const icon = document.getElementById('submit-icon');
  const text = document.getElementById('submit-text');
  btn.disabled = loading;
  icon.className = loading
    ? 'ph ph-circle-notch animate-spin text-base'
    : 'ph ph-plus-circle text-base';
  text.textContent = loading ? 'Creating…' : 'Create Walk-in Booking';
};

const showError = (msg) => {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
};

const hideError = () =>
  document.getElementById('form-error').classList.add('hidden');

const fieldError = (id, msg) => {
  const el = document.getElementById(id);
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else el.classList.add('hidden');
};

const showCapacityBadge = (msg, type = 'info') => {
  const badge = document.getElementById('capacity-badge');
  const text = document.getElementById('capacity-text');
  const icon = document.getElementById('capacity-icon');
  text.textContent = msg;
  badge.classList.remove('hidden');
  badge.classList.add('flex');

  badge.className = badge.className
    .replace(/bg-\S+/g, '')
    .replace(/border-\S+/g, '')
    .trim();

  if (type === 'full') {
    badge.classList.add('bg-red-500/10', 'border', 'border-red-500/20');
    icon.className = 'ph ph-warning text-red-400 text-sm';
    text.className = 'text-red-400 text-xs';
  } else if (type === 'warn') {
    badge.classList.add('bg-yellow-500/10', 'border', 'border-yellow-500/20');
    icon.className = 'ph ph-warning text-yellow-400 text-sm';
    text.className = 'text-yellow-300 text-xs';
  } else if (type === 'ok') {
    badge.classList.add('bg-green-500/10', 'border', 'border-green-500/20');
    icon.className = 'ph ph-check-circle text-green-400 text-sm';
    text.className = 'text-green-400 text-xs';
  } else {
    badge.classList.add('bg-white/3');
    icon.className = 'ph ph-info text-white/40 text-sm';
    text.className = 'text-white/50 text-xs';
  }
};

const hideCapacityBadge = () => {
  document.getElementById('capacity-badge').classList.add('hidden');
  document.getElementById('capacity-badge').classList.remove('flex');
};

const showFutureDatePicker = () => {
  const section = document.getElementById('future-date-section');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const hideFutureDatePicker = () => {
  document.getElementById('future-date-section').classList.add('hidden');
  document.getElementById('future-date-input').value = '';
  document.getElementById('future-capacity-text').textContent = '';
  document.getElementById('future-capacity-badge').classList.add('hidden');
  document.getElementById('future-capacity-badge').classList.remove('flex');
};

const checkAvailability = async (serviceId, date) => {
  if (!serviceId || !date) return null;
  try {
    const res = await fetch(
      `/staff/services/${serviceId}/availability?date=${date}`,
    );
    const data = await res.json();
    return data.success ? data : null;
  } catch (_) {
    return null;
  }
};

const loadServices = async () => {
  try {
    const res = await fetch('/staff/services');
    const data = await res.json();
    if (!data.success) return;
    services = data.services;

    const select = document.getElementById('service-select');
    select.innerHTML =
      '<option value="">Select a service</option>' +
      services
        .map((s) => `<option value="${s.id}">${s.name}</option>`)
        .join('');
  } catch (err) {
    console.error('Load services error:', err);
  }
};

const loadVariants = (serviceId) => {
  const svc = services.find((s) => s.id === serviceId);
  const select = document.getElementById('variant-select');

  if (!svc || !svc.variants || svc.variants.length === 0) {
    select.innerHTML = '<option value="">No variants available</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML =
    '<option value="">Select size / variant</option>' +
    svc.variants
      .map(
        (v) => `<option value="${v.id}">
      ${v.name} - PHP ${parseFloat(v.price).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}
      ${v.duration_hours ? ' (' + v.duration_hours + 'h est.)' : ''}
    </option>`,
      )
      .join('');
  select.disabled = false;
};

const checkTodayCapacity = async () => {
  const serviceId = document.getElementById('service-select').value;
  if (!serviceId) {
    hideCapacityBadge();
    return;
  }

  const avail = await checkAvailability(serviceId, today());
  if (!avail) {
    hideCapacityBadge();
    return;
  }

  if (avail.noSlot) {
    showCapacityBadge('No availability set for today.', 'info');
    todayIsFull = false;
    return;
  }

  if (avail.full) {
    todayIsFull = true;
    showCapacityBadge(
      `Today is fully booked (${avail.confirmed}/${avail.capacity}). You can still book a future date below.`,
      'full',
    );
    showFutureDatePicker();
  } else {
    todayIsFull = false;
    showCapacityBadge(
      `Today: ${avail.remaining} slot${
        avail.remaining !== 1 ? 's' : ''
      } remaining (${avail.confirmed}/${avail.capacity})`,
      'ok',
    );
    hideFutureDatePicker();
  }
};

const checkFutureDateCapacity = async () => {
  const serviceId = document.getElementById('service-select').value;
  const date = document.getElementById('future-date-input').value;
  const badge = document.getElementById('future-capacity-badge');
  const text = document.getElementById('future-capacity-text');

  if (!serviceId || !date) {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
    return;
  }

  const avail = await checkAvailability(serviceId, date);
  badge.classList.remove('hidden');
  badge.classList.add('flex');

  if (!avail || avail.noSlot) {
    badge.className =
      'flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs';
    text.className = 'text-red-400 text-xs';
    text.textContent =
      'No availability set for this date. Choose a different date.';
    return;
  }

  if (avail.full) {
    badge.className =
      'flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5 text-xs';
    text.className = 'text-yellow-300 text-xs';
    text.textContent = `This date is also fully booked (${avail.confirmed}/${avail.capacity}). Staff booking will still proceed if you confirm.`;
  } else {
    badge.className =
      'flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 text-xs';
    text.className = 'text-green-400 text-xs';
    text.textContent = `${avail.remaining} slot${
      avail.remaining !== 1 ? 's' : ''
    } available on this date (${avail.confirmed}/${avail.capacity}).`;
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadServices();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  document.getElementById('future-date-input').min = tomorrowStr;

  document
    .getElementById('service-select')
    .addEventListener('change', async (e) => {
      loadVariants(e.target.value);
      hideFutureDatePicker();
      await checkTodayCapacity();
    });

  document
    .getElementById('future-date-input')
    .addEventListener('change', checkFutureDateCapacity);

  document.getElementById('btn-submit').addEventListener('click', async () => {
    hideError();
    fieldError('err-name', null);
    fieldError('err-plate', null);

    const serviceId = document.getElementById('service-select').value;
    const variantId = document.getElementById('variant-select').value;
    const guestName = document.getElementById('guest-name').value.trim();
    const guestEmail = document.getElementById('guest-email').value.trim();
    const guestPhone = document.getElementById('guest-phone').value.trim();
    const motorcyclePlate = document.getElementById('moto-plate').value.trim();
    const motorcycleModel = document.getElementById('moto-model').value.trim();
    const motorcycleColor = document.getElementById('moto-color').value.trim();
    const motorcycleDescription = document
      .getElementById('moto-desc')
      .value.trim();

    const futureSection = document.getElementById('future-date-section');
    const isFutureVisible = !futureSection.classList.contains('hidden');
    const futureDate = document.getElementById('future-date-input').value;

    // determine which date to use
    const date = isFutureVisible && futureDate ? futureDate : today();

    let valid = true;

    if (!guestName) {
      fieldError('err-name', 'Customer name is required');
      valid = false;
    }
    if (!motorcyclePlate) {
      fieldError('err-plate', 'Plate number is required');
      valid = false;
    }
    if (!serviceId) {
      showError('Please select a service');
      valid = false;
    }
    if (!variantId) {
      showError('Please select a variant');
      valid = false;
    }
    if (isFutureVisible && !futureDate) {
      showError('Please select a future date since today is full');
      valid = false;
    }

    if (!valid) return;

    // if future date is selected but still full, confirm with staff
    if (isFutureVisible && futureDate) {
      const futureText = document.getElementById(
        'future-capacity-text',
      ).textContent;
      if (futureText.includes('fully booked')) {
        const proceed = confirm(
          `${futureDate} is also at full capacity. Proceed anyway?`,
        );
        if (!proceed) return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/staff/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          variantId,
          date,
          guestName,
          guestEmail,
          guestPhone,
          motorcyclePlate,
          motorcycleModel,
          motorcycleColor,
          motorcycleDescription,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.full) {
          todayIsFull = true;
          showCapacityBadge(
            `Today is fully booked. Please select a future date below.`,
            'full',
          );
          showFutureDatePicker();
          showError(
            'This date is at full capacity. Select a future date below.',
          );
        } else {
          showError(data.message);
        }
        setLoading(false);
        return;
      }

      lastCreatedId = data.booking.id;

      const svc = services.find((s) => s.id === serviceId);
      const variant = svc?.variants?.find((v) => v.id === variantId);
      const bookedDate = new Date(date + 'T00:00:00').toLocaleDateString(
        'en-PH',
        {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        },
      );

      document.getElementById('s-ref').textContent = data.booking.referenceCode;
      document.getElementById('s-queue').textContent =
        '#' + data.booking.queueNumber;
      document.getElementById('s-service').textContent = `${svc?.name} - ${
        variant?.name || ''
      }`;
      document.getElementById('s-name').textContent = guestName;
      document.getElementById('s-plate').textContent =
        motorcyclePlate.toUpperCase();
      document.getElementById('s-date').textContent = bookedDate;
      document.getElementById('btn-download-slip').href =
        `/staff/slip/${lastCreatedId}`;

      document
        .getElementById('modal-success')
        .classList.replace('hidden', 'flex');
    } catch (err) {
      showError('Server error: ' + err.message);
    }
    setLoading(false);
  });

  document.getElementById('btn-new-walkin').addEventListener('click', () => {
    document
      .getElementById('modal-success')
      .classList.replace('flex', 'hidden');
    document.getElementById('guest-name').value = '';
    document.getElementById('guest-email').value = '';
    document.getElementById('guest-phone').value = '';
    document.getElementById('moto-plate').value = '';
    document.getElementById('moto-model').value = '';
    document.getElementById('moto-color').value = '';
    document.getElementById('moto-desc').value = '';
    hideError();
    hideFutureDatePicker();
    hideCapacityBadge();
    todayIsFull = false;
    // re-check capacity for the selected service
    if (document.getElementById('service-select').value) {
      checkTodayCapacity();
    }
  });
});
