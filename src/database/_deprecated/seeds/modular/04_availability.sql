-- 5. AVAILABILITY SEED (next 30 days, Mon-Fri, capacity 3 per service)
INSERT INTO availability (id, service_id, date, capacity, is_open)
SELECT 
  gen_random_uuid(),
  s.id,
  (CURRENT_DATE + offsets.days_offset)::DATE AS date,
  3,
  true
FROM services s
CROSS JOIN (
  SELECT generate_series(1, 30) AS days_offset
) offsets
WHERE 
  EXTRACT(DOW FROM (CURRENT_DATE + offsets.days_offset)::DATE) NOT IN (0, 6)  -- exclude weekends
  AND s.is_active = true
ON CONFLICT (service_id, date) DO NOTHING;