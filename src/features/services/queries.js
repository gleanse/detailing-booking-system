const pool = require('../../config/database');

// get all active services with their variants
const getAllServices = async () => {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.name,
      s.description,
      s.price,
      s.down_payment_amount,
      s.duration_hours,
      s.image_url,
      json_agg(
        json_build_object(
          'id', sv.id,
          'name', sv.name,
          'price', sv.price,
          'duration_hours', sv.duration_hours
        ) ORDER BY sv.price ASC
      ) AS variants
    FROM services s
    LEFT JOIN service_variants sv ON sv.service_id = s.id AND sv.is_active = true
    WHERE s.is_active = true
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `);
  return result.rows;
};

module.exports = { getAllServices };
