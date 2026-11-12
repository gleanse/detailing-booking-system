// ACCOUNT CONTROLLER
const path = require('path');
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const { sendEmailVerificationEmail } = require('../../shared/utils/email');
const { issueOtp, checkOtp, OTP_MESSAGES } = require('./security/otp');
const { revokeSessions } = require('./security/sessions');
const {
  getBookingsByUserId,
  getBookingByReferenceCode,
  updateUserEmail,
  getLastBookingByUserId,
} = require('./account.queries');

const getAccountPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'account.html'));
};

const getBookingsPage = (req, res) => {
  res.sendFile(path.join(__dirname, 'bookings.html'));
};

const getBookings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bookings = await getBookingsByUserId(userId);
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const getBooking = async (req, res) => {
  try {
    const { referenceCode } = req.params;
    const userId = req.session.user.id;
    const booking = await getBookingByReferenceCode(referenceCode, userId);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found.' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, phone } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters.',
      });
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

    const result = await pool.query(
      `UPDATE users SET name = $1, phone = $2 WHERE id = $3
       RETURNING id, name, email, phone, role`,
      [name.trim(), phone.trim(), userId],
    );

    const user = result.rows[0];

    // update session with new details
    req.session.user = {
      ...req.session.user,
      name: user.name,
      phone: user.phone,
    };

    res.json({ success: true, message: 'Profile updated.', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const requestEmailChange = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is required.' });
    }

    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter a valid email address.' });
    }

    // check if already taken by another user
    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [normalized, userId],
    );
    if (existing.rows.length) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is already in use.' });
    }

    // check if same as current email
    if (normalized === req.session.user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This is already your current email.',
      });
    }

    const issued = await issueOtp({
      purpose: 'email_change',
      id: userId,
      payload: { newEmail: normalized },
      send: (otp) =>
        sendEmailVerificationEmail({
          email: normalized,
          name: req.session.user.name,
          otp,
        }),
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
      message: 'Verification code sent to your new email.',
    });
  } catch (err) {
    console.error('Request email change error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const verifyEmailChange = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otp } = req.body;

    if (!otp || !otp.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Verification code is required.' });
    }

    const check = await checkOtp({
      purpose: 'email_change',
      id: userId,
      otp: otp.trim(),
    });

    if (!check.ok) {
      return res
        .status(400)
        .json({ success: false, message: OTP_MESSAGES[check.reason] });
    }

    const user = await updateUserEmail(userId, check.payload.newEmail);

    req.session.user = {
      ...req.session.user,
      email: user.email,
    };

    res.json({ success: true, message: 'Email updated successfully.', user });
  } catch (err) {
    console.error('Verify email change error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const getLastBooking = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const booking = await getLastBookingByUserId(userId);
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Get last booking error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'All fields are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    const result = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId],
    );

    const user = result.rows[0];

    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password change is not available for this account.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [
      hashed,
      userId,
    ]);

    await revokeSessions(userId, req.sessionID);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

module.exports = {
  getAccountPage,
  getBookingsPage,
  getBookings,
  getBooking,
  updateProfile,
  requestEmailChange,
  verifyEmailChange,
  getLastBooking,
  changePassword,
};
