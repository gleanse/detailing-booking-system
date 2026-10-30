-- Current schema, edited in place with every migration
-- Reference only, the source of truth is the migrations folder
-- Full snapshots of each version live in versions/

-- USERS (customers + admin + staff)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255),
  phone VARCHAR(20) NULL,
  password VARCHAR(255), -- null for google oauth customers, required for admin and staff
  role VARCHAR(50) DEFAULT 'customer', -- customer, admin, staff
  active_session_id TEXT, -- single-session login (admin/staff)
  active_session_expires TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SERVICES
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL, -- starting price, estimate only
  deposit_amount DECIMAL(10,2) NOT NULL, -- flat reservation deposit charged at booking, set by admin
  duration_hours INT, -- estimated duration, used for workload estimate
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true, -- soft delete
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_deposit_positive CHECK (deposit_amount > 0)
);

-- SERVICE VARIANTS (by body size or part, price is an estimate until confirmed in shop)
CREATE TABLE service_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_hours INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AVAILABILITY (admin sets capacity per date per service)
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id),
  date DATE NOT NULL,
  capacity INT NOT NULL,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, date)
);

-- CLOSED DATES (recurring days and specific holidays)
CREATE TABLE closed_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'recurring', 'specific'
  day_of_week INT NULL, -- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  date DATE NULL, -- for specific one time closures only
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_closure_type CHECK (
    (type = 'recurring' AND day_of_week IS NOT NULL AND date IS NULL) OR
    (type = 'specific' AND date IS NOT NULL AND day_of_week IS NULL)
  )
);

-- BOOKINGS
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NULL,
  service_id UUID REFERENCES services(id),
  variant_id UUID REFERENCES service_variants(id),
  availability_id UUID REFERENCES availability(id),
  guest_name VARCHAR(255),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(20),
  reference_code VARCHAR(20) UNIQUE,
  queue_number INT,
  motorcycle_plate VARCHAR(100),
  motorcycle_description TEXT,
  motorcycle_color VARCHAR(100),
  motorcycle_model VARCHAR(100),
  is_walkin BOOLEAN DEFAULT false,
  payment_method VARCHAR(50) DEFAULT 'online', -- online, cash
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, done, picked_up
  booking_status VARCHAR(50) DEFAULT 'locked', -- locked, confirmed, expired
  qr_code TEXT,
  expires_at TIMESTAMP,
  ip_address VARCHAR(45),
  updated_by UUID REFERENCES users(id) NULL,
  updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  xendit_invoice_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL, -- estimated total from the booked variant, replaced when staff change the variant or set a final price
  amount_paid DECIMAL(10,2) NOT NULL, -- deposit paid at booking, not changed when the balance is settled at handover
  remaining_balance DECIMAL(10,2) DEFAULT 0, -- balance still owed after the deposit, 0 once settled at handover
  is_fully_paid BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, failed
  payment_attempts INT DEFAULT 0,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  email VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL, -- booking_confirmed, in_progress, done, picked_up, expired
  sent_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NULL,
  action VARCHAR(255) NOT NULL,
  target_table VARCHAR(100),
  target_id UUID,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tracks each booking status change with timestamp
-- Used for displaying status timeline on the booking tracking page
CREATE TABLE booking_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  status VARCHAR(50) NOT NULL, -- confirmed, in_progress, done, picked_up
  changed_by UUID REFERENCES users(id) NULL, -- null if system/webhook
  created_at TIMESTAMP DEFAULT NOW()
);
