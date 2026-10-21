// admin.routes.js - JSON API ONLY (used by apiRouter)
const express = require('express');
const bcrypt = require('bcrypt');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const pool    = require('../../config/database');

const PUBLIC_DIR  = path.join(__dirname, '..', '..', '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads', 'services');

// Safely create uploads folder
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('[admin] Created uploads dir:', UPLOADS_DIR);
  }
} catch (e) {
  console.warn('[admin] Could not create uploads dir:', e.message);
}

//  Save base64 image to disk 
function saveBase64Image(base64String, oldImageUrl) {
  try {
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const data     = matches[2];

    // Validation - image files lang
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Images only (JPEG, PNG, WEBP, GIF).`);
    }

    const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `svc_${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

    if (oldImageUrl && oldImageUrl.startsWith('/uploads/services/')) {
      const oldPath = path.join(PUBLIC_DIR, oldImageUrl);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }

    return `/uploads/services/${filename}`;
  } catch (e) {
    console.error('[admin] saveBase64Image error:', e.message);
    throw e; // ← importante - i-throw para ma-catch ng route
  }
}

router.get('/bookings/by-date', async (req, res) => {
  try {
    const { date, service_id } = req.query;
    if (!date || !service_id) {
      return res.status(400).json({ success: false, message: 'date and service_id are required' });
    }

    const result = await pool.query(
      `SELECT
         b.id, b.reference_code, b.status, b.booking_status, b.queue_number,
         b.guest_name, b.guest_email, b.guest_phone,
         a.date AS booking_date,
         s.name  AS service_name,
         sv.name AS variant_name
       FROM bookings b
       LEFT JOIN availability a      ON a.id  = b.availability_id
       LEFT JOIN services s          ON s.id  = b.service_id
       LEFT JOIN service_variants sv ON sv.id = b.variant_id
       WHERE a.date       = $1
         AND b.service_id = $2
         AND b.booking_status = 'confirmed'
         AND b.status NOT IN ('cancelled', 'picked_up')
       ORDER BY b.queue_number ASC NULLS LAST`,
      [date, service_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /bookings/by-date error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/stats/today
router.get('/stats/today', async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE b.booking_status = 'confirmed') AS total,
    COUNT(*) FILTER (WHERE b.status = 'pending' AND b.booking_status = 'confirmed') AS pending,
    COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE b.status IN ('done', 'picked_up')) AS done
  FROM bookings b
  LEFT JOIN availability a ON a.id = b.availability_id
  WHERE b.booking_status = 'confirmed'
    AND (
      DATE(a.date) = CURRENT_DATE
      OR (b.availability_id IS NULL AND DATE(b.created_at) = CURRENT_DATE)
    )
`);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/bookings/today
router.get('/bookings/today', async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT b.id, b.reference_code, b.guest_name, b.guest_email,
         b.status, b.booking_status, b.payment_method, b.is_walkin,
         a.date AS booking_date, s.name AS service_name, sv.name AS variant_name
  FROM bookings b
  LEFT JOIN availability a      ON a.id  = b.availability_id
  LEFT JOIN services s          ON s.id  = b.service_id
  LEFT JOIN service_variants sv ON sv.id = b.variant_id
  WHERE b.booking_status = 'confirmed'
    AND (
      DATE(a.date) = CURRENT_DATE
      OR (b.availability_id IS NULL AND DATE(b.created_at) = CURRENT_DATE)
    )
  ORDER BY b.created_at DESC
`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/bookings/pickup-pending
router.get('/bookings/pickup-pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.reference_code, b.guest_name, b.status,
             s.name AS service_name, p.is_fully_paid, p.remaining_balance
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.status = 'done' AND b.booking_status = 'confirmed'
      ORDER BY b.updated_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT b.id, b.reference_code, b.guest_name, b.guest_email,
             b.status, b.booking_status, b.payment_method, b.is_walkin,
             a.date AS booking_date, s.name AS service_name,
             sv.name AS variant_name, sv.price AS variant_price
      FROM bookings b
      LEFT JOIN availability a      ON a.id  = b.availability_id
      LEFT JOIN services s          ON s.id  = b.service_id
      LEFT JOIN service_variants sv ON sv.id = b.variant_id
      WHERE b.booking_status = 'confirmed'
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND b.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (b.reference_code ILIKE $${params.length} OR b.guest_name ILIKE $${params.length} OR b.guest_email ILIKE $${params.length})`;
    }
    query += ` ORDER BY b.created_at DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/bookings/:id/status
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = ['confirmed', 'in_progress', 'done', 'picked_up', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    // Fetch current booking (need email, name, ref for notification)
   const current = await pool.query(
  `SELECT b.id, b.status, b.reference_code,
          b.guest_name, b.guest_email, b.queue_number,
          a.date AS booking_date,
          s.name AS service_name, sv.name AS variant_name
   FROM bookings b
   LEFT JOIN availability a ON a.id = b.availability_id
   LEFT JOIN services s ON s.id = b.service_id
   LEFT JOIN service_variants sv ON sv.id = b.variant_id
   WHERE b.id = $1`,
  [id]
);

    if (!current.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = current.rows[0];

    // Update status
    await pool.query(
      `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, $2, 'bookings', $3, $4)`,
      [
        req.session?.user?.id || null,
        `Status updated: ${booking.status} → ${status}`,
        id,
        `Ref: ${booking.reference_code}`,
      ]
    );

    // Send "Done" email notification 
    if (status === 'done' && booking.guest_email) {
      try {
        const { sendEmail } = require('../../config/email');
        const dateDisp = new Date(booking.booking_date + 'T00:00:00')
          .toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        await sendEmail({
          to:      booking.guest_email,
          subject: `Your Motorcycle is Ready for Pickup! - Ref ${booking.reference_code}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
              <h2 style="color:#dc2626;">Herco Detailing Garage</h2>
              <p>Hi <strong>${booking.guest_name}</strong>,</p>
              <p>Great news! Your motorcycle service is <strong style="color:#16a34a;">complete</strong> and ready for pickup.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700;">${booking.reference_code}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Service</td><td style="padding:8px;border:1px solid #e5e7eb;">${booking.service_name}${booking.variant_name ? ` - ${booking.variant_name}` : ''}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Date</td><td style="padding:8px;border:1px solid #e5e7eb;">${dateDisp}</td></tr>
              </table>
              <p>Please come to the garage to pick up your motorcycle at your earliest convenience.</p>
              <p style="color:#6b7280;font-size:13px;">- Herco Detailing Garage Team</p>
            </div>`,
        });
      } catch (emailErr) {
        console.error('Done email notification error:', emailErr);
        // Don't fail the status update - email is best-effort
      }
    }

    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    console.error('PATCH /bookings/:id/status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/bookings/walkin
router.post('/bookings/walkin', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      guest_name, guest_email, guest_phone,
      service_id, variant_id,
      booking_date,         // "YYYY-MM-DD" - galing sa frontend
      motorcycle_plate, motorcycle_color, motorcycle_model, motorcycle_description,
      payment_method = 'cash',
      is_future_date = false,
    } = req.body;

    if (!guest_name || !guest_phone || !service_id || !variant_id || !booking_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Find availability row for this date + service 
    // Ginagamit ang `availability` table (hindi availability_calendar)
    const avResult = await client.query(
      `SELECT a.id, a.capacity, a.is_open,
              COUNT(b.id) FILTER (WHERE b.booking_status IN ('locked','confirmed')) AS booked
       FROM availability a
       LEFT JOIN bookings b ON b.availability_id = a.id
       WHERE a.date = $1 AND a.service_id = $2 AND a.is_open = true
       GROUP BY a.id, a.capacity, a.is_open`,
      [booking_date, service_id]
    );

    if (!avResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No availability slot configured for this date and service.',
      });
    }

    const av        = avResult.rows[0];
    const booked    = parseInt(av.booked);
    const remaining = av.capacity - booked;

    if (remaining <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `This date is at full capacity (${booked}/${av.capacity}). Please select a future date.`,
      });
    }

    //  Next queue number for this availability slot 
    const queueResult = await client.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue
       FROM bookings
       WHERE availability_id = $1`,
      [av.id]
    );
    const queue_number = queueResult.rows[0].next_queue;

    // Generate reference code 
    const refCode = 'WI-' + Date.now().toString(36).toUpperCase().slice(-6) +
                    Math.random().toString(36).toUpperCase().slice(-3);

    //  Insert booking 
    // Ginagamit ang availability_id, at ang columns na nasa actual schema
    const insertResult = await client.query(
      `INSERT INTO bookings (
         reference_code,
         availability_id,
         service_id, variant_id,
         status, booking_status,
         queue_number,
         guest_name, guest_email, guest_phone,
         motorcycle_plate, motorcycle_color, motorcycle_model, motorcycle_description,
         payment_method,
         is_walkin
       ) VALUES (
         $1, $2, $3, $4,
         'pending', 'confirmed',
         $5,
         $6, $7, $8,
         $9, $10, $11, $12,
         $13,
         true
       ) RETURNING id, reference_code, queue_number`,
      [
        refCode,
        av.id,
        service_id, variant_id,
        queue_number,
        guest_name, guest_email || null, guest_phone,
        motorcycle_plate || null, motorcycle_color || null,
        motorcycle_model || null, motorcycle_description || null,
        payment_method,
      ]
    );

    await client.query('COMMIT');

    const booking = insertResult.rows[0];

    // Audit log 
    const staffId = req.session?.user?.id || null;
    if (staffId) {
      pool.query(
        `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'Walk-in booking created', 'bookings', $2, $3)`,
        [staffId, booking.id, `Walk-in Ref: ${booking.reference_code}`]
      ).catch(e => console.error('Audit log error:', e));
    }

    //  Optional: confirmation email 
    if (guest_email) {
      try {
        const { sendEmail } = require('../../config/email');
        const dateDisp = new Date(booking_date + 'T00:00:00')
          .toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        await sendEmail({
          to:      guest_email,
          subject: `Walk-in Booking Confirmed - Ref ${booking.reference_code}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
              <h2 style="color:#dc2626;">Herco Detailing Garage</h2>
              <p>Hi <strong>${guest_name}</strong>,</p>
              <p>Your walk-in booking has been confirmed${is_future_date ? ' for a future date' : ''}.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;font-weight:700;">${booking.reference_code}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Queue #</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;font-weight:700;">${booking.queue_number}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Date</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${dateDisp}</td></tr>
              </table>
              <p style="color:#6b7280;font-size:13px;">Please bring this reference number when you arrive.</p>
              <p style="color:#6b7280;font-size:13px;">- Herco Detailing Garage Team</p>
            </div>`,
        });
      } catch (emailErr) {
        console.error('Walk-in email error:', emailErr);
        // Hindi i-fail ang booking kahit may email error
      }
    }

    res.json({
      success:        true,
      booking_id:     booking.id,
      reference_code: booking.reference_code,
      queue_number:   booking.queue_number,
      message:        'Walk-in booking confirmed.',
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /bookings/walkin error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});


router.post('/bookings/reschedule', async (req, res) => {
  try {
    //  Admin-only 
    if (req.session?.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can reschedule bookings.' });
    }

    const { booking_ids, new_date, from_date, service_id, password } = req.body;

    if (!booking_ids?.length || !new_date || !password) {
      return res.status(400).json({
        success: false,
        message: 'booking_ids, new_date, and password are required.',
      });
    }

    //  Verify admin password 
    const userResult = await pool.query(
  `SELECT password FROM users WHERE id = $1`,
  [req.session.user.id]
);
    if (!userResult.rows.length) {
      return res.status(401).json({ success: false, message: 'Session invalid. Please log in again.' });
    }
    const passwordMatch = await bcrypt.compare(password, userResult.rows[0].password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    //  Find availability row for new_date + service 
    const avResult = await pool.query(
      `SELECT a.id, a.capacity, a.is_open,
              COUNT(b.id) FILTER (WHERE b.booking_status IN ('locked','confirmed')) AS booked
       FROM availability a
       LEFT JOIN bookings b ON b.availability_id = a.id
       WHERE a.date = $1 AND a.service_id = $2 AND a.is_open = true
       GROUP BY a.id, a.capacity, a.is_open`,
      [new_date, service_id]
    );

    if (!avResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'No availability slot configured for the new date and service.',
      });
    }

    const av        = avResult.rows[0];
    const booked    = parseInt(av.booked);
    const available = av.capacity - booked;

    if (available < booking_ids.length) {
      return res.status(400).json({
        success: false,
        message: `New date only has ${available} slot(s) available, but ${booking_ids.length} booking(s) selected.`,
      });
    }

    //  Fetch the actual bookings (verify booking_status = confirmed) 
    const bkResult = await pool.query(
      `SELECT b.id, b.reference_code, b.guest_name, b.guest_email,
              s.name AS service_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.id = ANY($1::uuid[])
         AND b.booking_status = 'confirmed'
         AND b.status NOT IN ('cancelled', 'picked_up')`,
      [booking_ids]
    );

    if (!bkResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid confirmed bookings found with the given IDs.',
      });
    }

    const bookings = bkResult.rows;

    //  Move bookings: update availability_id to new slot 
    await pool.query(
      `UPDATE bookings
       SET availability_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [av.id, booking_ids]
    );

    //  Audit log 
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_table, details)
       VALUES ($1, 'Bulk reschedule', 'bookings', $2)`,
      [
        req.session.user.id,
        `Moved ${bookings.length} booking(s) from ${from_date} to ${new_date}`,
      ]
    );

    // Email affected customers
    let notified = 0;
    try {
      const { sendEmail } = require('../../config/email');
      const oldDateDisp = new Date(from_date + 'T00:00:00')
        .toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const newDateDisp = new Date(new_date + 'T00:00:00')
        .toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      for (const b of bookings) {
        if (!b.guest_email) continue;
        try {
          await sendEmail({
            to:      b.guest_email,
            subject: `Your Booking Has Been Rescheduled - Ref ${b.reference_code}`,
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <h2 style="color:#dc2626;">Herco Detailing Garage</h2>
                <p>Hi <strong>${b.guest_name}</strong>,</p>
                <p>Your booking has been rescheduled by our team.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;font-weight:700;">${b.reference_code}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Service</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${b.service_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#ef4444;text-decoration:line-through;">Previous Date</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#ef4444;text-decoration:line-through;">${oldDateDisp}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#16a34a;font-weight:700;">New Date</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;color:#16a34a;font-weight:700;">${newDateDisp}</td>
                  </tr>
                </table>
                <p>If you have any questions, please contact us directly.</p>
                <p style="color:#6b7280;font-size:13px;">- Herco Detailing Garage Team</p>
              </div>`,
          });
          notified++;
        } catch (emailErr) {
          console.error(`Reschedule email error for ${b.guest_email}:`, emailErr);
        }
      }
    } catch (emailModuleErr) {
      console.error('Email module load error:', emailModuleErr);
    }

    res.json({
      success:     true,
      rescheduled: bookings.length,
      notified,
      message:     `${bookings.length} booking(s) rescheduled. ${notified} customer(s) notified.`,
    });

  } catch (err) {
    console.error('POST /bookings/reschedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/services
router.get('/services', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.description, s.price, s.duration_hours, s.is_active, s.image_url,
             json_agg(
               json_build_object('id',sv.id,'name',sv.name,'price',sv.price)
               ORDER BY sv.price ASC
             ) FILTER (WHERE sv.id IS NOT NULL) AS variants
      FROM services s
      LEFT JOIN service_variants sv ON sv.service_id=s.id AND sv.is_active=true
      WHERE s.is_active=true
      GROUP BY s.id ORDER BY s.created_at ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/services
router.post('/services', async (req, res) => {
  try {
    const { name, description, price, duration_hours, image_base64 } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
    }

    let finalImageUrl = null;
    if (image_base64 && image_base64.startsWith('data:')) {
  try {
    finalImageUrl = saveBase64Image(image_base64, null);
  } catch (imgErr) {
    return res.status(400).json({ success: false, message: imgErr.message });
  }
    }

    const result = await pool.query(
      `INSERT INTO services (name,description,price,duration_hours,image_url,is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING id,name,description,price,duration_hours,image_url`,
      [name.trim(), description?.trim()||null, parseFloat(price),
       duration_hours ? parseInt(duration_hours) : null, finalImageUrl]
    );

    const service = result.rows[0];
    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id,action,target_table,target_id,details) VALUES ($1,'Created service','services',$2,$3)`,
        [staffId, service.id, `Service "${name}" created`]
      );
    }

    res.status(201).json({ success: true, data: service, message: 'Service created successfully' });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/services/:id
router.put('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration_hours, image_base64, clear_image } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const oldResult   = await pool.query('SELECT image_url FROM services WHERE id=$1', [id]);
    const oldImageUrl = oldResult.rows[0]?.image_url || null;

    let finalImageUrl = oldImageUrl;
    if (clear_image) {
      finalImageUrl = null;
      if (oldImageUrl && oldImageUrl.startsWith('/uploads/services/')) {
        const oldPath = path.join(PUBLIC_DIR, oldImageUrl);
        if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (_) {} }
      }
    } else if (image_base64 && image_base64.startsWith('data:')) {
  try {
    finalImageUrl = saveBase64Image(image_base64, oldImageUrl);
  } catch (imgErr) {
    return res.status(400).json({ success: false, message: imgErr.message });
  }
    }

    const result = await pool.query(
      `UPDATE services SET name=$1,description=$2,price=$3,duration_hours=$4,image_url=$5
       WHERE id=$6 AND is_active=true
       RETURNING id,name,description,price,duration_hours,image_url`,
      [name.trim(), description?.trim()||null, parseFloat(price),
       duration_hours ? parseInt(duration_hours) : null, finalImageUrl, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id,action,target_table,target_id,details) VALUES ($1,'Updated service','services',$2,$3)`,
        [staffId, id, `Service "${name}" updated`]
      );
    }

    res.json({ success: true, data: result.rows[0], message: 'Service updated successfully' });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// DELETE /api/admin/services/:id
router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE services SET is_active=false WHERE id=$1 RETURNING name`, [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id,action,target_table,target_id,details) VALUES ($1,'Deleted service','services',$2,$3)`,
        [staffId, id, `Service "${result.rows[0].name}" soft-deleted`]
      );
    }
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/services/:id/variants
router.get('/services/:id/variants', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,name,price,duration_hours,is_active FROM service_variants
       WHERE service_id=$1 ORDER BY price ASC`, [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/services/:id/variants
router.post('/services/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, duration_hours, force } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    // WARN: variant duration exceeds base service duration
    if (!force && duration_hours) {
      const svcResult = await pool.query(
        `SELECT duration_hours FROM services WHERE id = $1`, [id]
      );
      const baseDuration = svcResult.rows[0]?.duration_hours;
      if (baseDuration && parseInt(duration_hours) > baseDuration) {
        return res.status(200).json({
          success: false,
          code: 'VARIANT_DURATION_EXCEEDS',
          warning: true,
          message: `This variant's duration (${duration_hours}h) exceeds the base service duration (${baseDuration}h). Proceed anyway?`
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO service_variants (service_id,name,price,duration_hours,is_active)
       VALUES ($1,$2,$3,$4,true) RETURNING id,name,price,duration_hours`,
      [id, name.trim(), parseFloat(price), duration_hours ? parseInt(duration_hours) : null]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Variant added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// DELETE /api/admin/services/:serviceId/variants/:variantId
router.delete('/services/:serviceId/variants/:variantId', async (req, res) => {
  try {
    await pool.query(
      `UPDATE service_variants SET is_active=false WHERE id=$1 AND service_id=$2`,
      [req.params.variantId, req.params.serviceId]
    );
    res.json({ success: true, message: 'Variant removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/availability
router.get('/availability', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT a.id, a.service_id, a.date, a.capacity, a.is_open, s.name AS service_name,
             COUNT(b.id) FILTER (WHERE b.booking_status IN ('locked','confirmed')) AS bookings_count
      FROM availability a
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN bookings b ON b.availability_id=a.id
    `;
    const params = [];
    if (date) { params.push(date); query += ` WHERE a.date=$1`; }
    else       { query += ` WHERE a.date>=CURRENT_DATE`; }
    query += ` GROUP BY a.id,a.service_id,a.date,a.capacity,a.is_open,s.name ORDER BY a.date ASC LIMIT 60`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/closed-dates
router.get('/closed-dates', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM closed_dates ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/accounts
router.post('/accounts', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;

    if (!name || !email || !role || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'All fields are required' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      normalizedEmail,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, normalizedEmail, hashedPassword, role]
    );

    res.json({
      success: true,
      message: 'Account created successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/staff
router.get('/staff', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,name,email,role,created_at FROM users WHERE role IN ('admin','staff') ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/payments
router.get('/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id,p.amount,p.amount_paid,p.remaining_balance,p.payment_type,
             p.is_fully_paid,p.status,p.paid_at,b.reference_code,b.guest_name
      FROM payments p LEFT JOIN bookings b ON b.id=p.booking_id
      ORDER BY p.created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.id,al.action,al.target_table,al.target_id,al.details,al.created_at,u.name AS user_name
      FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id
      ORDER BY al.created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/availability
router.post('/availability', async (req, res) => {
  try {
    const { service_id, date, capacity, is_open, force } = req.body;

    if (!service_id || !date || !capacity) {
      return res.status(400).json({ success: false, message: 'service_id, date, and capacity are required' });
    }

    const cap = parseInt(capacity);

    //  BLOCK: capacity 0 
    if (cap < 1) {
      return res.status(400).json({
        success: false,
        code: 'CAPACITY_ZERO',
        message: 'Capacity cannot be set to 0. Use the Closed Dates feature to block a date instead.'
      });
    }

    //  BLOCK: past date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date + 'T00:00:00');
    if (targetDate < today) {
      return res.status(400).json({
        success: false,
        code: 'PAST_DATE',
        message: 'Cannot set availability for a past date.'
      });
    }

    // WARN: no staff accounts (unless forced)
    if (!force) {
      const staffCount = await pool.query(
        `SELECT COUNT(*) AS count FROM users WHERE role IN ('admin','staff')`
      );
      if (parseInt(staffCount.rows[0].count) === 0) {
        return res.status(200).json({
          success: false,
          code: 'NO_STAFF',
          warning: true,
          message: 'No staff accounts exist. Are you sure you want to set availability with no staff to handle bookings?'
        });
      }

      // WARN: only 1 active staff 
      if (parseInt(staffCount.rows[0].count) === 1 && cap > 3) {
        return res.status(200).json({
          success: false,
          code: 'LOW_STAFF',
          warning: true,
          message: `Only 1 staff account exists. A capacity of ${cap} may be difficult for one person to handle. Proceed anyway?`
        });
      }
    }

    // WARN: capacity × service duration exceeds 9 working hours
    if (!force) {
      const svcResult = await pool.query(
        `SELECT duration_hours FROM services WHERE id = $1`, [service_id]
      );
      const baseDuration = svcResult.rows[0]?.duration_hours || 0;
      if (baseDuration > 0 && cap * baseDuration > 9) {
        return res.status(200).json({
          success: false,
          code: 'EXCEEDS_HOURS',
          warning: true,
          message: `Setting capacity to ${cap} with a ${baseDuration}h service duration totals ${cap * baseDuration} hours - exceeding the 9-hour workday. Proceed anyway?`
        });
      }
    }

    // WARN: setting capacity on today's date 
    const isToday = targetDate.getTime() === today.getTime();
    if (!force && isToday) {
      return res.status(200).json({
        success: false,
        code: 'TODAY_DATE',
        warning: true,
        message: 'You are setting availability for today. This may affect active operations. Proceed anyway?'
      });
    }

    // SAVE 
    const result = await pool.query(
      `INSERT INTO availability (service_id, date, capacity, is_open)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (service_id, date)
       DO UPDATE SET capacity = $3, is_open = $4
       RETURNING id, date, capacity, is_open`,
      [service_id, date, cap, is_open !== false]
    );

    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'Set availability capacity', 'availability', $2, $3)`,
        [staffId, result.rows[0].id, `Capacity ${cap} set for date ${date}`]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0], message: 'Capacity saved successfully' });
  } catch (err) {
    console.error('Create availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/availability/:id
router.put('/availability/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { capacity, is_open, date, force } = req.body;

    const cap = parseInt(capacity);

    // BLOCK: capacity 0 
    if (!capacity || cap < 1) {
      return res.status(400).json({
        success: false,
        code: 'CAPACITY_ZERO',
        message: 'Capacity cannot be set to 0. Use the Closed Dates feature to block a date instead.'
      });
    }

    // Fetch existing row for checks
    const existing = await pool.query(
      `SELECT a.*, s.duration_hours AS service_duration, a.date AS avail_date
       FROM availability a
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = $1`, [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Availability entry not found' });
    }

    const row = existing.rows[0];
    const targetDateStr = date || row.avail_date?.toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // BLOCK: past date 
    if (targetDate < today) {
      return res.status(400).json({
        success: false,
        code: 'PAST_DATE',
        message: 'Cannot modify availability for a past date.'
      });
    }

    // BLOCK: reducing below confirmed bookings
    const bookedResult = await pool.query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE availability_id = $1 AND booking_status = 'confirmed'`, [id]
    );
    const confirmedCount = parseInt(bookedResult.rows[0].count);
    if (cap < confirmedCount) {
      return res.status(400).json({
        success: false,
        code: 'BELOW_CONFIRMED',
        message: `Cannot reduce capacity to ${cap}. There are already ${confirmedCount} confirmed booking(s) for this date/service.`
      });
    }

    if (!force) {
      // WARN: exceeds working hours
      const baseDuration = row.service_duration || 0;
      if (baseDuration > 0 && cap * baseDuration > 9) {
        return res.status(200).json({
          success: false,
          code: 'EXCEEDS_HOURS',
          warning: true,
          message: `Setting capacity to ${cap} with a ${baseDuration}h service duration totals ${cap * baseDuration} hours - exceeding the 9-hour workday. Proceed anyway?`
        });
      }

      // WARN: today's date 
      const isToday = targetDate.getTime() === today.getTime();
      if (isToday) {
        return res.status(200).json({
          success: false,
          code: 'TODAY_DATE',
          warning: true,
          message: 'You are modifying capacity for today. This may affect active operations. Proceed anyway?'
        });
      }
    }

    // SAVE 
    const result = await pool.query(
      `UPDATE availability
       SET capacity = $1, is_open = $2, date = COALESCE($3, date)
       WHERE id = $4
       RETURNING id, date, capacity, is_open`,
      [cap, is_open !== false, date || null, id]
    );

    res.json({ success: true, data: result.rows[0], message: 'Capacity updated successfully' });
  } catch (err) {
    console.error('Update availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/availability/:id
router.delete('/availability/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM availability WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Availability entry not found' });
    }
    res.json({ success: true, message: 'Availability entry deleted' });
  } catch (err) {
    console.error('Delete availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/closed-dates
router.post('/closed-dates', async (req, res) => {
  try {
    const { type, day_of_week, date, reason } = req.body;

    if (!type || !['recurring', 'specific'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be recurring or specific' });
    }
    if (type === 'recurring' && day_of_week === undefined) {
      return res.status(400).json({ success: false, message: 'day_of_week is required for recurring closure' });
    }
    if (type === 'specific' && !date) {
      return res.status(400).json({ success: false, message: 'date is required for specific closure' });
    }

    const result = await pool.query(
      `INSERT INTO closed_dates (type, day_of_week, date, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, day_of_week, date, reason`,
      [type, type === 'recurring' ? parseInt(day_of_week) : null, type === 'specific' ? date : null, reason || null]
    );

    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'Added closed date', 'closed_dates', $2, $3)`,
        [staffId, result.rows[0].id, `Closure: ${type}, ${reason || 'no reason'}`]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0], message: 'Closure added successfully' });
  } catch (err) {
    console.error('Create closed date error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/closed-dates/:id
router.delete('/closed-dates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM closed_dates WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Closed date not found' });
    }
    res.json({ success: true, message: 'Closure deleted successfully' });
  } catch (err) {
    console.error('Delete closed date error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/notifications/count
router.get('/notifications/count', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS count
      FROM bookings b
      LEFT JOIN availability a ON a.id = b.availability_id
      WHERE b.booking_status = 'confirmed'
        AND b.status IN ('pending', 'done')
        AND (
          DATE(a.date) = CURRENT_DATE
          OR (b.availability_id IS NULL AND DATE(b.created_at) = CURRENT_DATE)
        )
    `);
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/notifications/list
router.get('/notifications/list', async (req, res) => {
  try {
    // New bookings today (confirmed today)
    const newRes = await pool.query(`
      SELECT b.id, b.reference_code, b.guest_name, b.status,
             s.name AS service_name, sv.name AS variant_name
      FROM bookings b
      LEFT JOIN availability a      ON a.id  = b.availability_id
      LEFT JOIN services s          ON s.id  = b.service_id
      LEFT JOIN service_variants sv ON sv.id = b.variant_id
      WHERE b.booking_status = 'confirmed'
        AND DATE(b.created_at) = CURRENT_DATE
      ORDER BY b.created_at DESC
    `);

    // Pending bookings (confirmed but not yet in_progress) - today
    const pendingRes = await pool.query(`
      SELECT b.id, b.reference_code, b.guest_name, b.status,
             s.name AS service_name
      FROM bookings b
      LEFT JOIN availability a ON a.id = b.availability_id
      LEFT JOIN services s     ON s.id = b.service_id
      WHERE b.booking_status = 'confirmed'
        AND b.status = 'pending'
        AND (
          DATE(a.date) = CURRENT_DATE
          OR (b.availability_id IS NULL AND DATE(b.created_at) = CURRENT_DATE)
        )
      ORDER BY b.created_at ASC
    `);

    // Done - waiting for pickup
    const pickupRes = await pool.query(`
      SELECT b.id, b.reference_code, b.guest_name, b.status,
             s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      WHERE b.booking_status = 'confirmed'
        AND b.status = 'done'
      ORDER BY b.updated_at DESC
    `);

    // Expired bookings today
    const expiredRes = await pool.query(`
      SELECT b.id, b.reference_code, b.guest_name, b.status,
             s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON s.id = b.service_id
      WHERE b.booking_status = 'expired'
        AND DATE(b.created_at) = CURRENT_DATE
      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        newBookings: newRes.rows,
        pending:     pendingRes.rows,
        pickup:      pickupRes.rows,
        expired:     expiredRes.rows,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.session?.user?.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot remove your own account.' });
    }

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND role IN ('admin','staff') RETURNING id, name`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const staffId = req.session?.user?.id || null;
    if (staffId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'Deleted staff account', 'users', $2, $3)`,
        [staffId, id, `Account "${result.rows[0].name}" deleted`]
      );
    }

    res.json({ success: true, message: 'Account removed successfully.' });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
