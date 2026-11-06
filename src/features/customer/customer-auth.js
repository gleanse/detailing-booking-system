const isLoginPage = window.location.pathname.includes('/login');

// Password toggle
const togglePw = document.getElementById('toggle-pw');
const pwIcon = document.getElementById('pw-icon');
const pwInput = document.getElementById('input-password');

if (togglePw) {
  togglePw.addEventListener('click', () => {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    pwIcon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });
}

// Confirm password toggle (register only)
const toggleConfirmPw = document.getElementById('toggle-confirm-pw');
const confirmPwIcon = document.getElementById('confirm-pw-icon');
const confirmPwInput = document.getElementById('input-confirm-password');

if (toggleConfirmPw) {
  toggleConfirmPw.addEventListener('click', () => {
    const isHidden = confirmPwInput.type === 'password';
    confirmPwInput.type = isHidden ? 'text' : 'password';
    confirmPwIcon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });
}

// Password strength (register only)
if (!isLoginPage && pwInput) {
  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!val) {
      fill.className = 'strength-fill';
      fill.style.width = '';
      label.textContent = '';
      return;
    }
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) =>
      r.test(val),
    ).length;
    const longPassphrase = val.length >= 16 && new Set(val).size >= 8;

    if (val.length < 8) {
      fill.className = 'strength-fill weak';
      label.textContent = 'Too short - use at least 8 characters';
      label.className = 'text-red-400 text-xs mt-1';
    } else if (classes >= 3 || longPassphrase) {
      fill.className = 'strength-fill strong';
      label.textContent = 'Strong password';
      label.className = 'text-green-400 text-xs mt-1';
    } else if (classes === 2) {
      fill.className = 'strength-fill medium';
      label.textContent = 'Medium - add more variety or make it longer';
      label.className = 'text-yellow-400 text-xs mt-1';
    } else {
      fill.className = 'strength-fill weak';
      label.textContent = 'Weak - mix in uppercase letters, numbers or symbols';
      label.className = 'text-red-400 text-xs mt-1';
    }
  });
}

// Field helpers
function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
  el.querySelector('span').textContent = message;
  const inputId = id.replace('error-', 'input-');
  const input = document.getElementById(inputId);
  if (input) input.classList.add('is-error');
}

function clearError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
  const inputId = id.replace('error-', 'input-');
  const input = document.getElementById(inputId);
  if (input) {
    input.classList.remove('is-error');
    input.classList.add('is-valid');
  }
}

function showFormError(message) {
  const el = document.getElementById('form-error');
  el.classList.remove('hidden');
  el.classList.add('flex');
  document.getElementById('form-error-text').textContent = message;
  shakeEl(el);
}

function hideFormError() {
  const el = document.getElementById('form-error');
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function setLoading(loading) {
  const btn = document.getElementById('btn-submit');
  const text = document.getElementById('btn-text');
  const icon = document.getElementById('btn-icon');
  btn.disabled = loading;
  if (loading) {
    icon.className = 'ph ph-spinner animate-spin text-base';
    text.textContent = isLoginPage ? 'Signing in...' : 'Creating account...';
  } else {
    icon.className = isLoginPage
      ? 'ph ph-sign-in text-base'
      : 'ph ph-user-plus text-base';
    text.textContent = isLoginPage ? 'Sign In' : 'Create Account';
  }
}

// Live validation on input
[
  'input-email',
  'input-password',
  'input-name',
  'input-phone',
  'input-confirm-password',
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    if (id === 'input-phone') {
      el.value = el.value.replace(/[^0-9]/g, '');
    }
    el.classList.remove('is-error');
    const errorId = id.replace('input-', 'error-');
    const err = document.getElementById(errorId);
    if (err) {
      err.classList.add('hidden');
      err.classList.remove('flex');
    }
    hideFormError();
  });
});

// Validation
function validateLogin() {
  let valid = true;
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError(
      'error-email',
      !email ? 'Email is required.' : 'Enter a valid email address.',
    );
    valid = false;
  } else clearError('error-email');

  if (!password) {
    showError('error-password', 'Password is required.');
    valid = false;
  } else clearError('error-password');

  return valid;
}

function validateRegister() {
  let valid = true;
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const password = document.getElementById('input-password').value;
  const confirmPassword = document.getElementById(
    'input-confirm-password',
  ).value;

  if (!name || name.length < 2) {
    showError(
      'error-name',
      !name ? 'Full name is required.' : 'Name must be at least 2 characters.',
    );
    valid = false;
  } else clearError('error-name');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError(
      'error-email',
      !email ? 'Email is required.' : 'Enter a valid email address.',
    );
    valid = false;
  } else clearError('error-email');

  if (!phone) {
    showError('error-phone', 'Phone number is required.');
    valid = false;
  } else if (!/^09\d{9}$/.test(phone)) {
    showError('error-phone', 'Enter a valid PH number (09XXXXXXXXX).');
    valid = false;
  } else {
    clearError('error-phone');
  }

  if (!password || password.length < 8) {
    showError(
      'error-password',
      !password
        ? 'Password is required.'
        : 'Password must be at least 8 characters.',
    );
    valid = false;
  } else clearError('error-password');

  if (!confirmPassword) {
    showError('error-confirm-password', 'Please confirm your password.');
    valid = false;
  } else if (confirmPassword !== password) {
    showError('error-confirm-password', 'Passwords do not match.');
    valid = false;
  } else clearError('error-confirm-password');

  return valid;
}

// Submit
document.getElementById('btn-submit').addEventListener('click', async () => {
  hideFormError();

  if (isLoginPage) {
    if (!validateLogin()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('input-email').value.trim(),
          password: document.getElementById('input-password').value,
          rememberMe: document.getElementById('remember-me')?.checked || false,
        }),
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = json.redirect || '/customer/account';
      } else if (json.needsVerification) {
        openVerify(json.email);
      } else {
        showFormError(json.message || 'Invalid email or password.');
      }
    } catch {
      showFormError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  } else {
    if (!validateRegister()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('input-name').value.trim(),
          email: document.getElementById('input-email').value.trim(),
          phone: document.getElementById('input-phone').value.trim() || null,
          password: document.getElementById('input-password').value,
        }),
      });
      const json = await res.json();
      if (json.success && json.verify) {
        openVerify(json.email);
      } else if (json.success) {
        window.location.href = json.redirect || '/customer/account';
      } else {
        showFormError(
          json.message || 'Could not create account. Please try again.',
        );
      }
    } catch {
      showFormError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }
});

if (isLoginPage) {
  const passwordInput = document.getElementById('input-password');
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent any default form behavior
        document.getElementById('btn-submit').click();
      }
    });
  }
} else {
  // For register page - submit on Enter in confirm password field
  const confirmPasswordInput = document.getElementById(
    'input-confirm-password',
  );
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-submit').click();
      }
    });
  }
}

// FORGOT PASSWORD
if (isLoginPage) {
  const sectionLogin = document.getElementById('section-login');
  const sectionForgot = document.getElementById('section-forgot');
  const sectionReset = document.getElementById('section-reset');

  let forgotEmail = '';

  function showSection(section) {
    showView(section);
  }

  document
    .getElementById('btn-forgot-password')
    .addEventListener('click', () => {
      showSection(sectionForgot);
    });

  document.getElementById('btn-back-to-login').addEventListener('click', () => {
    showSection(sectionLogin);
  });

  document
    .getElementById('btn-back-to-forgot')
    .addEventListener('click', () => {
      showSection(sectionForgot);
    });

  const toggleResetPw = document.getElementById('toggle-reset-pw');
  const resetPwIcon = document.getElementById('reset-pw-icon');
  const resetPwInput = document.getElementById('reset-password');

  toggleResetPw.addEventListener('click', () => {
    const isHidden = resetPwInput.type === 'password';
    resetPwInput.type = isHidden ? 'text' : 'password';
    resetPwIcon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });

  const toggleResetConfirmPw = document.getElementById(
    'toggle-reset-confirm-pw',
  );
  const resetConfirmPwIcon = document.getElementById('reset-confirm-pw-icon');
  const resetConfirmPwInput = document.getElementById('reset-confirm-password');

  toggleResetConfirmPw.addEventListener('click', () => {
    const isHidden = resetConfirmPwInput.type === 'password';
    resetConfirmPwInput.type = isHidden ? 'text' : 'password';
    resetConfirmPwIcon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });

  function showForgotError(message) {
    const el = document.getElementById('forgot-form-error');
    el.classList.remove('hidden');
    el.classList.add('flex');
    document.getElementById('forgot-form-error-text').textContent = message;
  }

  function hideForgotError() {
    const el = document.getElementById('forgot-form-error');
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  function showResetError(message) {
    const el = document.getElementById('reset-form-error');
    el.classList.remove('hidden');
    el.classList.add('flex');
    document.getElementById('reset-form-error-text').textContent = message;
  }

  function hideResetError() {
    const el = document.getElementById('reset-form-error');
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  function showForgotFieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
    el.querySelector('span').textContent = message;
  }

  function clearForgotFieldError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  document.getElementById('forgot-email').addEventListener('input', () => {
    clearForgotFieldError('error-forgot-email');
    hideForgotError();
  });

  document.getElementById('reset-otp').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-verify-otp').click();
  });
  document.getElementById('forgot-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-send-otp').click();
  });

  ['reset-otp', 'reset-password', 'reset-confirm-password'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      clearForgotFieldError(`error-${id}`);
      hideResetError();
    });
  });

  let resendTimer = null;

  function startResendCooldown() {
    const btn = document.getElementById('btn-resend-otp');
    const countdown = document.getElementById('resend-countdown');
    let seconds = 60;
    btn.disabled = true;
    countdown.classList.remove('hidden');
    countdown.textContent = `(${seconds}s)`;
    resendTimer = setInterval(() => {
      seconds--;
      countdown.textContent = `(${seconds}s)`;
      if (seconds <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        countdown.classList.add('hidden');
      }
    }, 1000);
  }

  async function sendOtp(email) {
    const res = await fetch('/api/customer/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  }

  document
    .getElementById('btn-send-otp')
    .addEventListener('click', async () => {
      hideForgotError();
      const email = document.getElementById('forgot-email').value.trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showForgotFieldError(
          'error-forgot-email',
          !email ? 'Email is required.' : 'Enter a valid email address.',
        );
        return;
      }

      const btn = document.getElementById('btn-send-otp');
      const icon = document.getElementById('send-otp-icon');
      const text = document.getElementById('send-otp-text');
      btn.disabled = true;
      icon.className = 'ph ph-spinner animate-spin text-base';
      text.textContent = 'Sending...';

      try {
        const json = await sendOtp(email);
        if (json.success) {
          forgotEmail = email;
          showSection(sectionReset);
          startResendCooldown();
        } else {
          showForgotError(
            json.message || 'Could not send reset code. Please try again.',
          );
        }
      } catch {
        showForgotError('Something went wrong. Please try again.');
      } finally {
        btn.disabled = false;
        icon.className = 'ph ph-paper-plane-tilt text-base';
        text.textContent = 'Send Reset Code';
      }
    });

  document
    .getElementById('btn-resend-otp')
    .addEventListener('click', async () => {
      hideResetError();
      try {
        const json = await sendOtp(forgotEmail);
        if (json.success) {
          startResendCooldown();
        } else {
          showResetError(
            json.message || 'Could not resend code. Please try again.',
          );
        }
      } catch {
        showResetError('Something went wrong. Please try again.');
      }
    });

  document
    .getElementById('btn-verify-otp')
    .addEventListener('click', async () => {
      hideResetError();

      const otp = document.getElementById('reset-otp').value.trim();

      if (!otp || !/^\d{6}$/.test(otp)) {
        showForgotFieldError(
          'error-reset-otp',
          !otp
            ? 'Reset code is required.'
            : 'Enter the 6-digit code from your email.',
        );
        return;
      }

      const btn = document.getElementById('btn-verify-otp');
      const icon = document.getElementById('verify-otp-icon');
      const text = document.getElementById('verify-otp-text');
      btn.disabled = true;
      icon.className = 'ph ph-spinner animate-spin text-base';
      text.textContent = 'Verifying...';

      try {
        const res = await fetch('/api/customer/password/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail, otp }),
        });
        const json = await res.json();
        if (json.success) {
          btn.classList.add('hidden');
          document.getElementById('reset-otp').disabled = true;
          const fields = document.getElementById('new-password-fields');
          fields.classList.remove('hidden');
          fields.classList.add('flex');
        } else {
          showResetError(json.message || 'Invalid or expired code.');
        }
      } catch {
        showResetError('Something went wrong. Please try again.');
      } finally {
        btn.disabled = false;
        icon.className = 'ph ph-shield-check text-base';
        text.textContent = 'Verify Code';
      }
    });

  document
    .getElementById('btn-reset-password')
    .addEventListener('click', async () => {
      hideResetError();

      const otp = document.getElementById('reset-otp').value.trim();
      const password = document.getElementById('reset-password').value;
      const confirmPassword = document.getElementById(
        'reset-confirm-password',
      ).value;
      let valid = true;

      if (!otp || !/^\d{6}$/.test(otp)) {
        showForgotFieldError(
          'error-reset-otp',
          !otp
            ? 'Reset code is required.'
            : 'Enter the 6-digit code from your email.',
        );
        valid = false;
      } else clearForgotFieldError('error-reset-otp');

      if (!password || password.length < 8) {
        showForgotFieldError(
          'error-reset-password',
          !password
            ? 'Password is required.'
            : 'Password must be at least 8 characters.',
        );
        valid = false;
      } else clearForgotFieldError('error-reset-password');

      if (!confirmPassword) {
        showForgotFieldError(
          'error-reset-confirm-password',
          'Please confirm your password.',
        );
        valid = false;
      } else if (confirmPassword !== password) {
        showForgotFieldError(
          'error-reset-confirm-password',
          'Passwords do not match.',
        );
        valid = false;
      } else clearForgotFieldError('error-reset-confirm-password');

      if (!valid) return;

      const btn = document.getElementById('btn-reset-password');
      const icon = document.getElementById('reset-btn-icon');
      const text = document.getElementById('reset-btn-text');
      btn.disabled = true;
      icon.className = 'ph ph-spinner animate-spin text-base';
      text.textContent = 'Resetting...';

      try {
        const res = await fetch('/api/customer/password/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail, otp, password }),
        });
        const json = await res.json();
        if (json.success) {
          showSection(sectionLogin);
          const el = document.getElementById('form-error');
          el.classList.remove(
            'hidden',
            'border-red-500/20',
            'bg-red-500/10',
            'text-red-400',
          );
          el.classList.add(
            'flex',
            'border-green-500/20',
            'bg-green-500/10',
            'text-green-400',
          );
          document.getElementById('form-error-text').textContent =
            'Password reset successfully. You can now sign in.';
        } else {
          showResetError(
            json.message || 'Could not reset password. Please try again.',
          );
        }
      } catch {
        showResetError('Something went wrong. Please try again.');
      } finally {
        btn.disabled = false;
        icon.className = 'ph ph-check text-base';
        text.textContent = 'Reset Password';
      }
    });
}

// MOTION
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
const canAnimate = typeof gsap !== 'undefined' && !reduceMotion;
let activeView = document.querySelector('.auth-view:not(.hidden)');
let switching = false;

function wrapWord(html) {
  return `<span class="auth-word" aria-hidden="true"><span>${html}</span></span>`;
}

function splitWords(el) {
  const parts = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => parts.push(wrapWord(w)));
    } else {
      parts.push(wrapWord(node.outerHTML));
    }
  });
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = parts.join(' ');
}

function shakeEl(el) {
  if (!canAnimate || !el) return;
  gsap.fromTo(
    el,
    { x: -8 },
    {
      x: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)',
      clearProps: 'transform',
    },
  );
}

function enterView(view) {
  if (!canAnimate) return;
  const rest = Array.from(view.children).filter(
    (c) => !c.classList.contains('auth-title'),
  );
  gsap.fromTo(
    view.querySelectorAll('.auth-title .auth-word > span'),
    { yPercent: 110 },
    { yPercent: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' },
  );
  gsap.fromTo(
    rest,
    { y: 16, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.5,
      stagger: 0.07,
      delay: 0.1,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    },
  );
}

function showView(next) {
  const prev = activeView;
  if (!next || next === prev || switching) return;

  const swap = () => {
    prev.classList.add('hidden');
    next.classList.remove('hidden');
    activeView = next;
    enterView(next);
    if (window.matchMedia('(hover: hover)').matches) {
      next.querySelector('input')?.focus({ preventScroll: true });
    }
    switching = false;
  };

  if (!canAnimate) return swap();

  switching = true;
  gsap.to(prev, {
    opacity: 0,
    y: -10,
    duration: 0.2,
    ease: 'power1.in',
    onComplete: () => {
      swap();
      gsap.set(prev, { clearProps: 'opacity,transform' });
    },
  });
}

if (canAnimate) {
  document.querySelectorAll('[data-split]').forEach(splitWords);

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.fromTo(
    '.auth-hero h2 .auth-word > span',
    { yPercent: 110 },
    { yPercent: 0, duration: 0.7, stagger: 0.08 },
    0,
  )
    .fromTo(
      '.auth-hero p, .auth-chips span',
      { y: 14, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.06,
        clearProps: 'transform,opacity',
      },
      0.35,
    )
    .fromTo(
      '#auth-sweep',
      { xPercent: 0 },
      { xPercent: 450, duration: 1.4, ease: 'power2.inOut' },
      0.1,
    )
    .fromTo(
      '#auth-sheet',
      { y: 36, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, clearProps: 'transform,opacity' },
      0.2,
    );

  gsap.delayedCall(0.35, () => enterView(activeView));
}

// EMAIL CODE STEP
const verifyView = document.getElementById('section-verify');
const verifyCode = document.getElementById('verify-code');
const resendBtn = document.getElementById('btn-resend-code');
const resendCount = document.getElementById('resend-code-count');
let verifyEmail = '';
let verifyTimer = null;

function setVerifyError(message) {
  const field = document.getElementById('error-verify-code');
  field.querySelector('span').textContent = message;
  field.classList.remove('hidden');
  field.classList.add('flex');
  verifyCode.classList.add('is-error');
  shakeEl(verifyCode);
}

function showVerifyFormError(message) {
  const el = document.getElementById('verify-form-error');
  el.classList.remove('hidden');
  el.classList.add('flex');
  document.getElementById('verify-form-error-text').textContent = message;
}

function showVerifyNote(message) {
  const el = document.getElementById('verify-note');
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearVerifyErrors() {
  const field = document.getElementById('error-verify-code');
  field.classList.add('hidden');
  field.classList.remove('flex');
  verifyCode.classList.remove('is-error');
  const form = document.getElementById('verify-form-error');
  form.classList.add('hidden');
  form.classList.remove('flex');
  document.getElementById('verify-note').classList.add('hidden');
}

function startVerifyCooldown(seconds) {
  clearInterval(verifyTimer);
  let left = seconds;
  resendBtn.disabled = true;
  const tick = () => {
    if (left <= 0) {
      clearInterval(verifyTimer);
      resendBtn.disabled = false;
      resendCount.textContent = '';
      return;
    }
    resendCount.textContent = `(${left}s)`;
    left--;
  };
  tick();
  verifyTimer = setInterval(tick, 1000);
}

function openVerify(email) {
  verifyEmail = email;
  document.getElementById('verify-email-text').textContent = email;
  verifyCode.value = '';
  clearVerifyErrors();
  startVerifyCooldown(60);
  showView(verifyView);
}

verifyCode.addEventListener('input', () => {
  verifyCode.value = verifyCode.value.replace(/[^0-9]/g, '');
  clearVerifyErrors();
});

verifyCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-verify').click();
});

document.getElementById('btn-verify-back').addEventListener('click', () => {
  clearInterval(verifyTimer);
  showView(
    document.getElementById(isLoginPage ? 'section-login' : 'section-register'),
  );
});

document.getElementById('btn-verify').addEventListener('click', async () => {
  clearVerifyErrors();
  const otp = verifyCode.value.trim();

  if (!/^\d{6}$/.test(otp)) {
    setVerifyError('Enter the 6 digit code from your email.');
    return;
  }

  const btn = document.getElementById('btn-verify');
  const icon = document.getElementById('verify-btn-icon');
  const text = document.getElementById('verify-btn-text');
  btn.disabled = true;
  icon.className = 'ph ph-spinner animate-spin text-base';
  text.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/customer/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifyEmail, otp }),
    });
    const json = await res.json();
    if (json.success) {
      window.location.href = json.redirect || '/customer/account';
      return;
    }
    setVerifyError(json.message || 'Could not verify. Please try again.');
  } catch {
    showVerifyFormError('Something went wrong. Please try again.');
  }

  btn.disabled = false;
  icon.className = 'ph ph-shield-check text-base';
  text.textContent = 'Verify and Continue';
});

resendBtn.addEventListener('click', async () => {
  clearVerifyErrors();
  resendBtn.disabled = true;

  try {
    const res = await fetch('/api/customer/register/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifyEmail }),
    });
    const json = await res.json();
    if (json.success) {
      verifyCode.value = '';
      showVerifyNote(json.message);
      startVerifyCooldown(60);
      return;
    }
    if (res.status === 429 && json.retryAfter) {
      startVerifyCooldown(json.retryAfter);
      return;
    }
    showVerifyFormError(json.message || 'Could not resend. Please try again.');
  } catch {
    showVerifyFormError('Something went wrong. Please try again.');
  }

  resendBtn.disabled = false;
});

const resetOtpInput = document.getElementById('reset-otp');
if (resetOtpInput) {
  resetOtpInput.addEventListener('input', () => {
    resetOtpInput.value = resetOtpInput.value.replace(/[^0-9]/g, '');
  });
}
