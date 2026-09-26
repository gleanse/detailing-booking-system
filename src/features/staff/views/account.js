let pendingEmail = '';
let otpExpiryTimer = null;
let resendCooldownTimer = null;

const fieldErr = (id, msg) => {
  const el = document.getElementById(id);
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else el.classList.add('hidden');
};

const formMsg = (id, msg, isError = true) => {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  if (!isError) {
    el.className = el.className
      .replace('text-red-400', 'text-green-400')
      .replace('bg-red-500/10', 'bg-green-500/10')
      .replace('border-red-500/20', 'border-green-500/20');
  }
};

const hideMsg = (id) => document.getElementById(id).classList.add('hidden');

// password toggles
document.querySelectorAll('.toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector('i');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    icon.className = isPassword
      ? 'ph ph-eye-slash text-lg'
      : 'ph ph-eye text-lg';
  });
});

// password strength
document.getElementById('new-password').addEventListener('input', () => {
  const val = document.getElementById('new-password').value;
  const bar = document.getElementById('pw-strength-bar');
  const fill = document.getElementById('pw-strength-fill');
  const label = document.getElementById('pw-strength-label');

  if (!val) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');

  const strong =
    val.length >= 8 &&
    /[A-Z]/.test(val) &&
    /[0-9]/.test(val) &&
    /[^A-Za-z0-9]/.test(val);
  const medium = val.length >= 8 && (/[A-Z]/.test(val) || /[0-9]/.test(val));

  if (strong) {
    fill.className =
      'h-full rounded-full transition-all duration-300 w-full bg-green-500';
    label.textContent = 'Strong password';
    label.className = 'text-xs mt-1 text-green-400';
  } else if (medium) {
    fill.className =
      'h-full rounded-full transition-all duration-300 w-2/3 bg-yellow-400';
    label.textContent = 'Medium - add numbers or symbols';
    label.className = 'text-xs mt-1 text-yellow-400';
  } else {
    fill.className =
      'h-full rounded-full transition-all duration-300 w-1/3 bg-red-500';
    label.textContent = 'Weak - too short';
    label.className = 'text-xs mt-1 text-red-400';
  }
});

// load profile
async function loadProfile() {
  try {
    const res = await fetch('/staff/me');
    const data = await res.json();
    if (!data.success) return;
    const u = data.user;
    document.getElementById('profile-name').textContent = u.name;
    document.getElementById('profile-email').textContent = u.email;
    document.getElementById('profile-role').textContent = u.role;
  } catch (err) {
    console.error('Load profile error:', err);
  }
}

// CHANGE PASSWORD
document
  .getElementById('btn-save-password')
  .addEventListener('click', async () => {
    hideMsg('pw-form-error');
    hideMsg('pw-form-success');
    fieldErr('err-current-password', null);
    fieldErr('err-new-password', null);
    fieldErr('err-confirm-password', null);

    const current = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    let valid = true;

    if (!current) {
      fieldErr('err-current-password', 'Current password is required.');
      valid = false;
    }
    if (!newPw) {
      fieldErr('err-new-password', 'New password is required.');
      valid = false;
    } else if (newPw.length < 8) {
      fieldErr('err-new-password', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (!confirm) {
      fieldErr('err-confirm-password', 'Please confirm your new password.');
      valid = false;
    } else if (newPw && confirm !== newPw) {
      fieldErr('err-confirm-password', 'Passwords do not match.');
      valid = false;
    }

    if (!valid) return;

    const btn = document.getElementById('btn-save-password');
    const icon = document.getElementById('pw-btn-icon');
    const text = document.getElementById('pw-btn-text');
    btn.disabled = true;
    icon.className = 'ph ph-circle-notch animate-spin text-base';
    text.textContent = 'Saving...';

    try {
      const res = await fetch('/staff/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
      });
      const data = await res.json();

      if (!data.success) {
        formMsg('pw-form-error', data.message);
      } else {
        formMsg('pw-form-error', data.message, false);
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        document.getElementById('pw-strength-bar').classList.add('hidden');
      }
    } catch (err) {
      formMsg('pw-form-error', 'Server error. Please try again.');
    }

    btn.disabled = false;
    icon.className = 'ph ph-floppy-disk text-base';
    text.textContent = 'Save Password';
  });

// CHANGE EMAIL - Step 1
document
  .getElementById('btn-send-email-otp')
  .addEventListener('click', async () => {
    hideMsg('email-step1-error');
    fieldErr('err-new-email', null);

    const email = document.getElementById('new-email-input').value.trim();

    if (!email) {
      fieldErr('err-new-email', 'Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErr('err-new-email', 'Enter a valid email address.');
      return;
    }

    const btn = document.getElementById('btn-send-email-otp');
    const icon = document.getElementById('send-otp-icon');
    const text = document.getElementById('send-otp-text');
    btn.disabled = true;
    icon.className = 'ph ph-circle-notch animate-spin text-base';
    text.textContent = 'Sending...';

    try {
      const res = await fetch('/staff/account/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        formMsg('email-step1-error', data.message);
      } else {
        pendingEmail = email;
        document.getElementById('otp-sent-to').textContent =
          `Code sent to ${email}. Expires in 10 minutes.`;
        document.getElementById('email-step-1').classList.add('hidden');
        const step2 = document.getElementById('email-step-2');
        step2.classList.remove('hidden');
        step2.classList.add('flex');
        startOtpExpiry();
        startResendCooldown();
      }
    } catch (err) {
      formMsg('email-step1-error', 'Server error. Please try again.');
    }

    btn.disabled = false;
    icon.className = 'ph ph-paper-plane-tilt text-base';
    text.textContent = 'Send Verification Code';
  });

// back to step 1
document.getElementById('btn-back-email').addEventListener('click', () => {
  clearInterval(otpExpiryTimer);
  clearInterval(resendCooldownTimer);
  document.getElementById('email-step-2').classList.add('hidden');
  document.getElementById('email-step-2').classList.remove('flex');
  document.getElementById('email-step-1').classList.remove('hidden');
  document.getElementById('otp-input').value = '';
  hideMsg('email-step2-error');
  document.getElementById('otp-expires').textContent = '';
});

// resend OTP
document
  .getElementById('btn-resend-otp')
  .addEventListener('click', async () => {
    hideMsg('email-step2-error');
    try {
      const res = await fetch('/staff/account/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      if (data.success) {
        startOtpExpiry();
        startResendCooldown();
      } else {
        const el = document.getElementById('email-step2-error');
        el.textContent = data.message;
        el.classList.remove('hidden');
      }
    } catch (err) {
      const el = document.getElementById('email-step2-error');
      el.textContent = 'Server error. Please try again.';
      el.classList.remove('hidden');
    }
  });

// verify OTP
document
  .getElementById('btn-verify-otp')
  .addEventListener('click', async () => {
    hideMsg('email-step2-error');
    fieldErr('err-otp', null);

    const otp = document.getElementById('otp-input').value.trim();
    if (!otp) {
      fieldErr('err-otp', 'Verification code is required.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      fieldErr('err-otp', 'Enter the 6-digit code.');
      return;
    }

    const btn = document.getElementById('btn-verify-otp');
    const icon = document.getElementById('verify-otp-icon');
    const text = document.getElementById('verify-otp-text');
    btn.disabled = true;
    icon.className = 'ph ph-circle-notch animate-spin text-base';
    text.textContent = 'Verifying...';

    try {
      const res = await fetch('/staff/account/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, otp }),
      });
      const data = await res.json();

      if (!data.success) {
        const el = document.getElementById('email-step2-error');
        el.textContent = data.message;
        el.classList.remove('hidden');
      } else {
        clearInterval(otpExpiryTimer);
        clearInterval(resendCooldownTimer);
        document.getElementById('profile-email').textContent = data.user.email;
        document.getElementById('email-step-2').classList.add('hidden');
        document.getElementById('email-step-2').classList.remove('flex');
        document.getElementById('email-step-1').classList.remove('hidden');
        document.getElementById('new-email-input').value = '';
        document.getElementById('otp-input').value = '';
        // show success on step 1
        const successEl = document.createElement('p');
        successEl.className =
          'text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2';
        successEl.textContent = 'Email updated successfully.';
        document.getElementById('email-step-1').prepend(successEl);
        setTimeout(() => successEl.remove(), 5000);
      }
    } catch (err) {
      const el = document.getElementById('email-step2-error');
      el.textContent = 'Server error. Please try again.';
      el.classList.remove('hidden');
    }

    btn.disabled = false;
    icon.className = 'ph ph-shield-check text-base';
    text.textContent = 'Verify & Update Email';
  });

// enter key on OTP input
document.getElementById('otp-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-verify-otp').click();
});

function startOtpExpiry() {
  clearInterval(otpExpiryTimer);
  let seconds = 600;
  const el = document.getElementById('otp-expires');
  el.className = 'text-yellow-400 text-xs';
  otpExpiryTimer = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(otpExpiryTimer);
      el.className = 'text-red-400 text-xs';
      el.textContent = 'Code expired. Request a new one.';
      return;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `Expires in ${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function startResendCooldown() {
  clearInterval(resendCooldownTimer);
  let seconds = 60;
  const btn = document.getElementById('btn-resend-otp');
  const text = document.getElementById('resend-text');
  btn.disabled = true;
  text.textContent = `Resend code (${seconds}s)`;
  resendCooldownTimer = setInterval(() => {
    seconds--;
    text.textContent = `Resend code (${seconds}s)`;
    if (seconds <= 0) {
      clearInterval(resendCooldownTimer);
      btn.disabled = false;
      text.textContent = 'Resend code';
    }
  }, 1000);
}

loadProfile();
