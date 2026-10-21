const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const path = require('path');
const { checkLoginBlock, recordFailedAttempt, clearLoginAttempts } = require('../../shared/utils/rateLimiter');

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// STATIC assets
router.get('/auth.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.js'));
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const ip = req.ip;

    // ── ITO YUNG DINAGDAG: suriin muna kung naka-block ──
    const emailBlock = await checkLoginBlock(normalizedEmail);
    const ipBlock    = await checkLoginBlock(ip);

    if (emailBlock.blocked || ipBlock.blocked) {
      const retryAfter = Math.max(emailBlock.retryAfterSeconds, ipBlock.retryAfterSeconds);
      const minutes = Math.ceil(retryAfter / 60);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${minutes} minute(s).`,
      });
    }

    // find user
    const result = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      await recordFailedAttempt(normalizedEmail); // ← dagdag
      await recordFailedAttempt(ip);               // ← dagdag
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // only admin and staff can login here
    if (!['admin', 'staff'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordFailedAttempt(normalizedEmail); // ← dagdag
      await recordFailedAttempt(ip);               // ← dagdag
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password' });
    }

    // ── ITO YUNG DINAGDAG: i-clear ang attempts pag successful ──
    await clearLoginAttempts(normalizedEmail);
    await clearLoginAttempts(ip);

    // save session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.json({
      success: true,
      message: 'Login successful',
      redirect: user.role === 'admin' ? '/admin' : '/staff',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Server error: ' + err.message });
  }
});

router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authenticated' });
  }
  res.json({ success: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out' });
  });
});

module.exports = router;
