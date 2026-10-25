const isLoginPage = document.getElementById('loginForm') !== null;

function setFieldState(fieldId, state, message = '') {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  const wrap = field?.closest('.input-wrap');
  const status = wrap?.querySelector('.input-status');

  if (!field) return;

  field.classList.remove('is-valid', 'is-error');

  if (status) {
    status.classList.remove('valid', 'error');
  }

  if (state === 'valid') {
    field.classList.add('is-valid');

    if (status) {
      status.classList.add('valid');
      status.innerHTML = '<i class="fas fa-check"></i>';
    }

    if (error) error.textContent = '';

  } else if (state === 'error') {
    field.classList.add('is-error');

    if (status) {
      status.classList.add('error');
      status.innerHTML = '<i class="fas fa-times"></i>';
    }

    if (error) error.textContent = message;

  } else {
    if (status) {
      status.innerHTML = '';
    }

    if (error) error.textContent = '';
  }
}

function showMessage(type, text) {
  const msg = document.getElementById('formMessage');
  if (!msg) return;

  const icon = type === 'success'
    ? 'fa-check-circle'
    : 'fa-exclamation-circle';

  msg.className = `form-message ${type}`;
  msg.innerHTML = `
    <span class="message-icon">
      <i class="fas ${icon}"></i>
    </span>
    <span class="message-text">${text}</span>
  `;

  msg.style.display = 'flex';
}

function setLoading(isLoading) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = isLoading;
  if (text) text.style.display = isLoading ? 'none' : 'flex';
  if (loader) loader.style.display = isLoading ? 'flex' : 'none';
}

const togglePw = document.getElementById('togglePw');
const pwIcon = document.getElementById('pwIcon');

if (togglePw) {
  togglePw.addEventListener('click', () => {
    const pwField = document.getElementById('password');
    const isHidden = pwField.type === 'password';
    pwField.type = isHidden ? 'text' : 'password';
    pwIcon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
  });
}

if (isLoginPage) {
  const loginForm = document.getElementById('loginForm');

  const validators = {
    email: (val) => {
      if (!val) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email address';
      return '';
    },
    password: (val) => {
      if (!val) return 'Password is required';
      if (val.length < 6) return 'Password must be at least 6 characters';
      return '';
    },
  };

  function validateLoginField(id) {
    const val = document.getElementById(id)?.value || '';
    const err = validators[id](val);
    setFieldState(id, err ? 'error' : 'valid', err);
    return !err;
  }

  ['email', 'password'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => validateLoginField(id));
    el.addEventListener('input', () => {
      if (el.classList.contains('is-error')) validateLoginField(id);
    });
  });

  async function doLogin(force = false) {
    setLoading(true);
    document.getElementById('formMessage').style.display = 'none';

    const payload = {
      email: document.getElementById('email').value.trim().toLowerCase(),
      password: document.getElementById('password').value,
      force,
    };

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', 'Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = data.redirect || '/admin/dashboard.html';
        }, 1000);
        return;
      }

      setLoading(false);

      if (res.status === 409 && data.code === 'ALREADY_LOGGED_IN') {
        const ok = confirm(
          'This account is already logged in on another device. Log out that device and continue here?'
        );
        if (ok) return doLogin(true);
      }

      showMessage('error', data.message || 'Invalid email or password');
    } catch (err) {
      showMessage('error', 'Network error. Please try again.');
      setLoading(false);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailOk = validateLoginField('email');
    const passwordOk = validateLoginField('password');

    if (!emailOk || !passwordOk) return;

    doLogin(false);
  });
}