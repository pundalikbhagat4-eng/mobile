CREATE DATABASE IF NOT EXISTS serein_house
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE serein_house;

CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  module VARCHAR(60) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE guests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(30) NOT NULL,
  id_card_type VARCHAR(60) NULL,
  id_card_reference VARCHAR(120) NULL,
  id_card_attachment VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guests_email_phone (email, phone),
  CONSTRAINT fk_guests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_guests_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_guests_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE room_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  priority TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_guests TINYINT UNSIGNED NOT NULL DEFAULT 2,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_types_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_room_types_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_room_types_price CHECK (base_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE rooms (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  room_type_id INT UNSIGNED NOT NULL,
  floor VARCHAR(30) NULL,
  status ENUM('available','occupied','cleaning','maintenance','inactive') NOT NULL DEFAULT 'available',
  has_wifi TINYINT(1) NOT NULL DEFAULT 1,
  has_ac TINYINT(1) NOT NULL DEFAULT 1,
  has_fridge TINYINT(1) NOT NULL DEFAULT 0,
  bed_configuration VARCHAR(80) NULL,
  has_balcony TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_type FOREIGN KEY (room_type_id) REFERENCES room_types(id),
  CONSTRAINT fk_rooms_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_rooms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE amenity_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE amenities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  unit_label VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_amenity_category_name (category_id, name),
  CONSTRAINT fk_amenities_category FOREIGN KEY (category_id) REFERENCES amenity_categories(id)
) ENGINE=InnoDB;

CREATE TABLE room_amenities (
  room_id INT UNSIGNED NOT NULL,
  amenity_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  notes VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, amenity_id),
  CONSTRAINT fk_room_amenities_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_room_amenities_amenity FOREIGN KEY (amenity_id) REFERENCES amenities(id)
) ENGINE=InnoDB;

CREATE TABLE reservations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_reference VARCHAR(32) NOT NULL UNIQUE,
  guest_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  source ENUM('direct','walk_in','ota','phone','other') NOT NULL DEFAULT 'direct',
  source_name VARCHAR(100) NULL,
  status ENUM('pending','confirmed','checked_in','checked_out','cancelled','no_show') NOT NULL DEFAULT 'pending',
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults TINYINT UNSIGNED NOT NULL DEFAULT 1,
  children TINYINT UNSIGNED NOT NULL DEFAULT 0,
  nightly_rate DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  guest_remarks TEXT NULL,
  staff_remarks TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_guest FOREIGN KEY (guest_id) REFERENCES guests(id),
  CONSTRAINT fk_reservations_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  CONSTRAINT fk_reservations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reservations_dates CHECK (check_out > check_in),
  CONSTRAINT chk_reservations_amounts CHECK (nightly_rate >= 0 AND discount_amount >= 0 AND total_amount >= 0),
  INDEX idx_reservations_stay (room_id, check_in, check_out, status),
  INDEX idx_reservations_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE booking_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT UNSIGNED NOT NULL,
  method ENUM('cash','online','card','bank_transfer','ota','other') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference VARCHAR(120) NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  INDEX idx_payments_paid_at (paid_at)
) ENGINE=InnoDB;

CREATE TABLE guest_notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guest_id INT UNSIGNED NOT NULL,
  reservation_id INT UNSIGNED NULL,
  note TEXT NOT NULL,
  visibility ENUM('staff','guest') NOT NULL DEFAULT 'staff',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_guest_notes_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  CONSTRAINT fk_guest_notes_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  CONSTRAINT fk_guest_notes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE expense_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method ENUM('cash','online','card','bank_transfer','other') NOT NULL DEFAULT 'cash',
  vendor VARCHAR(150) NULL,
  description VARCHAR(500) NOT NULL,
  attachment_path VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_expenses_amount CHECK (amount > 0),
  INDEX idx_expenses_date (expense_date)
) ENGINE=InnoDB;

CREATE TABLE hotel_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE contact_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  message TEXT NULL,
  status ENUM('new','in_progress','resolved') NOT NULL DEFAULT 'new',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_contact_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_user_time (user_id, created_at)
) ENGINE=InnoDB;

INSERT INTO roles (name, description, is_system) VALUES
  ('super_admin', 'Full access to every hotel and system setting', 1),
  ('admin', 'Hotel administration, users, rooms, bookings and finance', 1),
  ('receptionist', 'Guest services, bookings and room status', 1),
  ('housekeeping', 'Room readiness and guest service notes', 1),
  ('guest', 'View own stays and contact hotel staff', 1);

INSERT INTO permissions (permission_key, label, module) VALUES
  ('dashboard.view', 'View dashboard', 'dashboard'),
  ('rooms.view', 'View rooms', 'rooms'),
  ('rooms.create', 'Create rooms and room types', 'rooms'),
  ('rooms.update', 'Update room details and readiness', 'rooms'),
  ('bookings.view', 'View bookings', 'bookings'),
  ('bookings.create', 'Create bookings', 'bookings'),
  ('bookings.update', 'Edit bookings and remarks', 'bookings'),
  ('bookings.delete', 'Cancel bookings', 'bookings'),
  ('guests.view', 'View guest details', 'guests'),
  ('guests.message', 'Communicate with guests', 'guests'),
  ('revenue.view', 'View revenue and reports', 'revenue'),
  ('expenses.manage', 'Manage expenses', 'expenses'),
  ('users.view', 'View team and access', 'users'),
  ('users.create', 'Create team members', 'users'),
  ('users.update', 'Update users and access', 'users'),
  ('settings.manage', 'Manage hotel settings', 'settings'),
  ('audit.view', 'View activity history', 'audit');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name IN ('super_admin','admin');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'receptionist' AND p.permission_key IN (
  'dashboard.view','rooms.view','rooms.update','bookings.view','bookings.create',
  'bookings.update','guests.view','guests.message'
);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'housekeeping' AND p.permission_key IN (
  'dashboard.view','rooms.view','rooms.update','guests.message'
);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'guest' AND p.permission_key IN ('bookings.view','bookings.create','guests.message');

INSERT INTO room_types (name, description, priority, base_price, max_guests) VALUES
  ('Deluxe King', 'A considered room for a comfortable, easy stay.', 1, 4800, 2),
  ('Courtyard Twin', 'Twin beds around the quiet courtyard.', 2, 5200, 2),
  ('Garden Suite', 'A spacious suite with a private garden balcony.', 3, 6400, 3),
  ('Palm Residence', 'A generous garden residence for longer stays.', 4, 8200, 4);

INSERT INTO amenity_categories (name) VALUES ('In-room comforts'), ('Crockery'), ('Bathroom'), ('Technology');
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Ceramic dinner plate', 'pieces' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Side plate', 'pieces' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Cereal bowl', 'pieces' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Tea cup and saucer', 'sets' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Water glass', 'pieces' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Cutlery set', 'sets' FROM amenity_categories WHERE name = 'Crockery';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Electric kettle', 'pieces' FROM amenity_categories WHERE name = 'In-room comforts';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Hair dryer', 'pieces' FROM amenity_categories WHERE name = 'Bathroom';
INSERT INTO amenities (category_id, name, unit_label)
SELECT id, 'Television', 'pieces' FROM amenity_categories WHERE name = 'Technology';

INSERT INTO expense_categories (name) VALUES
  ('Salaries'), ('Laundry'), ('Internet & utilities'), ('Repairs & breakages'),
  ('Food & beverage'), ('Housekeeping supplies'), ('Marketing'), ('Other');

INSERT INTO hotel_settings (setting_key, setting_value) VALUES
  ('hotel.name', 'Serein House'),
  ('hotel.currency', 'INR'),
  ('hotel.check_in_time', '14:00'),
  ('hotel.check_out_time', '11:00'),
  ('hotel.email', 'hello@sereinhouse.in'),
  ('hotel.phone', '+91 832 245 1080');
