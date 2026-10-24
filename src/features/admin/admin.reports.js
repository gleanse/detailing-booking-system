const express = require('express');
const router = express.Router();
const db = require('../../config/db'); // pg Pool, ayusin kung iba ang file name sa src/config

// Petsa ng booking: availability.date, o created_at kung walang availability (hal. walk-in)
const BASE = `
  FROM bookings b
  LEFT JOIN availability a ON a.id = b.availability_id
  WHERE COALESCE(a.date, b.created_at::date) BETWEEN CURRENT_DATE - $1::int AND CURRENT_DATE
`;

router.get('/summary', async (req, res) => {
  const days = Number(req.query.days) === 30 ? 30 : 7;
  const span = days - 1;

  try {
    // 1) Bookings trend
    const trendQ = await db.query(
      `SELECT TO_CHAR(COALESCE(a.date, b.created_at::date), 'YYYY-MM-DD') AS date, COUNT(*) AS count
       ${BASE}
       GROUP BY 1
       ORDER BY 1`,
      [span]
    );

    // Punan ang mga araw na walang booking
    const trendMap = new Map(trendQ.rows.map(r => [r.date, Number(r.count)]));
    const trend = [];
    for (let i = span; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
      trend.push({ date: key, count: trendMap.get(key) || 0 });
    }

    // 2) Status breakdown (expired kung booking_status = 'expired')
    const statusQ = await db.query(
      `SELECT CASE WHEN b.booking_status = 'expired' THEN 'expired' ELSE b.status END AS status,
              COUNT(*) AS count
       ${BASE}
       GROUP BY 1
       ORDER BY COUNT(*) DESC`,
      [span]
    );

    // 3) Top 5 services (hindi kasama ang expired)
    const servicesQ = await db.query(
      `SELECT s.name AS service_name, COUNT(*) AS count
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       LEFT JOIN availability a ON a.id = b.availability_id
       WHERE COALESCE(a.date, b.created_at::date) BETWEEN CURRENT_DATE - $1::int AND CURRENT_DATE
         AND b.booking_status <> 'expired'
       GROUP BY s.id, s.name
       ORDER BY COUNT(*) DESC
       LIMIT 5`,
      [span]
    );

    res.json({
      success: true,
      data: {
        trend,
        status:   statusQ.rows.map(r => ({ status: r.status, count: Number(r.count) })),
        services: servicesQ.rows.map(r => ({ service_name: r.service_name, count: Number(r.count) })),
      },
    });
  } catch (err) {
    console.error('Reports summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load reports' });
  }
});

module.exports = router;