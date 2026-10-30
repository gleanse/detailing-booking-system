-- ========================================
-- COMPLETE SEED DATA FOR HERCO DATABASE (FIXED)
-- ========================================

-- 1. USERS SEED (all use password = 'password')
INSERT INTO users (id, name, email, phone, password, role) VALUES
(gen_random_uuid(), 'Admin User', 'admin@gmail.com', '09123456789', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'admin'),
(gen_random_uuid(), 'Staff One', 'staff1@gmail.com', '09234567890', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff'),
(gen_random_uuid(), 'Staff Two', 'staff2@gmail.com', '09345678901', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff'),
(gen_random_uuid(), 'Customer One', 'customer1@gmail.com', '09456789012', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer'),
(gen_random_uuid(), 'Customer Two', 'customer2@gmail.com', '09567890123', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer'),
(gen_random_uuid(), 'Customer Three', 'customer3@gmail.com', '09678901234', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer');

-- 2. SERVICES SEED
INSERT INTO services (id, name, description, price, deposit_amount, duration_hours, image_url, is_active) VALUES
(gen_random_uuid(), 'Ceramic Coating', 'Ceramic coating for the whole motorcycle body, for lasting protection and shine. Graphene coating, a longer-lasting upgrade, is available and confirmed in shop.', 1500.00, 300.00, 3, 'https://placehold.co/400x200?text=Ceramic+Coating', true),
(gen_random_uuid(), 'Powder Coating', 'Durable powder coating for mags and other metal parts. Not applicable to plastic parts.', 800.00, 300.00, 12, 'https://placehold.co/400x200?text=Powder+Coating', true);

-- 3. SERVICE VARIANTS SEED
-- Ceramic Coating variants (by motorcycle body size)
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Scooter / Underbone', 1500.00, 2, true FROM services s WHERE s.name = 'Ceramic Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Standard', 2500.00, 3, true FROM services s WHERE s.name = 'Ceramic Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Big Bike', 4000.00, 4, true FROM services s WHERE s.name = 'Ceramic Coating';

-- Powder Coating variants (by part, metal parts only)
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Mags', 1200.00, 12, true FROM services s WHERE s.name = 'Powder Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Swing Arm', 800.00, 12, true FROM services s WHERE s.name = 'Powder Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Crankcase', 800.00, 12, true FROM services s WHERE s.name = 'Powder Coating';

-- 4. CLOSED DATES SEED
INSERT INTO closed_dates (type, day_of_week, reason) VALUES
('recurring', 1, 'Closed on Mondays'),
('recurring', 2, 'Closed on Tuesdays');

-- 5. AVAILABILITY SEED (2 weeks back to 30 days ahead)
-- Ceramic Coating: Wednesday to Sunday, capacity 10
-- Powder Coating: Wednesday, Friday and Sunday only, capacity 8
INSERT INTO availability (id, service_id, date, capacity, is_open)
SELECT
  gen_random_uuid(),
  s.id,
  (CURRENT_DATE + offsets.days_offset)::DATE,
  CASE WHEN s.name = 'Ceramic Coating' THEN 10 ELSE 8 END,
  true
FROM services s
CROSS JOIN (
  SELECT generate_series(-14, 30) AS days_offset
) offsets
WHERE
  s.is_active = true
  AND (
    (s.name = 'Ceramic Coating' AND EXTRACT(DOW FROM (CURRENT_DATE + offsets.days_offset)::DATE) IN (0, 3, 4, 5, 6))
    OR (s.name = 'Powder Coating' AND EXTRACT(DOW FROM (CURRENT_DATE + offsets.days_offset)::DATE) IN (0, 3, 5))
  )
ON CONFLICT (service_id, date) DO NOTHING;

-- 6. BOOKINGS SEED
DO $$
DECLARE
  admin_id UUID;
  staff1_id UUID;
  staff2_id UUID;
  customer1_id UUID;
  customer2_id UUID;
  ceramic_service_id UUID;
  powder_service_id UUID;
  ceramic_small_id UUID;
  ceramic_big_id UUID;
  powder_mags_id UUID;
  powder_swingarm_id UUID;
  avail_ceramic_done_id UUID;
  avail_ceramic_next_id UUID;
  avail_powder_current_id UUID;
  avail_powder_next_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO admin_id FROM users WHERE email = 'admin@gmail.com';
  SELECT id INTO staff1_id FROM users WHERE email = 'staff1@gmail.com';
  SELECT id INTO staff2_id FROM users WHERE email = 'staff2@gmail.com';
  SELECT id INTO customer1_id FROM users WHERE email = 'customer1@gmail.com';
  SELECT id INTO customer2_id FROM users WHERE email = 'customer2@gmail.com';

  -- Get service IDs
  SELECT id INTO ceramic_service_id FROM services WHERE name = 'Ceramic Coating';
  SELECT id INTO powder_service_id FROM services WHERE name = 'Powder Coating';

  -- Get variant IDs
  SELECT id INTO ceramic_small_id FROM service_variants WHERE service_id = ceramic_service_id AND name = 'Scooter / Underbone';
  SELECT id INTO ceramic_big_id FROM service_variants WHERE service_id = ceramic_service_id AND name = 'Big Bike';
  SELECT id INTO powder_mags_id FROM service_variants WHERE service_id = powder_service_id AND name = 'Mags';
  SELECT id INTO powder_swingarm_id FROM service_variants WHERE service_id = powder_service_id AND name = 'Swing Arm';

  -- Get availability IDs from real open days of each service
  SELECT id INTO avail_ceramic_done_id FROM availability WHERE service_id = ceramic_service_id AND date <= CURRENT_DATE - 7 ORDER BY date DESC LIMIT 1;
  SELECT id INTO avail_ceramic_next_id FROM availability WHERE service_id = ceramic_service_id AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1;
  SELECT id INTO avail_powder_current_id FROM availability WHERE service_id = powder_service_id AND date <= CURRENT_DATE ORDER BY date DESC LIMIT 1;
  SELECT id INTO avail_powder_next_id FROM availability WHERE service_id = powder_service_id AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1 OFFSET 1;

  INSERT INTO bookings (
    id, user_id, service_id, variant_id, availability_id,
    reference_code, queue_number, motorcycle_plate, motorcycle_model, motorcycle_color, motorcycle_description,
    status, booking_status, payment_method, is_walkin,
    expires_at, created_at
  ) VALUES
  -- Pending/confirmed ceramic booking on the next open ceramic day
  (
    gen_random_uuid(), customer1_id, ceramic_service_id, ceramic_small_id, avail_ceramic_next_id,
    'HRC-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 1, 'ABC123', 'Honda Click', 'Red', 'Stock condition',
    'pending', 'confirmed', 'online', false,
    NOW() + INTERVAL '1 hour', NOW() - INTERVAL '2 days'
  ),
  -- In-progress powder booking on the latest powder day (started by staff1)
  (
    gen_random_uuid(), customer2_id, powder_service_id, powder_mags_id, avail_powder_current_id,
    'HRC-' || TO_CHAR(NOW(), 'YYMMDD') || '-002', 1, 'XYZ789', 'Yamaha Mio', 'Blue', 'With accessories',
    'in_progress', 'confirmed', 'online', false,
    NOW() + INTERVAL '1 hour', NOW() - INTERVAL '1 day'
  ),
  -- Walk-in customer (no user_id) on the next open ceramic day
  (
    gen_random_uuid(), NULL, ceramic_service_id, ceramic_small_id, avail_ceramic_next_id,
    'HRC-' || TO_CHAR(NOW() + INTERVAL '1 day', 'YYMMDD') || '-001', 2, 'WALK001', 'Suzuki Raider', 'Black', 'Modified exhaust',
    'pending', 'confirmed', 'cash', true,
    NOW() + INTERVAL '1 hour' + INTERVAL '1 day', NOW()
  ),
  -- Completed big bike booking (for history) from at least a week ago
  (
    gen_random_uuid(), customer1_id, ceramic_service_id, ceramic_big_id, avail_ceramic_done_id,
    'HRC-' || TO_CHAR(NOW() - INTERVAL '7 days', 'YYMMDD') || '-001', 1, 'DONE123', 'Kawasaki Ninja', 'Green', 'Full fairing',
    'done', 'confirmed', 'online', false,
    NOW() - INTERVAL '7 days' + INTERVAL '1 hour', NOW() - INTERVAL '8 days'
  ),
  -- Pending powder booking on the second upcoming powder day
  (
    gen_random_uuid(), customer2_id, powder_service_id, powder_swingarm_id, avail_powder_next_id,
    'HRC-' || TO_CHAR(NOW() + INTERVAL '7 days', 'YYMMDD') || '-001', 1, 'PEND456', 'Honda Beat', 'White', 'Stock',
    'pending', 'confirmed', 'online', false,
    NOW() + INTERVAL '7 days' + INTERVAL '1 hour', NOW() - INTERVAL '1 day'
  );

  -- Update guest info for walk-in
  UPDATE bookings SET
    guest_name = 'John Doe',
    guest_email = 'john.doe@email.com',
    guest_phone = '09789012345'
  WHERE motorcycle_plate = 'WALK001';

  -- 7. BOOKING STATUS LOGS (timeline)
  -- For the first booking (pending/confirmed)
  INSERT INTO booking_status_logs (id, booking_id, status, changed_by, created_at)
  SELECT gen_random_uuid(), b.id, 'confirmed', admin_id, b.created_at + INTERVAL '5 minutes'
  FROM bookings b WHERE b.motorcycle_plate = 'ABC123';

  -- For in-progress booking (XYZ789) - full timeline
  INSERT INTO booking_status_logs (id, booking_id, status, changed_by, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM bookings WHERE motorcycle_plate = 'XYZ789'), 'confirmed', admin_id, NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
  (gen_random_uuid(), (SELECT id FROM bookings WHERE motorcycle_plate = 'XYZ789'), 'in_progress', staff1_id, NOW() - INTERVAL '2 hours');

  -- For completed booking (DONE123) - full timeline
  INSERT INTO booking_status_logs (id, booking_id, status, changed_by, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM bookings WHERE motorcycle_plate = 'DONE123'), 'confirmed', admin_id, NOW() - INTERVAL '8 days' + INTERVAL '10 minutes'),
  (gen_random_uuid(), (SELECT id FROM bookings WHERE motorcycle_plate = 'DONE123'), 'in_progress', staff2_id, NOW() - INTERVAL '7 days' + INTERVAL '2 hours'),
  (gen_random_uuid(), (SELECT id FROM bookings WHERE motorcycle_plate = 'DONE123'), 'done', staff2_id, NOW() - INTERVAL '7 days' + INTERVAL '6 hours');

  -- For walk-in booking (WALK001) - just confirmed
  INSERT INTO booking_status_logs (id, booking_id, status, changed_by, created_at)
  SELECT gen_random_uuid(), b.id, 'confirmed', staff1_id, b.created_at + INTERVAL '2 minutes'
  FROM bookings b WHERE b.motorcycle_plate = 'WALK001';

  -- For pending next week booking (PEND456) - just confirmed
  INSERT INTO booking_status_logs (id, booking_id, status, changed_by, created_at)
  SELECT gen_random_uuid(), b.id, 'confirmed', admin_id, b.created_at + INTERVAL '5 minutes'
  FROM bookings b WHERE b.motorcycle_plate = 'PEND456';

  -- 8. PAYMENTS SEED
  INSERT INTO payments (
    id, booking_id, xendit_invoice_id, amount, amount_paid, remaining_balance,
    is_fully_paid, status, paid_at, payment_attempts
  )
  SELECT
    gen_random_uuid(),
    b.id,
    'xendit_' || b.reference_code,
    sv.price,
    CASE
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789', 'DONE123') THEN s.deposit_amount
      ELSE 0
    END,
    CASE
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789') THEN sv.price - s.deposit_amount
      WHEN b.motorcycle_plate = 'DONE123' THEN 0
      ELSE sv.price
    END,
    b.motorcycle_plate = 'DONE123',
    CASE
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789', 'DONE123') THEN 'paid'
      ELSE 'unpaid'
    END,
    CASE
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789', 'DONE123') THEN b.created_at + INTERVAL '10 minutes'
    END,
    1
  FROM bookings b
  JOIN service_variants sv ON b.variant_id = sv.id
  JOIN services s ON s.id = b.service_id
  WHERE b.variant_id IS NOT NULL;

  -- 9. NOTIFICATIONS SEED
  INSERT INTO notifications (id, booking_id, email, type, sent_at)
  SELECT
    gen_random_uuid(),
    b.id,
    COALESCE(u.email, b.guest_email),
    CASE
      WHEN b.status = 'pending' AND b.booking_status = 'confirmed' THEN 'booking_confirmed'
      WHEN b.status = 'in_progress' THEN 'in_progress'
      WHEN b.status = 'done' THEN 'done'
    END,
    CASE
      WHEN b.status = 'pending' AND b.booking_status = 'confirmed' THEN b.created_at + INTERVAL '5 minutes'
      WHEN b.status = 'in_progress' AND b.motorcycle_plate = 'XYZ789' THEN NOW() - INTERVAL '2 hours'
      WHEN b.status = 'done' AND b.motorcycle_plate = 'DONE123' THEN NOW() - INTERVAL '7 days' + INTERVAL '6 hours'
    END
  FROM bookings b
  LEFT JOIN users u ON b.user_id = u.id
  WHERE
    (b.status = 'pending' AND b.booking_status = 'confirmed')
    OR b.status = 'in_progress'
    OR b.status = 'done';

  -- 10. AUDIT LOGS SEED (same action names and wording the app writes)
  INSERT INTO audit_logs (id, user_id, action, target_table, target_id, details, created_at)
  SELECT
    gen_random_uuid(),
    bsl.changed_by,
    'status_changed_to_' || bsl.status,
    'bookings',
    bsl.booking_id,
    'Booking ' || b.reference_code || ' marked as ' || bsl.status,
    bsl.created_at
  FROM booking_status_logs bsl
  JOIN bookings b ON bsl.booking_id = b.id
  WHERE bsl.status IN ('in_progress', 'done');

  INSERT INTO audit_logs (id, user_id, action, target_table, target_id, details, created_at)
  SELECT
    gen_random_uuid(),
    staff2_id,
    'marked_fully_paid',
    'bookings',
    b.id,
    'Remaining balance collected for booking ' || b.reference_code,
    NOW() - INTERVAL '7 days' + INTERVAL '6 hours' + INTERVAL '5 minutes'
  FROM bookings b WHERE b.motorcycle_plate = 'DONE123';

  INSERT INTO audit_logs (id, user_id, action, target_table, target_id, details, created_at)
  SELECT
    gen_random_uuid(),
    staff1_id,
    'walkin_created',
    'bookings',
    b.id,
    'Walk-in booking created: ' || b.reference_code || ' for ' || b.guest_name,
    b.created_at + INTERVAL '2 minutes'
  FROM bookings b WHERE b.motorcycle_plate = 'WALK001';

END $$;

-- ========================================
-- VERIFICATION QUERIES (run these to check)
-- ========================================

-- Check users
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'service_variants', COUNT(*) FROM service_variants
UNION ALL
SELECT 'availability', COUNT(*) FROM availability
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'booking_status_logs', COUNT(*) FROM booking_status_logs
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- Show sample booking with full details
SELECT
  b.reference_code,
  b.motorcycle_plate,
  b.motorcycle_model,
  b.status AS current_status,
  b.booking_status,
  s.name AS service,
  sv.name AS variant,
  p.amount_paid,
  p.remaining_balance,
  COUNT(bsl.id) AS status_log_count
FROM bookings b
JOIN services s ON b.service_id = s.id
JOIN service_variants sv ON b.variant_id = sv.id
JOIN payments p ON p.booking_id = b.id
LEFT JOIN booking_status_logs bsl ON bsl.booking_id = b.id
GROUP BY b.id, s.name, sv.name, p.amount_paid, p.remaining_balance
ORDER BY b.created_at DESC;
