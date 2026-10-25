const pool = require('../../config/database');

module.exports = async function singleSession(req, res, next) {
  const u = req.session?.user;
  if (!u) return next();

  try {
    const r = await pool.query(
      'SELECT active_session_id FROM users WHERE id = $1',
      [u.id]
    );

    if (!r.rows[0] || r.rows[0].active_session_id !== req.sessionID) {
      return req.session.destroy(() =>
        res.status(401).json({ success: false, message: 'Session ended.' })
      );
    }

    next();
  } catch (e) {
    next(e);
  }
};