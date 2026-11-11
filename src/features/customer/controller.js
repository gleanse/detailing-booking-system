// CONTROLLER OF CUSTOMER AUTH
const path = require('path');
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const { sendPasswordResetEmail } = require('../../shared/utils/email');
const { issueCode, checkCode } = require('./signup-verify');
const { issueOtp, checkOtp, OTP_MESSAGES } = require('./security/otp');
const {
  checkLoginBlock,
  recordLoginFailure,
  clearLoginFailures,
} = require('./security/login-limiter');
const {
  startSession,
  endSession,
  revokeSessions,
} = require('./security/sessions');

const getLoginPage = (req, res) => {
  // redirect to account if already logged in as customer
  if (req.session?.user?.role === 'customer') {
    return res.redirect('/customer/account');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
};

const getRegisterPage = (req, res) => {
  if (req.session?.user?.role === 'customer') {
    return res.redirect('/customer/account');
  }
  res.sendFile(path.join(__dirname, 'register.html'));
};

const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters.',
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter a valid email address.' });
    }

    if (!phone || !phone.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Phone number is required.' });
    }

    if (!/^09\d{9}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid PH number (09XXXXXXXXX).',
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    const normalized = email.trim().toLowerCase();

    const existing = await pool.query(
      'SELECT id, role, email_verified FROM users WHERE email = $1',
      [normalized],
    );
    const found = existing.rows[0];

    if (found && (found.email_verified || found.role !== 'customer')) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // an unverified account is only a pending sign up, so signing up again replaces it
    if (found) {
      await pool.query(
        `UPDATE users SET name = $1, phone = $2, password = $3 WHERE id = $4`,
        [name.trim(), phone.trim(), hashedPassword, found.id],
      );
    } else {
      await pool.query(
        `INSERT INTO users (name, email, phone, password, role)
         VALUES ($1, $2, $3, $4, 'customer')`,
        [name.trim(), normalized, phone.trim(), hashedPassword],
      );
    }

    await issueCode({ email: normalized, name: name.trim() });

    res.json({
      success: true,
      verify: true,
      email: normalized,
      message: 'We sent a 6 digit code to your email.',
    });
  } catch (err) {
    console.error('Customer register error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const rejectLogin = async (res, status, { email, ip }) => {
  const failure = await recordLoginFailure({ email, ip });

  if (failure.locked) {
    return res.status(429).json({
      success: false,
      retryAfter: failure.retryAfter,
      message: failure.pairLocked
        ? `Invalid email or password. You've used all ${failure.limit} attempts, so login is locked.`
        : 'Too many failed login attempts.',
    });
  }

  const left = failure.attemptsLeft;
  const message =
    left !== null && left <= 2
      ? `Invalid email or password. ${left} ${left === 1 ? 'attempt' : 'attempts'} left before login is locked for 15 minutes.`
      : 'Invalid email or password.';

  return res.status(status).json({ success: false, message });
};

const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    const ip = req.ip;

    const block = await checkLoginBlock({ email: normalizedEmail, ip });
    if (block.blocked) {
      return res.status(429).json({
        success: false,
        retryAfter: block.retryAfter,
        message: 'Too many failed login attempts.',
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, phone, password, role, email_verified FROM users WHERE email = $1',
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return rejectLogin(res, 401, { email: normalizedEmail, ip });
    }

    const user = result.rows[0];

    if (user.role !== 'customer') {
      return rejectLogin(res, 403, { email: normalizedEmail, ip });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return rejectLogin(res, 401, { email: normalizedEmail, ip });
    }

    await clearLoginFailures({ email: normalizedEmail, ip });

    if (!user.email_verified) {
      await issueCode({ email: user.email, name: user.name });
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email: user.email,
        message: 'Please verify your email first. We sent you a new code.',
      });
    }

    await startSession(req, user, rememberMe);

    res.json({
      success: true,
      message: 'Login successful.',
      redirect: '/customer/account',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const logout = async (req, res) => {
  await endSession(req);
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: 'Logout failed.' });
    }
    res.json({ success: true, redirect: '/customer/login' });
  });
};

const getMe = (req, res) => {
  if (!req.session?.user) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authenticated.' });
  }
  res.json({ success: true, user: req.session.user });
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and code are required.' });
    }

    const check = await checkOtp({
      purpose: 'pw_reset',
      id: String(email).trim().toLowerCase(),
      otp: String(otp).trim(),
      consume: false,
    });

    if (!check.ok) {
      return res
        .status(400)
        .json({ success: false, message: OTP_MESSAGES[check.reason] });
    }

    res.json({ success: true, message: 'Code verified.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter a valid email address.' });
    }

    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'customer') {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address.',
      });
    }

    const user = result.rows[0];

    const issued = await issueOtp({
      purpose: 'pw_reset',
      id: user.email,
      send: (otp) =>
        sendPasswordResetEmail({ email: user.email, name: user.name, otp }),
    });

    if (!issued.sent) {
      return res.status(429).json({
        success: false,
        retryAfter: issued.retryAfter,
        message: `Please wait ${issued.retryAfter} seconds before asking for a new code.`,
      });
    }

    res.json({
      success: true,
      message: 'A reset code has been sent to your email.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required.',
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Enter the 6-digit code from your email.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    const check = await checkOtp({
      purpose: 'pw_reset',
      id: String(email).trim().toLowerCase(),
      otp,
    });

    if (!check.ok) {
      return res
        .status(400)
        .json({ success: false, message: OTP_MESSAGES[check.reason] });
    }

    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [email.toLowerCase(), 'customer'],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Account not found.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('UPDATE users SET password = $1 WHERE email = $2', [
      hashedPassword,
      email.toLowerCase(),
    ]);

    await revokeSessions(result.rows[0].id);

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const codeProblem = {
  expired: 'This code has expired. Please request a new one.',
  locked: 'Too many wrong codes. Please request a new one.',
  wrong: 'Incorrect code. Please try again.',
};

const findPendingCustomer = async (email) => {
  const result = await pool.query(
    `SELECT id, name, email, phone, role FROM users
     WHERE email = $1 AND role = 'customer' AND email_verified = false`,
    [email],
  );
  return result.rows[0] || null;
};

const verifySignup = async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter the 6 digit code.' });
    }

    const user = await findPendingCustomer(email);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This email has nothing to verify. Please sign in.',
      });
    }

    const check = await checkCode({ email, otp });
    if (!check.ok) {
      return res
        .status(400)
        .json({ success: false, message: codeProblem[check.reason] });
    }

    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [
      user.id,
    ]);

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    res.json({
      success: true,
      message: 'Email verified.',
      redirect: '/customer/account',
    });
  } catch (err) {
    console.error('Verify signup error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const resendSignupCode = async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const user = email ? await findPendingCustomer(email) : null;
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This email has nothing to verify. Please sign in.',
      });
    }

    const result = await issueCode({ email, name: user.name });
    if (!result.sent) {
      return res.status(429).json({
        success: false,
        retryAfter: result.retryAfter,
        message: `Please wait ${result.retryAfter} seconds before asking for a new code.`,
      });
    }

    res.json({ success: true, message: 'A new code was sent to your email.' });
  } catch (err) {
    console.error('Resend signup code error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

module.exports = {
  getLoginPage,
  getRegisterPage,
  register,
  verifySignup,
  resendSignupCode,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
