// BOOKING JAVASCRIPT FOR THE HTML PAGE
const serviceId = window.location.pathname.split('/').pop();

let state = {
  service: null,
  selectedVariant: null,
  selectedDate: null,
  availabilityId: null,
  bookingId: null,
  expiresAt: null,
  timerInterval: null,
  timerSeconds: 10 * 60,
  currentStep: 1,
};

const SESSION_KEY = 'hrc_booking_state';
const FORM_KEY = 'hrc_booking_form';

// Session storage
function saveSession() {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      bookingId: state.bookingId,
      expiresAt: state.expiresAt,
      currentStep: state.currentStep,
      selectedVariant: state.selectedVariant,
      selectedDate: state.selectedDate,
      availabilityId: state.availabilityId,
      serviceId,
    }),
  );
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(FORM_KEY);
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.serviceId !== serviceId) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

// Utils
function showStep(step) {
  document
    .querySelectorAll('.step-content')
    .forEach((el) => el.classList.add('hidden'));
  document.getElementById(`step-${step}`).classList.remove('hidden');
  state.currentStep = step;
  updateStepIndicator(step);
  saveSession();
}

function updateStepIndicator(activeStep) {
  document.querySelectorAll('.step-indicator').forEach((el) => {
    const s = parseInt(el.dataset.step);
    const dot = el.querySelector('.step-dot');
    const label = el.querySelector('.step-label');
    if (s < activeStep) {
      dot.className =
        'step-dot w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-red-500 bg-red-500 flex items-center justify-center text-xs font-bold transition-all duration-300';
      dot.innerHTML = '<i class="ph ph-check text-white text-sm"></i>';
      label.className =
        'step-label text-xs sm:text-sm text-white/60 transition-colors duration-300';
    } else if (s === activeStep) {
      dot.className =
        'step-dot w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-red-500 bg-red-500 flex items-center justify-center text-xs font-bold transition-all duration-300';
      dot.innerHTML = s;
      label.className =
        'step-label text-xs sm:text-sm text-white font-medium transition-colors duration-300';
    } else {
      dot.className =
        'step-dot w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-xs font-bold text-white/40 transition-all duration-300';
      dot.innerHTML = s;
      label.className =
        'step-label text-xs sm:text-sm text-white/40 transition-colors duration-300';
    }
  });

  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById(`line-${i}`);
    line.className = `step-line flex-1 h-px mx-1 sm:mx-3 transition-colors duration-300 ${
      i < activeStep ? 'bg-red-500/50' : 'bg-white/10'
    }`;
  }
}

function showModal(
  title,
  message,
  onConfirm,
  confirmLabel = 'Yes, go back',
  isNotice = false,
) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').innerHTML = message;
  // drop listeners left by a popup that was opened before this one
  ['modal-confirm-btn', 'modal-cancel'].forEach((id) => {
    const old = document.getElementById(id);
    old.replaceWith(old.cloneNode(true));
  });

  // notice = one full width button and no cancel
  const cancelEl = document.getElementById('modal-cancel');
  const confirmEl = document.getElementById('modal-confirm-btn');
  cancelEl.classList.toggle('hidden', isNotice);
  confirmEl.classList.toggle('w-full', isNotice);
  confirmEl.classList.toggle('w-1/2', !isNotice);
  confirmEl.textContent = confirmLabel;
  const modal = document.getElementById('modal-confirm');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const confirmBtn = document.getElementById('modal-confirm-btn');
  const cancelBtn = document.getElementById('modal-cancel');

  const cleanup = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    cleanup();
    onConfirm();
  });
  document.getElementById('modal-cancel').addEventListener('click', cleanup);
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
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

// Field validation helpers
function setFieldError(inputEl, message) {
  const errorEl = inputEl.parentElement.querySelector('.field-error');
  inputEl.classList.add('border-red-500/60');
  inputEl.classList.remove('border-white/10', 'border-green-500/40');
  if (errorEl) {
    errorEl.querySelector('span').textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('flex');
  }
}

function setFieldSuccess(inputEl) {
  const errorEl = inputEl.parentElement.querySelector('.field-error');
  inputEl.classList.remove('border-red-500/60', 'border-white/10');
  inputEl.classList.add('border-green-500/40');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.classList.remove('flex');
  }
}

function clearField(inputEl) {
  const errorEl = inputEl.parentElement.querySelector('.field-error');
  inputEl.classList.remove('border-red-500/60', 'border-green-500/40');
  inputEl.classList.add('border-white/10');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.classList.remove('flex');
  }
}

function clearAllFields() {
  [
    'input-name',
    'input-email',
    'input-phone',
    'input-plate',
    'input-model',
    'input-color',
  ].forEach((id) => {
    clearField(document.getElementById(id));
  });
}

const validators = {
  name: (v) => {
    if (!v) return 'Full name is required.';
    if (v.length < 2) return 'Name must be at least 2 characters.';
    return null;
  },
  email: (v) => {
    if (!v) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return 'Enter a valid email address.';
    return null;
  },
  phone: (v) => {
    if (!v) return 'Phone number is required.';
    if (!/^09\d{9}$/.test(v)) return 'Enter a valid PH number (09XXXXXXXXX).';
    return null;
  },
  plate: (v) => {
    if (!v) return 'Plate number is required.';
    return null;
  },
  model: (v) => {
    if (!v) return 'Motorcycle model is required.';
    return null;
  },
  color: (v) => {
    if (!v) return 'Motorcycle color is required.';
    return null;
  },
};

function validateField(id, rule) {
  const el = document.getElementById(id);
  const val = el.value.trim();
  const error = validators[rule](val);
  if (error) {
    setFieldError(el, error);
    return false;
  }
  setFieldSuccess(el);
  return true;
}

function validateStep3() {
  const results = [
    validateField('input-name', 'name'),
    validateField('input-email', 'email'),
    validateField('input-phone', 'phone'),
    validateField('input-plate', 'plate'),
    validateField('input-model', 'model'),
    validateField('input-color', 'color'),
  ];
  return results.every(Boolean);
}

[
  'input-name',
  'input-email',
  'input-phone',
  'input-plate',
  'input-model',
  'input-color',
].forEach((id) => {
  const el = document.getElementById(id);
  const ruleMap = {
    'input-name': 'name',
    'input-email': 'email',
    'input-phone': 'phone',
    'input-plate': 'plate',
    'input-model': 'model',
    'input-color': 'color',
  };
  el.addEventListener('input', () => {
    if (id === 'input-phone') {
      el.value = el.value.replace(/[^0-9]/g, '');
    }
    const val = el.value.trim();
    if (!val) {
      clearField(el);
    } else {
      const error = validators[ruleMap[id]](val);
      if (error) {
        setFieldError(el, error);
      } else {
        setFieldSuccess(el);
      }
    }
  });
});

// form persistence
const FORM_FIELDS = [
  'input-name',
  'input-email',
  'input-phone',
  'input-plate',
  'input-model',
  'input-color',
  'input-description',
];

function saveForm() {
  const data = {};
  FORM_FIELDS.forEach((id) => {
    data[id] = document.getElementById(id).value;
  });
  data.paymentType = document.querySelector(
    'input[name="payment_type"]:checked',
  ).value;
  sessionStorage.setItem(FORM_KEY, JSON.stringify(data));
}

function restoreForm() {
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    FORM_FIELDS.forEach((id) => {
      if (id in data) document.getElementById(id).value = data[id];
    });
    document
      .querySelector(`input[name="payment_type"][value="${data.paymentType}"]`)
      ?.closest('.payment-option')
      ?.click();
  } catch {
    sessionStorage.removeItem(FORM_KEY);
  }
}

FORM_FIELDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', saveForm);
});

document.querySelectorAll('.payment-option').forEach((opt) => {
  opt.addEventListener('click', () => setTimeout(saveForm, 0));
});

// back button handling
// 1 extra history entry (the catcher) sits on top while step is 2 or higher
// a back press eats it and fires popstate, we use that to change step
// we never push a new catcher on a back press, chrome android skips entries pushed without a tap
// the eaten catcher is still one step ahead in history, so we walk forward onto it again
let selfMove = false;

function moveSelf(move) {
  // our own history moves fire popstate too, this flag makes the handler skip that one
  selfMove = true;
  move();
  // popstate clears the flag, the timer only covers the case where no popstate came
  setTimeout(() => {
    selfMove = false;
    // forward found nothing so put a catcher back, better than having none
    if (state.currentStep > 1) ensureCatcher();
  }, 500);
}

function ensureCatcher() {
  // only push if we're not already on one
  if (!history.state || !history.state.catcher) {
    history.pushState({ catcher: true }, '');
  }
}

window.addEventListener('popstate', (e) => {
  // our own history move, skip it
  if (selfMove) {
    selfMove = false;
    return;
  }

  // landed on a catcher so the forward button was used, undo it
  if (e.state && e.state.catcher) {
    moveSelf(() => history.back());
    return;
  }

  // modal is open, walk forward onto the catcher and ignore the press
  const modal = document.getElementById('modal-confirm');
  if (!modal.classList.contains('hidden')) {
    moveSelf(() => history.forward());
    return;
  }

  // from here a back press ate the catcher
  const step = state.currentStep;

  if (step === 1) {
    // leftover catcher after a refresh on step 1, just leave the page
    history.back();
    return;
  }

  if (step === 2) {
    // step 1 has no catcher
    showStep(1);
    return;
  }

  // step 3 and 4 stay guarded so walk forward onto the catcher again
  moveSelf(() => history.forward());

  if (step === 4) {
    showStep(3);
    return;
  }

  // step 3 reuses the release dialog from the in-page back button
  if (state.bookingId) {
    document.getElementById('btn-step3-back').click();
  } else {
    showStep(2);
  }
});

// timer
function startTimerFromSeconds(seconds) {
  stopTimer();
  state.timerSeconds = seconds;
  const endTime = Date.now() + seconds * 1000;
  state.timerInterval = setInterval(() => {
    const remaining = Math.floor((endTime - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      document.getElementById('timer-display').textContent = '00:00';
      document.getElementById('timer-display-2').textContent = '00:00';
      handleTimerExpired();
      return;
    }
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    const display = `${m}:${s}`;
    document.getElementById('timer-display').textContent = display;
    document.getElementById('timer-display-2').textContent = display;
    state.timerSeconds = remaining;
  }, 1000);
}

function startTimer() {
  startTimerFromSeconds(10 * 60);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function handleTimerExpired() {
  showModal(
    'Time Expired',
    'Your slot reservation has expired. Select a new date to continue.',
    async () => {
      clearSession();
      await fetch('/api/booking/release', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: state.bookingId }),
      });
      state.bookingId = null;
      state.expiresAt = null;
      showStep(2);
      loadDates();
    },
    'Select new date',
    true,
  );
}

// verify slot is still locked when the page becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (
    document.visibilityState === 'visible' &&
    state.bookingId &&
    state.currentStep >= 3
  ) {
    try {
      const res = await fetch(`/api/booking/session/${state.bookingId}`);
      if (!res.ok) return; // don't do anything on network errors
      const json = await res.json();
      if (!json.success) return; // don't do anything if request failed
      if (json.data.booking_status === 'expired') {
        stopTimer();
        clearSession();
        state.bookingId = null;
        state.expiresAt = null;
        showModal(
          'Slot No Longer Available',
          'Your reserved slot was released. Please select a new date.',
          () => {
            showStep(2);
            loadDates();
          },
          'Okay',
          true,
        );
      }
    } catch {
      // fail silently, cron will clean up anyway
    }
  }
});

// error page, retry helper and session restore
// full page error state, hides everything the page drew so far
function showPageError({
  icon,
  label,
  title,
  message,
  buttonLabel,
  onButton,
  showLink,
}) {
  document
    .querySelectorAll('main > *')
    .forEach((el) => el.classList.add('hidden'));

  document.getElementById('page-error-icon').className =
    `ph ${icon} text-red-400 text-5xl`;
  document.getElementById('page-error-label').textContent = label;
  document.getElementById('page-error-title').textContent = title;
  document.getElementById('page-error-message').innerHTML = message;

  const button = document.getElementById('page-error-button');
  button.textContent = buttonLabel;
  button.onclick = onButton;
  document
    .getElementById('page-error-link')
    .classList.toggle('hidden', !showLink);

  document.getElementById('page-error').classList.remove('hidden');
}

// get json from the server, retry a few times when it cannot answer
async function fetchJsonWithRetry(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      // a 5xx means the server could not answer, treat it like a failed request
      if (res.status < 500) return { res, json: await res.json() };
    } catch {
      // network error or a reply that is not json, try again
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function tryRestoreSession() {
  const saved = loadSession();
  if (!saved || !saved.bookingId) return false;

  const answer = await fetchJsonWithRetry(
    `/api/booking/session/${saved.bookingId}`,
  );

  // could not ask the server, keep the saved booking and let the caller show the error page
  if (!answer) return 'unreachable';

  try {
    const { res, json } = answer;

    // the booking expired, keep the saved booking so the notice shows again on refresh
    if (res.ok && json.success && json.data.booking_status === 'expired') {
      return 'expired';
    }

    // the server answered and the booking is gone or confirmed
    if (!res.ok || !json.success || json.data.booking_status !== 'locked') {
      clearSession();
      return false;
    }

    const expiresAt = new Date(json.data.expires_at);
    const now = new Date();
    const remainingSeconds = Math.floor((expiresAt - now) / 1000);

    if (remainingSeconds <= 0) {
      return 'expired';
    }

    state.bookingId = saved.bookingId;
    state.expiresAt = saved.expiresAt;
    state.selectedVariant = saved.selectedVariant;
    state.selectedDate = saved.selectedDate;
    state.availabilityId = saved.availabilityId;

    return { remainingSeconds, step: saved.currentStep };
  } catch {
    clearSession();
    return false;
  }
}

// load service
async function loadService() {
  const answer = await fetchJsonWithRetry(`/api/booking/service/${serviceId}`);

  // could not reach the server, nothing is drawn yet so show the error page
  if (!answer) {
    showPageError({
      icon: 'ph-wifi-slash',
      label: 'Connection problem',
      title: 'Could Not Load This Service',
      message:
        'We could not reach our server. It may be your internet connection or our server being slow, so please try again.',
      buttonLabel: 'Try again',
      onButton: () => location.reload(),
      showLink: true,
    });
    return;
  }

  const { res, json } = answer;

  // the server answered but this service does not exist anymore
  if (!res.ok || !json.success) {
    showPageError({
      icon: 'ph-magnifying-glass',
      label: 'Not found',
      title: 'Service Not Available',
      message:
        'This service is no longer available. Please choose another one.',
      buttonLabel: 'Back to services',
      onButton: () => {
        window.location.href = '/services';
      },
      showLink: false,
    });
    return;
  }

  state.service = json.data;
  // fetch user data in background for autofill and navbar
  const autofillDone = loadUserAutofill();

  document.getElementById('service-skeleton').classList.add('hidden');
  document.getElementById('service-heading').classList.remove('hidden');
  document.getElementById('service-name').textContent = state.service.name;

  const restored = await tryRestoreSession();

  // could not reach the server, the saved booking is kept so show the error page
  if (restored === 'unreachable') {
    showPageError({
      icon: 'ph-wifi-slash',
      label: 'Connection problem',
      title: 'Could Not Check Your Booking',
      message:
        'Your booking details are saved on this device, nothing was lost.<br><br>We could not reach our server. It may be your internet connection or our server being slow, so please try again. Your slot is only held for a limited time, so try again soon.',
      buttonLabel: 'Try again',
      onButton: () => location.reload(),
      showLink: true,
    });
    return;
  }

  if (restored === 'expired') {
    renderVariants(state.service.variants);
    showModal(
      'Slot Expired',
      'Your slot reservation has expired. Please start your booking again.',
      () => {
        clearSession();
      },
      'Okay',
      true,
    );
    return;
  }

  if (restored) {
    renderVariants(state.service.variants);

    if (state.selectedVariant) {
      const cards = document.querySelectorAll('.variant-card');
      cards.forEach((card) => {
        if (
          card.dataset.id === state.selectedVariant.id ||
          (!card.dataset.id && !state.selectedVariant.id)
        ) {
          selectVariant(card, state.selectedVariant);
        }
      });
    }

    showStep(restored.step);
    autofillDone.then(restoreForm);
    // a refresh keeps the catcher when we're past step 1
    if (restored.step > 1) ensureCatcher();

    if (restored.step >= 3) {
      startTimerFromSeconds(restored.remainingSeconds);
    }

    if (restored.step === 2 || restored.step >= 3) {
      await loadDates();
    }

    if (restored.step === 4) {
      populateSummary();
    }
  } else {
    renderVariants(state.service.variants);
  }
}

// Step 1 - Variants
function renderVariants(variants) {
  const container = document.getElementById('variants-container');
  container.innerHTML = '';

  if (!variants || variants.length === 0) {
    const card = document.createElement('div');
    card.className =
      'variant-card cursor-pointer flex items-center justify-between bg-white/5 border-2 border-red-500 rounded-xl px-5 py-4 transition-all duration-200 selected';
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="ph ph-check-circle text-red-500 text-xl"></i>
        <span class="text-white font-medium">Standard</span>
      </div>
      <span class="text-white font-bold">${formatPrice(
        state.service.price,
      )}</span>
    `;
    container.appendChild(card);
    state.selectedVariant = {
      id: null,
      name: 'Standard',
      price: state.service.price,
    };
    document.getElementById('btn-step1-next').disabled = false;
    return;
  }

  variants.forEach((v) => {
    const card = document.createElement('div');
    card.className =
      'variant-card cursor-pointer flex items-center justify-between bg-white/5 border-2 border-white/10 rounded-xl px-5 py-4 transition-all duration-200 hover:border-white/30';
    card.dataset.id = v.id;
    card.dataset.name = v.name;
    card.dataset.price = v.price;
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="ph ph-circle text-white/20 text-xl variant-icon"></i>
        <span class="text-white/70 font-medium variant-name">${v.name}</span>
      </div>
      <span class="text-white font-bold">${formatPrice(v.price)}</span>
    `;
    card.addEventListener('click', () => selectVariant(card, v));
    container.appendChild(card);
  });
}

function selectVariant(card, variant) {
  document.querySelectorAll('.variant-card').forEach((c) => {
    c.classList.remove('border-red-500');
    c.classList.add('border-white/10');
    if (c.querySelector('.variant-icon')) {
      c.querySelector('.variant-icon').className =
        'ph ph-circle text-white/20 text-xl variant-icon';
    }
    if (c.querySelector('.variant-name')) {
      c.querySelector('.variant-name').classList.remove('text-white');
      c.querySelector('.variant-name').classList.add('text-white/70');
    }
  });
  card.classList.add('border-red-500');
  card.classList.remove('border-white/10');
  if (card.querySelector('.variant-icon')) {
    card.querySelector('.variant-icon').className =
      'ph ph-check-circle text-red-500 text-xl variant-icon';
  }
  if (card.querySelector('.variant-name')) {
    card.querySelector('.variant-name').classList.add('text-white');
    card.querySelector('.variant-name').classList.remove('text-white/70');
  }
  state.selectedVariant = variant;
  document.getElementById('btn-step1-next').disabled = false;
}

// Step 2 - Calendar
let calendarData = {};
let calendarMonth = new Date();
calendarMonth.setDate(1);

async function loadDates() {
  document.getElementById('dates-empty').classList.add('hidden');
  document.getElementById('btn-step2-next').disabled = true;
  document.getElementById('selected-date-display').classList.add('hidden');

  if (!state.bookingId) {
    state.selectedDate = null;
    state.availabilityId = null;
  }

  calendarData = {};

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = Array(35)
    .fill('<div class="skeleton-line h-9 rounded-lg"></div>')
    .join('');

  const res = await fetch(`/api/booking/availability/${serviceId}`);
  const json = await res.json();

  if (json.success && json.data.length > 0) {
    json.data.forEach((slot) => {
      const dateStr = slot.date.split('T')[0];
      calendarData[dateStr] = slot;
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // restore selected date display if coming back from a saved session
  if (state.selectedDate && state.availabilityId) {
    const dateStr = state.selectedDate.split('T')[0];
    const slot = calendarData[dateStr];
    if (slot) {
      const [y, m, d] = dateStr.split('-');
      const label = new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      document.getElementById('btn-step2-next').disabled = false;
      const display = document.getElementById('selected-date-display');
      display.classList.remove('hidden');
      display.classList.add('flex');
      document.getElementById('selected-date-text').textContent = `${label} - ${
        slot.remaining
      } slot${slot.remaining > 1 ? 's' : ''} left`;
    }
  }

  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const monthYearEl = document.getElementById('cal-month-year');
  const prevBtn = document.getElementById('cal-prev');

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  monthYearEl.textContent = calendarMonth.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  prevBtn.disabled = calendarMonth <= currentMonth;

  const headersEl = document.getElementById('cal-day-headers');
  headersEl.innerHTML = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(
      (d) =>
        `<div class="text-center text-xs text-white/30 uppercase tracking-widest py-3">${d}</div>`,
    )
    .join('');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
      d,
    ).padStart(2, '0')}`;
    const slot = calendarData[dateStr];
    const isPast = dateObj <= today;
    const isAvailable = !isPast && slot;
    const isSelected =
      state.selectedDate && state.selectedDate.split('T')[0] === dateStr;
    const isToday = dateObj.toDateString() === today.toDateString();

    const cell = document.createElement('div');
    cell.className =
      'relative flex items-center justify-center rounded-lg h-10 text-sm font-medium transition-all duration-200 ';

    if (isSelected) {
      cell.className +=
        'bg-red-500 text-white cursor-pointer ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]';
    } else if (isAvailable) {
      cell.className +=
        'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white cursor-pointer border border-green-500/40';
      cell.addEventListener('click', () => confirmSelectDate(slot, dateStr));
    } else {
      cell.className += 'text-white/20 cursor-not-allowed';
    }

    cell.textContent = d;

    if (isToday) {
      const dot = document.createElement('div');
      dot.className =
        'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ' +
        (isSelected ? 'bg-white' : 'bg-white/40');
      cell.appendChild(dot);
    }

    grid.appendChild(cell);
  }
}

function confirmSelectDate(slot, dateStr) {
  if (state.selectedDate && state.selectedDate.split('T')[0] === dateStr) {
    state.selectedDate = null;
    state.availabilityId = null;
    document.getElementById('btn-step2-next').disabled = true;
    document.getElementById('selected-date-display').classList.add('hidden');
    renderCalendar();
    return;
  }

  const [y, m, d] = dateStr.split('-');
  const label = new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  showModal(
    'Confirm Date',
    `Book for ${label}? You can still go back to change this.`,
    () => {
      state.selectedDate = slot.date;
      state.availabilityId = slot.availability_id;
      document.getElementById('btn-step2-next').disabled = false;

      const display = document.getElementById('selected-date-display');
      display.classList.remove('hidden');
      display.classList.add('flex');
      document.getElementById('selected-date-text').textContent = `${label} - ${
        slot.remaining
      } slot${slot.remaining > 1 ? 's' : ''} left`;

      renderCalendar();
    },
    'Confirm',
  );
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calendarMonth.setMonth(calendarMonth.getMonth() - 1);
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  calendarMonth.setMonth(calendarMonth.getMonth() + 1);
  renderCalendar();
});

// Lock slot
async function lockSlot() {
  const res = await fetch('/api/booking/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId,
      variantId: state.selectedVariant?.id || null,
      availabilityId: state.availabilityId,
    }),
  });
  const json = await res.json();

  if (json.blocked) {
    showModal(
      'Booking Temporarily Blocked',
      json.message,
      () => {},
      'Okay',
      true,
    );
    return false;
  }

  if (json.success) {
    state.bookingId = json.data.id;
    state.expiresAt = json.data.expires_at;
    saveSession();
    startTimer();
  }

  return json.success;
}

// Step 4 - Payment summary
function populateSummary() {
  const price = state.selectedVariant?.price || state.service?.price || 0;
  document.getElementById('summary-service').textContent =
    state.service?.name || '';
  document.getElementById('summary-variant').textContent =
    state.selectedVariant?.name || 'Standard';
  document.getElementById('summary-date').textContent = formatDate(
    state.selectedDate,
  );
  document.getElementById('summary-price').textContent = formatPrice(price);
  document.getElementById('full-amount').textContent = formatPrice(price);
  document.getElementById('down-amount').textContent = formatPrice(price / 2);
}

// Payment option toggle
document.querySelectorAll('.payment-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.payment-option').forEach((o) => {
      o.classList.remove('border-red-500');
      o.classList.add('border-white/10');
      o.querySelector('i').className = 'ph ph-circle text-white/30 text-xl';
    });
    opt.classList.add('border-red-500');
    opt.classList.remove('border-white/10');
    opt.querySelector('i').className =
      'ph ph-check-circle text-red-500 text-xl';
    opt.querySelector('input').checked = true;
  });
});

// Release helper used by UI buttons
async function releaseAndReset() {
  stopTimer();
  const res = await fetch('/api/booking/release', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: state.bookingId }),
  });
  const json = await res.json();
  state.bookingId = null;
  state.expiresAt = null;
  clearSession();
  return json.abuseCount || 0;
}

// Intercept nav links when slot is locked
document.querySelectorAll('nav a, #mobile-menu a').forEach((link) => {
  const href = link.getAttribute('href');
  if (href) {
    link.addEventListener('click', (e) => {
      if (state.bookingId && state.currentStep >= 3) {
        e.preventDefault();
        showModal(
          'Cancel Booking?',
          'Leaving this page will release your reserved slot and it may be taken by someone else.<br><br><span class="text-yellow-400 font-semibold">Note: Cancelling reservations 3 times within an hour will temporarily block you from booking for 2 hours.</span><br><br>Are you sure?',
          async () => {
            await releaseAndReset();
            window.location.href = href;
          },
        );
      }
    });
  }
});

document.getElementById('btn-back-services').addEventListener('click', () => {
  if (state.bookingId && state.currentStep >= 3) {
    showModal(
      'Cancel Booking?',
      'Going back to services will release your reserved slot and it may be taken by someone else.<br><br><span class="text-yellow-400 font-semibold">Note: Cancelling reservations 3 times within an hour will temporarily block you from booking for 2 hours.</span><br><br>Are you sure?',
      async () => {
        await releaseAndReset();
        window.location.href = '/services';
      },
    );
  } else {
    window.location.href = '/services';
  }
});

document.getElementById('btn-step1-next').addEventListener('click', () => {
  // leaving step 1 so add the catcher
  ensureCatcher();
  showStep(2);
  loadDates();
});

document.getElementById('btn-step2-back').addEventListener('click', () => {
  // go back through the browser so popstate does the step change
  if (history.state && history.state.catcher) history.back();
  else showStep(1);
});

document
  .getElementById('btn-step2-next')
  .addEventListener('click', async () => {
    const btn = document.getElementById('btn-step2-next');
    btn.disabled = true;
    btn.innerHTML =
      '<i class="ph ph-spinner animate-spin"></i> Reserving slot...';
    const success = await lockSlot();
    if (success) {
      clearAllFields();
      showStep(3);
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Continue <i class="ph ph-arrow-right"></i>';
    }
  });

document.getElementById('btn-step3-back').addEventListener('click', () => {
  showModal(
    'Release Slot?',
    'Going back will release your reserved slot and someone else may take it.<br><br><span class="text-yellow-400 font-semibold">Note: Cancelling reservations 3 times within an hour will temporarily block you from booking for 2 hours.</span><br><br>Are you sure?',
    async () => {
      const abuseCount = await releaseAndReset();
      const btn = document.getElementById('btn-step2-next');
      btn.disabled = true;
      btn.innerHTML = 'Continue <i class="ph ph-arrow-right"></i>';

      if (abuseCount === 2) {
        showModal(
          'Warning',
          'You have cancelled 2 reservations. <span class="text-red-400 font-semibold">One more cancellation within this hour will block you from booking for 2 hours.</span>',
          () => {
            showStep(2);
            loadDates();
          },
          'Understood',
          true,
        );
      } else {
        showStep(2);
        loadDates();
      }
    },
  );
});

document
  .getElementById('btn-step3-next')
  .addEventListener('click', async () => {
    // client-side validation first
    const isValid = validateStep3();
    if (!isValid) {
      // scroll to first error
      const firstError = document.querySelector(
        '#step-3 .field-error:not(.hidden)',
      );
      if (firstError)
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = document.getElementById('btn-step3-next');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Saving...';

    const name = document.getElementById('input-name').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const plate = document.getElementById('input-plate').value.trim();
    const model = document.getElementById('input-model').value.trim();
    const color = document.getElementById('input-color').value.trim();
    const description = document
      .getElementById('input-description')
      .value.trim();

    const res = await fetch(`/api/booking/${state.bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        motorcyclePlate: plate,
        motorcycleModel: model,
        motorcycleColor: color,
        motorcycleDescription: description,
      }),
    });

    const json = await res.json();

    btn.disabled = false;
    btn.innerHTML = 'Continue <i class="ph ph-arrow-right"></i>';

    if (!json.success) {
      // handle server-side field errors
      if (json.fields) {
        Object.entries(json.fields).forEach(([field, message]) => {
          const fieldMap = {
            guestName: 'input-name',
            guestEmail: 'input-email',
            guestPhone: 'input-phone',
            motorcyclePlate: 'input-plate',
            motorcycleModel: 'input-model',
            motorcycleColor: 'input-color',
          };
          const el = document.getElementById(fieldMap[field]);
          if (el) setFieldError(el, message);
        });
        const firstError = document.querySelector(
          '#step-3 .field-error:not(.hidden)',
        );
        if (firstError)
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    populateSummary();
    showStep(4);
  });

document.getElementById('btn-step4-back').addEventListener('click', () => {
  showStep(3);
});

document.getElementById('btn-pay').addEventListener('click', async () => {
  const paymentType = document.querySelector(
    'input[name="payment_type"]:checked',
  ).value;
  const btn = document.getElementById('btn-pay');

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Processing...';

  const res = await fetch('/api/booking/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: state.bookingId, paymentType }),
  });

  const json = await res.json();
  if (json.success) {
    clearSession();
    window.location.href = json.invoiceUrl;
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-lock"></i> Proceed to Payment';
  }
});

// Mobile menu
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

async function loadUserAutofill() {
  try {
    const [meRes, lastRes] = await Promise.all([
      fetch('/api/customer/me'),
      fetch('/api/customer/last-booking'),
    ]);
    const meJson = await meRes.json();
    const lastJson = await lastRes.json();

    if (meJson.success) {
      const u = meJson.user;
      if (u.name) document.getElementById('input-name').value = u.name;
      if (u.email) document.getElementById('input-email').value = u.email;
      if (u.phone) document.getElementById('input-phone').value = u.phone;

      // update navbar for logged in state
      updateNavForUser(u);
    }

    if (lastJson.success && lastJson.data) {
      const b = lastJson.data;
      if (b.motorcycle_plate)
        document.getElementById('input-plate').value = b.motorcycle_plate;
      if (b.motorcycle_model)
        document.getElementById('input-model').value = b.motorcycle_model;
      if (b.motorcycle_color)
        document.getElementById('input-color').value = b.motorcycle_color;
      if (b.motorcycle_description)
        document.getElementById('input-description').value =
          b.motorcycle_description;
    }
  } catch {
    // fail silently, autofill is not critical
  }
}

function updateNavForUser(user) {
  // desktop nav
  const desktopNav = document.querySelector('nav.hidden.md\\:flex');
  if (desktopNav) {
    const signInLink = desktopNav.querySelector('a[href="/customer/login"]');
    if (signInLink) {
      signInLink.href = '/customer/account';
      signInLink.innerHTML = `<i class="ph ph-user-circle text-red-500 text-base"></i> ${
        user.name.split(' ')[0]
      }`;
      signInLink.className =
        'nav-link text-sm tracking-wide flex items-center gap-1.5';
    }
  }

  // mobile menu
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) {
    const signInLink = mobileMenu.querySelector('a[href="/customer/login"]');
    if (signInLink) {
      signInLink.href = '/customer/account';
      signInLink.textContent = `Hi, ${user.name.split(' ')[0]}`;
      signInLink.className = 'text-sm text-white py-3 border-b border-white/5';
    }
  }
}

// Init
loadService();
