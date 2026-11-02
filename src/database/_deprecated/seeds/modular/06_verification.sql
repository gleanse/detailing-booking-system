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