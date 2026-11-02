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
  detailing_service_id UUID;
  ceramic_underbone_id UUID;
  ceramic_std_id UUID;
  powder_small_id UUID;
  powder_medium_id UUID;
  detailing_std_id UUID;
  avail_today_id UUID;
  avail_tomorrow_id UUID;
  avail_nextweek_id UUID;
  avail_future_id UUID;
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
  SELECT id INTO detailing_service_id FROM services WHERE name = 'Detailing';
  
  -- Get variant IDs
  SELECT id INTO ceramic_underbone_id FROM service_variants WHERE name = 'Underbone' AND service_id = ceramic_service_id;
  SELECT id INTO ceramic_std_id FROM service_variants WHERE name = 'Standard' AND service_id = ceramic_service_id;
  SELECT id INTO powder_small_id FROM service_variants WHERE name = 'Small Mags' AND service_id = powder_service_id;
  SELECT id INTO powder_medium_id FROM service_variants WHERE name = 'Medium Mags' AND service_id = powder_service_id;
  SELECT id INTO detailing_std_id FROM service_variants WHERE name = 'Standard' AND service_id = detailing_service_id;
  
  -- Get availability IDs (FIXED: added INTERVAL)
  SELECT id INTO avail_today_id FROM availability WHERE date = CURRENT_DATE AND service_id = ceramic_service_id LIMIT 1;
  SELECT id INTO avail_tomorrow_id FROM availability WHERE date = CURRENT_DATE + INTERVAL '1 day' AND service_id = powder_service_id LIMIT 1;
  SELECT id INTO avail_nextweek_id FROM availability WHERE date = CURRENT_DATE + INTERVAL '7 days' AND service_id = detailing_service_id LIMIT 1;
  SELECT id INTO avail_future_id FROM availability WHERE date = CURRENT_DATE + INTERVAL '14 days' AND service_id = ceramic_service_id LIMIT 1;
  
  -- BOOKINGS SEED (FIXED: all NOW() +/- numbers replaced with INTERVAL)
  INSERT INTO bookings (
    id, user_id, service_id, variant_id, availability_id,
    reference_code, queue_number, motorcycle_plate, motorcycle_model, motorcycle_color, motorcycle_description,
    status, booking_status, payment_method, is_walkin,
    expires_at, created_at
  ) VALUES
  -- Pending/confirmed booking for today
  (
    gen_random_uuid(), customer1_id, ceramic_service_id, ceramic_underbone_id, avail_today_id,
    'HRC-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 1, 'ABC123', 'Honda Click', 'Red', 'Stock condition',
    'pending', 'confirmed', 'online', false,
    NOW() + INTERVAL '1 hour', NOW() - INTERVAL '2 days'
  ),
  -- In-progress booking (started by staff1)
  (
    gen_random_uuid(), customer2_id, powder_service_id, powder_small_id, avail_today_id,
    'HRC-' || TO_CHAR(NOW(), 'YYMMDD') || '-002', 2, 'XYZ789', 'Yamaha Mio', 'Blue', 'With accessories',
    'in_progress', 'confirmed', 'online', false,
    NOW() + INTERVAL '1 hour', NOW() - INTERVAL '1 day'
  ),
  -- Walk-in customer (no user_id) for tomorrow (FIXED: NOW() + 1 → NOW() + INTERVAL '1 day')
  (
    gen_random_uuid(), NULL, detailing_service_id, detailing_std_id, avail_tomorrow_id,
    'HRC-' || TO_CHAR(NOW() + INTERVAL '1 day', 'YYMMDD') || '-001', 1, 'WALK001', 'Suzuki Raider', 'Black', 'Modified exhaust',
    'pending', 'confirmed', 'cash', true,
    NOW() + INTERVAL '1 hour' + INTERVAL '1 day', NOW()
  ),
  -- Completed booking (for history) - from last week (FIXED: NOW() - 7 → NOW() - INTERVAL '7 days')
  (
    gen_random_uuid(), customer1_id, ceramic_service_id, ceramic_std_id, avail_future_id,
    'HRC-' || TO_CHAR(NOW() - INTERVAL '7 days', 'YYMMDD') || '-001', 1, 'DONE123', 'Kawasaki Ninja', 'Green', 'Full fairing',
    'done', 'confirmed', 'online', false,
    NOW() - INTERVAL '7 days' + INTERVAL '1 hour', NOW() - INTERVAL '8 days'
  ),
  -- Another pending booking for next week (FIXED: NOW() + 7 → NOW() + INTERVAL '7 days')
  (
    gen_random_uuid(), customer2_id, powder_service_id, powder_medium_id, avail_nextweek_id,
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
    payment_type, is_fully_paid, status, paid_at, payment_attempts
  )
  SELECT 
    gen_random_uuid(),
    b.id,
    'xendit_' || b.reference_code,
    sv.price,
    CASE 
      WHEN b.motorcycle_plate = 'ABC123' THEN sv.price -- fully paid
      WHEN b.motorcycle_plate = 'XYZ789' THEN sv.price * 0.5 -- downpayment
      WHEN b.motorcycle_plate = 'WALK001' THEN sv.price -- fully paid (cash)
      WHEN b.motorcycle_plate = 'DONE123' THEN sv.price -- fully paid
      WHEN b.motorcycle_plate = 'PEND456' THEN 0 -- not paid yet
      ELSE 0
    END,
    CASE 
      WHEN b.motorcycle_plate = 'ABC123' THEN 0
      WHEN b.motorcycle_plate = 'XYZ789' THEN sv.price * 0.5
      WHEN b.motorcycle_plate = 'WALK001' THEN 0
      WHEN b.motorcycle_plate = 'DONE123' THEN 0
      ELSE sv.price
    END,
    CASE 
      WHEN b.motorcycle_plate = 'XYZ789' THEN 'downpayment'
      ELSE 'full'
    END,
    CASE 
      WHEN b.motorcycle_plate IN ('ABC123', 'WALK001', 'DONE123') THEN true
      WHEN b.motorcycle_plate = 'XYZ789' THEN false
      ELSE false
    END,
    CASE 
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789', 'WALK001', 'DONE123') THEN 'paid'
      ELSE 'unpaid'
    END,
    CASE 
      WHEN b.motorcycle_plate IN ('ABC123', 'XYZ789', 'WALK001', 'DONE123') THEN 
        b.created_at + INTERVAL '10 minutes'
      ELSE NULL
    END,
    1
  FROM bookings b
  JOIN service_variants sv ON b.variant_id = sv.id
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
  
  -- 10. AUDIT LOGS SEED
  -- Admin creates bookings
  INSERT INTO audit_logs (id, user_id, action, target_table, target_id, details, created_at)
  SELECT 
    gen_random_uuid(),
    admin_id,
    'CREATE_BOOKING',
    'bookings',
    b.id,
    jsonb_build_object(
      'reference', b.reference_code,
      'customer', COALESCE(u.email, b.guest_email),
      'service', s.name,
      'variant', sv.name
    ),
    b.created_at
  FROM bookings b
  LEFT JOIN users u ON b.user_id = u.id
  JOIN services s ON b.service_id = s.id
  JOIN service_variants sv ON b.variant_id = sv.id;
  
  -- Status change logs for audit
  INSERT INTO audit_logs (id, user_id, action, target_table, target_id, details, created_at)
  SELECT 
    gen_random_uuid(),
    bsl.changed_by,
    'status_changed_to_' || bsl.status,
    'bookings',
    bsl.booking_id,
    jsonb_build_object(
      'reference', b.reference_code,
      'new_status', bsl.status,
      'old_status', 
        CASE 
          WHEN bsl.status = 'in_progress' THEN 'pending'
          WHEN bsl.status = 'done' THEN 'in_progress'
          ELSE 'confirmed'
        END
    ),
    bsl.created_at
  FROM booking_status_logs bsl
  JOIN bookings b ON bsl.booking_id = b.id
  WHERE bsl.status IN ('confirmed', 'in_progress', 'done');
  
END $$;