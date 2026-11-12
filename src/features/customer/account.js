// ACCOUNT PAGE JS
// EMAIL CHANGE FLOW
let otpExpiryInterval = null;
let resendCooldownInterval = null;

function startOtpExpiryTimer() {
  clearInterval(otpExpiryInterval);
  let seconds = 600;
  const expiryEl = document.getElementById('otp-expires-in');
  expiryEl.className = 'text-yellow-400 text-xs mb-3';

  otpExpiryInterval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(otpExpiryInterval);
      expiryEl.className = 'text-red-400 text-xs mb-3';
      expiryEl.textContent = 'Code expired. Request a new one.';
      return;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    expiryEl.textContent = `Expires in ${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function startResendCooldown() {
  clearInterval(resendCooldownInterval);
  let seconds = 60;
  const btn = document.getElementById('btn-resend-otp');
  const text = document.getElementById('resend-otp-text');
  btn.disabled = true;
  btn.classList.remove('hover:text-red-400', 'text-white/30');
  btn.classList.add('text-white/20');
  text.textContent = `Resend code (${seconds}s)`;

  resendCooldownInterval = setInterval(() => {
    seconds--;
    text.textContent = `Resend code (${seconds}s)`;
    if (seconds <= 0) {
      clearInterval(resendCooldownInterval);
      btn.disabled = false;
      text.textContent = 'Resend code';
      btn.classList.remove('text-white/20');
      btn.classList.add('hover:text-red-400', 'text-white/30');
    }
  }, 1000);
}

function resetEmailChangeForm() {
  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('email-step-1').classList.remove('hidden');
  document.getElementById('email-step-2').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('flex');
  document.getElementById('email-step2-error').classList.add('hidden');
  document.getElementById('email-step1-error').classList.add('hidden');
  document.getElementById('email-step1-success').classList.add('hidden');
  document.getElementById('change-email-input').value = '';
  document.getElementById('otp-input').value = '';
  document.getElementById('otp-expires-in').textContent = '';
  const resendBtn = document.getElementById('btn-resend-otp');
  resendBtn.disabled = false;
  document.getElementById('resend-otp-text').textContent = 'Resend code';
  resendBtn.classList.remove('text-white/20');
  resendBtn.classList.add('hover:text-red-400', 'text-white/30');
}

document.getElementById('btn-back-email').addEventListener('click', () => {
  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('email-step-2').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('flex');
  document.getElementById('email-step-1').classList.remove('hidden');
  document.getElementById('email-step2-error').classList.add('hidden');
  document.getElementById('otp-expires-in').textContent = '';
});

async function sendOtp() {
  const email = document.getElementById('change-email-input').value.trim();
  const errorEl = document.getElementById('email-step1-error');
  const successEl = document.getElementById('email-step1-success');
  const btn = document.getElementById('btn-send-otp');
  const icon = document.getElementById('send-otp-icon');
  const text = document.getElementById('send-otp-text');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!email) {
    errorEl.textContent = 'Email is required.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  icon.className = 'ph ph-spinner animate-spin text-sm';
  text.textContent = 'Sending...';

  const res = await fetch('/api/customer/email', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const json = await res.json();
  btn.disabled = false;
  icon.className = 'ph ph-paper-plane-tilt text-sm';
  text.textContent = 'Send Code';

  if (!json.success) {
    errorEl.textContent = json.message;
    errorEl.classList.remove('hidden');
    return;
  }

  successEl.textContent = json.message;
  successEl.classList.remove('hidden');
  document.getElementById('email-step-1').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('hidden');
  document.getElementById('email-step-2').classList.add('flex');
  startOtpExpiryTimer();
  startResendCooldown();
}

async function verifyOtp() {
  const otp = document.getElementById('otp-input').value.trim();
  const errorEl = document.getElementById('email-step2-error');
  const successEl = document.getElementById('email-step2-success');
  const btn = document.getElementById('btn-verify-otp');
  const icon = document.getElementById('verify-otp-icon');
  const text = document.getElementById('verify-otp-text');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!otp) {
    errorEl.textContent = 'Verification code is required.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  icon.className = 'ph ph-spinner animate-spin text-sm';
  text.textContent = 'Verifying...';

  const res = await fetch('/api/customer/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp }),
  });

  const json = await res.json();
  btn.disabled = false;
  icon.className = 'ph ph-check text-sm';
  text.textContent = 'Verify';

  if (!json.success) {
    errorEl.textContent = json.message;
    errorEl.classList.remove('hidden');
    return;
  }

  clearInterval(otpExpiryInterval);
  clearInterval(resendCooldownInterval);
  document.getElementById('profile-email').textContent = json.user.email;
  document.getElementById('profile-email-2').textContent = json.user.email;
  resetEmailChangeForm();
}

document.getElementById('btn-send-otp').addEventListener('click', sendOtp);
document.getElementById('btn-verify-otp').addEventListener('click', verifyOtp);

document.getElementById('otp-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyOtp();
});

document
  .getElementById('btn-resend-otp')
  .addEventListener('click', async () => {
    const email = document.getElementById('change-email-input').value.trim();
    const errorEl = document.getElementById('email-step2-error');
    const successEl = document.getElementById('email-step2-success');
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const res = await fetch('/api/customer/email', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!json.success) {
      errorEl.textContent = json.message;
      errorEl.classList.remove('hidden');
      return;
    }

    successEl.textContent = 'New code sent.';
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 3000);
    startOtpExpiryTimer();
    startResendCooldown();
  });

async function loadProfile() {
  const res = await fetch('/api/customer/me');
  const json = await res.json();
  if (!json.success) return;
  const u = json.user;
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('profile-phone').textContent = u.phone || '-';
  document.getElementById('profile-email-2').textContent = u.email;
  document.getElementById('edit-name').value = u.name;
  document.getElementById('edit-phone').value = u.phone || '';
}

document.getElementById('edit-phone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

document
  .getElementById('btn-save-profile')
  .addEventListener('click', async () => {
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const errorName = document.getElementById('edit-error-name');
    const errorPhone = document.getElementById('edit-error-phone');
    const formError = document.getElementById('edit-form-error');
    const formSuccess = document.getElementById('edit-form-success');

    errorName.classList.add('hidden');
    errorPhone.classList.add('hidden');
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');

    let valid = true;
    if (!name || name.length < 2) {
      errorName.textContent = !name
        ? 'Name is required.'
        : 'Name must be at least 2 characters.';
      errorName.classList.remove('hidden');
      valid = false;
    }
    if (!phone) {
      errorPhone.textContent = 'Phone number is required.';
      errorPhone.classList.remove('hidden');
      valid = false;
    } else if (!/^09\d{9}$/.test(phone)) {
      errorPhone.textContent = 'Enter a valid PH number (09XXXXXXXXX).';
      errorPhone.classList.remove('hidden');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('btn-save-profile');
    const icon = document.getElementById('save-icon');
    const text = document.getElementById('save-text');
    btn.disabled = true;
    icon.className = 'ph ph-spinner animate-spin text-sm';
    text.textContent = 'Saving...';

    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });

    const json = await res.json();
    btn.disabled = false;
    icon.className = 'ph ph-floppy-disk text-sm';
    text.textContent = 'Save';

    if (!json.success) {
      formError.textContent = json.message;
      formError.classList.remove('hidden');
      return;
    }

    document.getElementById('profile-name').textContent = json.user.name;
    document.getElementById('profile-phone').textContent = json.user.phone;
    formSuccess.textContent = 'Profile updated successfully.';
    formSuccess.classList.remove('hidden');
  });

document.getElementById('btn-logout').addEventListener('click', async () => {
  const res = await fetch('/api/customer/logout', { method: 'POST' });
  const json = await res.json();
  if (json.success) window.location.href = json.redirect;
});

// change password
function resetPasswordForm() {
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('error-current-password').classList.add('hidden');
  document.getElementById('error-new-password').classList.add('hidden');
  document.getElementById('error-confirm-password').classList.add('hidden');
  document.getElementById('change-password-error').classList.add('hidden');
  document.getElementById('change-password-success').classList.add('hidden');
}

document
  .getElementById('btn-save-password')
  .addEventListener('click', async () => {
    const currentPassword = document
      .getElementById('current-password')
      .value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmPassword = document
      .getElementById('confirm-password')
      .value.trim();

    const errorCurrent = document.getElementById('error-current-password');
    const errorNew = document.getElementById('error-new-password');
    const errorConfirm = document.getElementById('error-confirm-password');
    const formError = document.getElementById('change-password-error');
    const formSuccess = document.getElementById('change-password-success');

    errorCurrent.classList.add('hidden');
    errorNew.classList.add('hidden');
    errorConfirm.classList.add('hidden');
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');

    let valid = true;

    if (!currentPassword) {
      errorCurrent.textContent = 'Current password is required.';
      errorCurrent.classList.remove('hidden');
      valid = false;
    }

    if (!newPassword) {
      errorNew.textContent = 'New password is required.';
      errorNew.classList.remove('hidden');
      valid = false;
    } else if (newPassword.length < 8) {
      errorNew.textContent = 'Password must be at least 8 characters.';
      errorNew.classList.remove('hidden');
      valid = false;
    }

    if (!confirmPassword) {
      errorConfirm.textContent = 'Please confirm your new password.';
      errorConfirm.classList.remove('hidden');
      valid = false;
    } else if (newPassword && confirmPassword !== newPassword) {
      errorConfirm.textContent = 'Passwords do not match.';
      errorConfirm.classList.remove('hidden');
      valid = false;
    }

    if (!valid) return;

    const btn = document.getElementById('btn-save-password');
    const icon = document.getElementById('save-password-icon');
    const text = document.getElementById('save-password-text');
    btn.disabled = true;
    icon.className = 'ph ph-spinner animate-spin text-sm';
    text.textContent = 'Saving...';

    const res = await fetch('/api/customer/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const json = await res.json();
    btn.disabled = false;
    icon.className = 'ph ph-floppy-disk text-sm';
    text.textContent = 'Save';

    if (!json.success) {
      formError.textContent = json.message;
      formError.classList.remove('hidden');
      return;
    }

    formSuccess.textContent = 'Password changed successfully.';
    formSuccess.classList.remove('hidden');
    resetPasswordForm();
    document
      .getElementById('change-password-success')
      .classList.remove('hidden');
    document.getElementById('change-password-success').textContent =
      'Password changed successfully.';
  });

document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').className = isPassword
      ? 'ph ph-eye-slash text-lg'
      : 'ph ph-eye text-lg';
  });
});

loadProfile();
