-- 2. SERVICES SEED
INSERT INTO services (id, name, description, price, duration_hours, image_url, is_active) VALUES
(gen_random_uuid(), 'Ceramic Coating', 'Professional ceramic coating for long-lasting paint protection and shine.', 1500.00, 3, 'https://placehold.co/400x200?text=Ceramic+Coating', true),
(gen_random_uuid(), 'Powder Coating', 'Durable powder coating for mags and metal parts with color customization.', 800.00, 4, 'https://placehold.co/400x200?text=Powder+Coating', true),
(gen_random_uuid(), 'Detailing', 'Full paint correction and buffing service from matte to glossy finish.', 500.00, 2, 'https://placehold.co/400x200?text=Detailing', true);

-- 3. SERVICE VARIANTS SEED
-- Ceramic Coating variants
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Underbone', 1500.00, 2, true FROM services s WHERE s.name = 'Ceramic Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Standard', 2500.00, 3, true FROM services s WHERE s.name = 'Ceramic Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Big Bike', 4000.00, 4, true FROM services s WHERE s.name = 'Ceramic Coating';

-- Powder Coating variants
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Small Mags', 800.00, 3, true FROM services s WHERE s.name = 'Powder Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Medium Mags', 1200.00, 4, true FROM services s WHERE s.name = 'Powder Coating';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Large Mags', 1800.00, 5, true FROM services s WHERE s.name = 'Powder Coating';

-- Detailing variants
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Underbone', 500.00, 1, true FROM services s WHERE s.name = 'Detailing';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Standard', 800.00, 2, true FROM services s WHERE s.name = 'Detailing';
INSERT INTO service_variants (id, service_id, name, price, duration_hours, is_active)
SELECT gen_random_uuid(), s.id, 'Big Bike', 1200.00, 3, true FROM services s WHERE s.name = 'Detailing';