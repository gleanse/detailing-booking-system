const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const path = require('path');
const { checkLoginBlock, recordFailedAttempt, clearLoginAttempts } = require('../../shared/utils/rateLimiter');
const redis = require('../../config/redis');

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// STATIC assets
router.get('/auth.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.js'));
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, force } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const ip = req.ip;

    // check if blocked (rate limit)
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
      await recordFailedAttempt(normalizedEmail);
      await recordFailedAttempt(ip);
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
      await recordFailedAttempt(normalizedEmail);
      await recordFailedAttempt(ip);
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password' });
    }

    // single-session: i-claim ang account
    const maxAge = req.session.cookie.maxAge || 1000 * 60 * 60 * 2;
    const expires = new Date(Date.now() + maxAge);

    let claimed = false;

    if (force === true) {
      // pinili ng user na i-logout ang kabilang device
      const old = await pool.query(
        'SELECT active_session_id FROM users WHERE id = $1',
        [user.id]
      );
      const oldSid = old.rows[0]?.active_session_id;

      await pool.query(
        `UPDATE users
            SET active_session_id = $1, active_session_expires = $2
          WHERE id = $3`,
        [req.sessionID, expires, user.id]
      );

      if (oldSid && oldSid !== req.sessionID) {
        try {
          await redis.del(`sess:${oldSid}`);
        } catch (e) {
          console.error('Failed to remove old session:', e);
        }
      }
      claimed = true;
    } else {
      const claim = await pool.query(
        `UPDATE users
            SET active_session_id = $1, active_session_expires = $2
          WHERE id = $3
            AND (active_session_id IS NULL
                 OR active_session_id = $1
                 OR active_session_expires < NOW())
          RETURNING id`,
        [req.sessionID, expires, user.id]
      );
      claimed = claim.rowCount > 0;
    }

    if (!claimed) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_LOGGED_IN',
        message: 'This account is already logged in on another device.',
      });
    }

    // successful login: clear failed attempts
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

router.post('/logout', async (req, res) => {
  const userId = req.session?.user?.id;

  try {
    if (userId) {
      await pool.query(
        `UPDATE users
            SET active_session_id = NULL, active_session_expires = NULL
          WHERE id = $1 AND active_session_id = $2`,
        [userId, req.sessionID]
      );
    }
  } catch (e) {
    console.error('Logout cleanup error:', e);
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out' });
  });
});

module.exports = router;