-- DEMO SEED DATA FOR HERCO
-- every row follows what the app really writes: reference codes, queue numbers, payments, status logs and audit entries
-- all demo accounts use the password 'password' and @example.test addresses, a reserved domain that can never receive mail
-- run only on a local or throwaway database, scripts/seeds.js wipes every table first

-- 1. USERS
INSERT INTO users (name, email, phone, password, role, email_verified) VALUES
('Admin User', 'admin@example.test', '09123456789', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'admin', true),
('Staff One', 'staff1@example.test', '09234567890', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff', true),
('Staff Two', 'staff2@example.test', '09345678901', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff', true),
('Customer One', 'customer1@example.test', '09456789012', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer', true),
('Customer Two', 'customer2@example.test', '09567890123', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer', true),
('Customer Three', 'customer3@example.test', '09678901234', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer', true);

-- 2. SERVICES
INSERT INTO services (name, description, price, down_payment_amount, duration_hours, image_url, is_active) VALUES
('Ceramic Coating', 'Ceramic coating for the whole motorcycle body, for lasting protection and shine. Graphene coating, a longer-lasting upgrade, is available and confirmed in shop.', 1500.00, 300.00, 3, 'https://placehold.co/400x200?text=Ceramic+Coating', true),
('Powder Coating', 'Durable powder coating for mags and other metal parts. Not applicable to plastic parts.', 800.00, 300.00, 12, 'https://placehold.co/400x200?text=Powder+Coating', true);

-- 3. SERVICE VARIANTS
INSERT INTO service_variants (service_id, name, price, duration_hours, is_active)
SELECT s.id, v.name, v.price, v.duration_hours, true
FROM services s
JOIN (VALUES
  ('Ceramic Coating', 'Scooter / Underbone', 1500.00, 2),
  ('Ceramic Coating', 'Standard', 2500.00, 3),
  ('Ceramic Coating', 'Big Bike', 4000.00, 4),
  ('Powder Coating', 'Mags', 1200.00, 12),
  ('Powder Coating', 'Swing Arm', 800.00, 12),
  ('Powder Coating', 'Crankcase', 800.00, 12)
) AS v(service_name, name, price, duration_hours) ON v.service_name = s.name;

-- 4. CLOSED DATES
INSERT INTO closed_dates (type, day_of_week, reason) VALUES
('recurring', 1, 'Closed on Mondays'),
('recurring', 2, 'Closed on Tuesdays');

-- 5. AVAILABILITY
-- 2 weeks back to 30 days ahead
-- ceramic coating: wednesday to sunday, capacity 10
-- powder coating: wednesday, friday and sunday only, capacity 8
INSERT INTO availability (service_id, date, capacity, is_open)
SELECT
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

-- 6. HELPERS
-- temporary, they vanish when the connection closes

-- a time on a given day, never later than a few minutes ago so seeded history is never in the future
CREATE FUNCTION pg_temp.day_at(p_day date, p_hour numeric) RETURNS timestamptz
LANGUAGE sql AS $fn$
  SELECT LEAST(p_day::timestamptz + p_hour::float8 * INTERVAL '1 hour', NOW() - INTERVAL '5 minutes');
$fn$;

CREATE FUNCTION pg_temp.seed_audit(p_user uuid, p_action text, p_booking uuid, p_details text, p_at timestamptz)
RETURNS void LANGUAGE sql AS $fn$
  INSERT INTO audit_logs (user_id, action, target_table, target_id, details, created_at)
  VALUES (p_user, p_action, 'bookings', p_booking, p_details, p_at);
$fn$;

-- same writes as staff changing a status: the booking, the status log and the audit entry
CREATE FUNCTION pg_temp.seed_status(p_booking uuid, p_status text, p_staff uuid, p_at timestamptz)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_ref text;
BEGIN
  UPDATE bookings
  SET status = p_status, updated_by = p_staff, updated_at = p_at
  WHERE id = p_booking
  RETURNING reference_code INTO v_ref;

  INSERT INTO booking_status_logs (booking_id, status, changed_by, created_at)
  VALUES (p_booking, p_status, p_staff, p_at);

  PERFORM pg_temp.seed_audit(
    p_staff, 'status_changed_to_' || p_status, p_booking,
    'Booking ' || v_ref || ' marked as ' || p_status, p_at
  );
END
$fn$;

-- a confirmed booking the way the app creates one
-- online: paid through an xendit invoice, confirmed by the webhook, held 16 minutes while paying
-- walk-in: created by staff with cash, optional down payment, no invoice and no hold
CREATE FUNCTION pg_temp.seed_booking(
  p_user uuid, p_avail uuid, p_service uuid, p_variant uuid,
  p_name text, p_email text, p_phone text,
  p_plate text, p_model text, p_color text, p_desc text,
  p_walkin boolean, p_staff uuid, p_created timestamptz,
  p_paid numeric, p_ip text
) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE
  v_id uuid := gen_random_uuid();
  v_ref text := 'HRC-' || UPPER(SUBSTRING(v_id::text, 1, 8));
  v_invoice text := SUBSTRING(md5(random()::text || v_id::text), 1, 24);
  v_price numeric;
  v_paid_at timestamptz := p_created + INTERVAL '6 minutes';
BEGIN
  SELECT price INTO v_price FROM service_variants WHERE id = p_variant;

  INSERT INTO bookings (
    id, user_id, service_id, variant_id, availability_id,
    guest_name, guest_email, guest_phone,
    reference_code, queue_number,
    motorcycle_plate, motorcycle_model, motorcycle_color, motorcycle_description,
    is_walkin, payment_method, status, booking_status,
    expires_at, ip_address, updated_by, updated_at, created_at
  ) VALUES (
    v_id, p_user, p_service, p_variant, p_avail,
    p_name, p_email, p_phone,
    v_ref,
    (SELECT COALESCE(MAX(queue_number), 0) + 1 FROM bookings WHERE availability_id = p_avail),
    p_plate, p_model, p_color, p_desc,
    p_walkin,
    CASE WHEN p_walkin THEN 'cash' ELSE 'online' END,
    'pending', 'confirmed',
    CASE WHEN p_walkin THEN NULL ELSE p_created + INTERVAL '16 minutes' END,
    CASE WHEN p_walkin THEN NULL ELSE p_ip END,
    CASE WHEN p_walkin THEN p_staff END,
    CASE WHEN p_walkin THEN p_created ELSE v_paid_at END,
    p_created
  );

  IF p_walkin THEN
    INSERT INTO payments (
      booking_id, amount, amount_paid, remaining_balance, is_fully_paid,
      status, paid_at, created_at
    ) VALUES (
      v_id, v_price, p_paid, v_price - p_paid, v_price - p_paid = 0,
      CASE WHEN p_paid > 0 THEN 'paid' ELSE 'unpaid' END,
      CASE WHEN p_paid > 0 THEN p_created END,
      p_created
    );

    INSERT INTO booking_status_logs (booking_id, status, changed_by, created_at)
    VALUES (v_id, 'confirmed', p_staff, p_created);

    PERFORM pg_temp.seed_audit(
      p_staff, 'walkin_created', v_id,
      'Walk-in booking created: ' || v_ref || ' for ' || p_name, p_created
    );
  ELSE
    INSERT INTO payments (
      booking_id, xendit_invoice_id, invoice_url, amount, amount_paid,
      remaining_balance, is_fully_paid, status, paid_at, created_at
    ) VALUES (
      v_id, v_invoice, 'https://checkout.xendit.co/web/' || v_invoice,
      v_price, p_paid, v_price - p_paid, v_price - p_paid = 0,
      'paid', v_paid_at, p_created
    );

    INSERT INTO booking_status_logs (booking_id, status, changed_by, created_at)
    VALUES (v_id, 'confirmed', NULL, v_paid_at);
  END IF;

  RETURN v_id;
END
$fn$;

-- 7. BOOKINGS, PAYMENTS, STATUS LOGS AND AUDIT LOGS
DO $seed$
DECLARE
  admin_id uuid;
  staff1_id uuid;
  staff2_id uuid;
  c1 uuid;
  c2 uuid;
  c3 uuid;
  ceramic uuid;
  powder uuid;
  cer_scooter uuid;
  cer_standard uuid;
  cer_big uuid;
  pow_mags uuid;
  pow_swing uuid;

  a_history uuid;      d_history date;
  a_ready uuid;        d_ready date;
  a_carried uuid;      d_carried date;
  a_powder_now uuid;   d_powder_now date;
  a_powder_past uuid;  d_powder_past date;
  a_cer_next1 uuid;
  a_cer_next2 uuid;
  a_cer_next3 uuid;
  a_pow_next1 uuid;
  a_pow_next2 uuid;

  b uuid;
  v_ref text;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@example.test';
  SELECT id INTO staff1_id FROM users WHERE email = 'staff1@example.test';
  SELECT id INTO staff2_id FROM users WHERE email = 'staff2@example.test';
  SELECT id INTO c1 FROM users WHERE email = 'customer1@example.test';
  SELECT id INTO c2 FROM users WHERE email = 'customer2@example.test';
  SELECT id INTO c3 FROM users WHERE email = 'customer3@example.test';

  SELECT id INTO ceramic FROM services WHERE name = 'Ceramic Coating';
  SELECT id INTO powder FROM services WHERE name = 'Powder Coating';

  SELECT id INTO cer_scooter FROM service_variants WHERE service_id = ceramic AND name = 'Scooter / Underbone';
  SELECT id INTO cer_standard FROM service_variants WHERE service_id = ceramic AND name = 'Standard';
  SELECT id INTO cer_big FROM service_variants WHERE service_id = ceramic AND name = 'Big Bike';
  SELECT id INTO pow_mags FROM service_variants WHERE service_id = powder AND name = 'Mags';
  SELECT id INTO pow_swing FROM service_variants WHERE service_id = powder AND name = 'Swing Arm';

  -- open days of each service, picked relative to today
  SELECT id, date INTO a_history, d_history FROM availability WHERE service_id = ceramic AND date <= CURRENT_DATE - 7 ORDER BY date DESC LIMIT 1;
  SELECT id, date INTO a_ready, d_ready FROM availability WHERE service_id = ceramic AND date <= CURRENT_DATE ORDER BY date DESC LIMIT 1;
  SELECT id, date INTO a_carried, d_carried FROM availability WHERE service_id = ceramic AND date < CURRENT_DATE ORDER BY date DESC LIMIT 1 OFFSET 1;
  SELECT id, date INTO a_powder_now, d_powder_now FROM availability WHERE service_id = powder AND date <= CURRENT_DATE ORDER BY date DESC LIMIT 1;
  SELECT id, date INTO a_powder_past, d_powder_past FROM availability WHERE service_id = powder AND date < CURRENT_DATE ORDER BY date DESC LIMIT 1;
  SELECT id INTO a_cer_next1 FROM availability WHERE service_id = ceramic AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1;
  SELECT id INTO a_cer_next2 FROM availability WHERE service_id = ceramic AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1 OFFSET 1;
  SELECT id INTO a_cer_next3 FROM availability WHERE service_id = ceramic AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1 OFFSET 2;
  SELECT id INTO a_pow_next1 FROM availability WHERE service_id = powder AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1;
  SELECT id INTO a_pow_next2 FROM availability WHERE service_id = powder AND date > CURRENT_DATE ORDER BY date ASC LIMIT 1 OFFSET 1;

  -- picked up: a finished job from over a week ago, full timeline, balance settled at handover
  b := pg_temp.seed_booking(c1, a_history, ceramic, cer_big,
    'Customer One', 'customer1@example.test', '09456789012',
    'NBC 4821', 'Kawasaki Ninja 400', 'Green', 'Full fairing',
    false, NULL, pg_temp.day_at(d_history - 3, 10), 300, '203.0.113.21');
  SELECT reference_code INTO v_ref FROM bookings WHERE id = b;
  PERFORM pg_temp.seed_status(b, 'in_progress', staff2_id, pg_temp.day_at(d_history, 9));
  PERFORM pg_temp.seed_status(b, 'done', staff2_id, pg_temp.day_at(d_history, 14));
  UPDATE payments SET remaining_balance = 0, is_fully_paid = true, paid_at = pg_temp.day_at(d_history, 14.25) WHERE booking_id = b;
  UPDATE bookings SET updated_by = staff2_id, updated_at = pg_temp.day_at(d_history, 14.25) WHERE id = b;
  PERFORM pg_temp.seed_audit(staff2_id, 'marked_fully_paid', b,
    'Remaining balance collected for booking ' || v_ref, pg_temp.day_at(d_history, 14.25));
  PERFORM pg_temp.seed_status(b, 'picked_up', staff2_id, pg_temp.day_at(d_history, 15));

  -- done, waiting for pickup: staff changed the variant on the day, so the price and balance changed
  b := pg_temp.seed_booking(c3, a_ready, ceramic, cer_scooter,
    'Customer Three', 'customer3@example.test', '09678901234',
    'TKR 7305', 'Yamaha Mio Gear', 'White', 'Stock condition',
    false, NULL, pg_temp.day_at(d_ready - 2, 11), 300, '203.0.113.34');
  SELECT reference_code INTO v_ref FROM bookings WHERE id = b;
  PERFORM pg_temp.seed_status(b, 'in_progress', staff1_id, pg_temp.day_at(d_ready, 8));
  UPDATE bookings SET variant_id = cer_standard, updated_by = staff1_id, updated_at = pg_temp.day_at(d_ready, 8.5) WHERE id = b;
  UPDATE payments SET amount = 2500, remaining_balance = 2200, is_fully_paid = false WHERE booking_id = b;
  PERFORM pg_temp.seed_audit(staff1_id, 'variant_updated', b,
    'Variant changed on booking ' || v_ref || '. Old price: 1500.00, New price: 2500, Remaining: 2200',
    pg_temp.day_at(d_ready, 8.5));
  PERFORM pg_temp.seed_status(b, 'done', staff1_id, pg_temp.day_at(d_ready, 10));

  -- in progress: started today by staff, final price adjusted with a reason
  b := pg_temp.seed_booking(c2, a_powder_now, powder, pow_mags,
    'Customer Two', 'customer2@example.test', '09567890123',
    'PQR 2918', 'Honda Click 160', 'Blue', 'Both mags have small chips',
    false, NULL, pg_temp.day_at(d_powder_now - 3, 15), 300, '203.0.113.45');
  SELECT reference_code INTO v_ref FROM bookings WHERE id = b;
  PERFORM pg_temp.seed_status(b, 'in_progress', staff1_id, pg_temp.day_at(d_powder_now, 8));
  UPDATE payments SET amount = 1500, remaining_balance = 1200 WHERE booking_id = b;
  UPDATE bookings SET updated_by = staff1_id, updated_at = pg_temp.day_at(d_powder_now, 8.5) WHERE id = b;
  PERFORM pg_temp.seed_audit(staff1_id, 'price_adjusted', b,
    'Final price changed on booking ' || v_ref || ': 1200 to 1500. Reason: Extra chipped area on the left mag',
    pg_temp.day_at(d_powder_now, 8.5));

  -- walk-in today with no down payment, nothing paid yet
  b := pg_temp.seed_booking(NULL, a_ready, ceramic, cer_scooter,
    'Rico Santos', NULL, '09171230001',
    'WXY 6612', 'Suzuki Raider 150', 'Black', 'Modified exhaust',
    true, staff1_id, pg_temp.day_at(d_ready, 8), 0, NULL);

  -- unfinished from an earlier day, never started (shows in the carried over part of the staff board)
  b := pg_temp.seed_booking(NULL, a_carried, ceramic, cer_standard,
    'Mark Villanueva', 'mark.villanueva@example.test', '09171230002',
    'LMN 3340', 'Honda ADV 160', 'Gray', 'Scratches on the left side',
    true, staff2_id, pg_temp.day_at(d_carried - 1, 13), 500, NULL);

  -- unfinished from an earlier day, started but not done
  b := pg_temp.seed_booking(c1, a_powder_past, powder, pow_swing,
    'Customer One', 'customer1@example.test', '09456789012',
    'TRB 9051', 'Honda Beat', 'Red', 'Swing arm only',
    false, NULL, pg_temp.day_at(d_powder_past - 4, 9), 300, '203.0.113.21');
  PERFORM pg_temp.seed_status(b, 'in_progress', staff2_id, pg_temp.day_at(d_powder_past, 10));

  -- upcoming online bookings, paid down payment, waiting for their date
  b := pg_temp.seed_booking(c1, a_cer_next1, ceramic, cer_scooter,
    'Customer One', 'customer1@example.test', '09456789012',
    'ABC 1234', 'Honda Click 125', 'Red', 'Stock condition',
    false, NULL, NOW() - INTERVAL '2 days', 300, '203.0.113.21');

  b := pg_temp.seed_booking(c3, a_cer_next2, ceramic, cer_standard,
    'Customer Three', 'customer3@example.test', '09678901234',
    'DEF 5678', 'Yamaha NMAX', 'Silver', 'Needs a polish first',
    false, NULL, NOW() - INTERVAL '1 day', 300, '203.0.113.34');

  b := pg_temp.seed_booking(c2, a_pow_next2, powder, pow_swing,
    'Customer Two', 'customer2@example.test', '09567890123',
    'GHI 9012', 'Honda Beat', 'White', 'Stock',
    false, NULL, NOW() - INTERVAL '1 day', 300, '203.0.113.45');

  -- upcoming walk-in, a down payment is required for a future date
  b := pg_temp.seed_booking(NULL, a_cer_next1, ceramic, cer_big,
    'Angela Cruz', 'angela.cruz@example.test', '09171230003',
    'JKL 3456', 'Kawasaki Z650', 'Orange', 'Full body',
    true, staff1_id, NOW() - INTERVAL '3 hours', 500, NULL);

  -- cancelled by admin, down payment still to be refunded (shows the refund action)
  b := pg_temp.seed_booking(c2, a_pow_next1, powder, pow_mags,
    'Customer Two', 'customer2@example.test', '09567890123',
    'MNO 7890', 'Suzuki Raider', 'Black', 'Mags only',
    false, NULL, NOW() - INTERVAL '4 days', 300, '203.0.113.45');
  SELECT reference_code INTO v_ref FROM bookings WHERE id = b;
  UPDATE bookings SET status = 'cancelled', booking_status = 'cancelled', updated_by = admin_id, updated_at = NOW() - INTERVAL '1 day' WHERE id = b;
  PERFORM pg_temp.seed_audit(admin_id, 'Booking cancelled', b, 'Ref: ' || v_ref, NOW() - INTERVAL '1 day');

  -- cancelled and refunded, the refund is recorded by admin, the money itself is returned in xendit
  b := pg_temp.seed_booking(c1, a_cer_next3, ceramic, cer_standard,
    'Customer One', 'customer1@example.test', '09456789012',
    'PQS 1357', 'Yamaha Aerox', 'Blue', 'Stock',
    false, NULL, NOW() - INTERVAL '5 days', 300, '203.0.113.21');
  SELECT reference_code INTO v_ref FROM bookings WHERE id = b;
  UPDATE bookings SET status = 'cancelled', booking_status = 'cancelled', updated_by = admin_id, updated_at = NOW() - INTERVAL '3 days' WHERE id = b;
  PERFORM pg_temp.seed_audit(admin_id, 'Booking cancelled', b, 'Ref: ' || v_ref, NOW() - INTERVAL '3 days');
  UPDATE payments SET status = 'refunded', refunded_at = NOW() - INTERVAL '2 days', refunded_by = admin_id WHERE booking_id = b;
  PERFORM pg_temp.seed_audit(admin_id, 'Marked as refunded', b,
    'Ref: ' || v_ref || ' | ₱300.00 (recorded only, manual refund in Xendit)', NOW() - INTERVAL '2 days');

  -- expired holds: the customer never paid, the hold ran out and the cron expired it (no payment row, no reference code, no queue number)
  INSERT INTO bookings (
    user_id, service_id, variant_id, availability_id, ip_address,
    booking_status, expires_at, created_at
  ) VALUES (
    NULL, ceramic, cer_standard, a_cer_next2, '203.0.113.77',
    'expired', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes', NOW() - INTERVAL '2 days'
  );

  INSERT INTO bookings (
    user_id, service_id, variant_id, availability_id, ip_address,
    guest_name, guest_email, guest_phone,
    motorcycle_plate, motorcycle_model, motorcycle_color, motorcycle_description,
    booking_status, expires_at, created_at
  ) VALUES (
    c3, powder, pow_mags, a_pow_next1, '203.0.113.34',
    'Customer Three', 'customer3@example.test', '09678901234',
    'STU 2468', 'Honda Click 125', 'Gray', 'Stock',
    'expired', NOW() - INTERVAL '3 days' + INTERVAL '10 minutes', NOW() - INTERVAL '3 days'
  );
END
$seed$;

