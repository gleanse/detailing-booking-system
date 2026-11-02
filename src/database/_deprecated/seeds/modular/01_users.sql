-- 1. USERS SEED (all use password = 'password')
INSERT INTO users (id, name, email, phone, password, role) VALUES
(gen_random_uuid(), 'Admin User', 'admin@gmail.com', '09123456789', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'admin'),
(gen_random_uuid(), 'Staff One', 'staff1@gmail.com', '09234567890', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff'),
(gen_random_uuid(), 'Staff Two', 'staff2@gmail.com', '09345678901', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'staff'),
(gen_random_uuid(), 'Customer One', 'customer1@gmail.com', '09456789012', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer'),
(gen_random_uuid(), 'Customer Two', 'customer2@gmail.com', '09567890123', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer'),
(gen_random_uuid(), 'Customer Three', 'customer3@gmail.com', '09678901234', '$2b$10$ow3xxDLv.wyTDcZ4hAhilOP1czcdPtIdYSU6x8HJqkonCtou9iKje', 'customer');