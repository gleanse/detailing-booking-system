// CONTROLLER OF CUSTOMER AUTH
const path = require('path');
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const redis = require('../../config/redis');
const { sendPasswordResetEmail } = require('../../shared/utils/email');

const getLoginPage = (req, res) => {
  // redirect to account if already logged in as customer
  if (req.session?.user?.role === 'customer') {
    return res.redirect('/customer/account');
  }
  res.sendFile(path.join(__dirname, '../views/login.html'));
};

const getRegisterPage = (req, res) => {
  if (req.session?.user?.role === 'customer') {
    return res.redirect('/customer/account');
  }
  res.sendFile(path.join(__dirname, '../views/register.html'));
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

    // check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, name, email, phone, role`,
      [name.trim(), email.toLowerCase(), phone.trim(), hashedPassword],
    );

    const user = result.rows[0];

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    res.json({
      success: true,
      message: 'Account created successfully.',
      redirect: '/customer/account',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Customer register error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT id, name, email, phone, password, role FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (user.role !== 'customer') {
      return res
        .status(403)
        .json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    // remember me: 30 days, otherwise 8 hours
    req.session.cookie.maxAge = rememberMe
      ? 1000 * 60 * 60 * 24 * 30
      : 1000 * 60 * 60 * 8;

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
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

const logout = (req, res) => {
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

    const storedOtp = await redis.get(`pw_reset:${email.toLowerCase()}`);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.',
      });
    }

    if (String(storedOtp) !== String(otp)) {
      return res
        .status(400)
        .json({ success: false, message: 'Incorrect reset code.' });
    }
    res.json({ success: true, message: 'Code verified.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
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

    const otp = crypto.randomInt(100000, 999999).toString();

    // key: pw_reset:<email>, TTL: 10 minutes
    await redis.set(`pw_reset:${user.email}`, otp, 'EX', 600);

    await sendPasswordResetEmail({ email: user.email, name: user.name, otp });

    res.json({
      success: true,
      message: 'If that email exists, a reset code has been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
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

    const storedOtp = await redis.get(`pw_reset:${email.toLowerCase()}`);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.',
      });
    }

    if (String(storedOtp) !== String(otp)) {
      return res
        .status(400)
        .json({ success: false, message: 'Incorrect reset code.' });
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

    // delete OTP immediately after successful reset so it can't be reused
    await redis.del(`pw_reset:${email.toLowerCase()}`);

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
};

module.exports = {
  getLoginPage,
  getRegisterPage,
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
