-- Seed Data for AByte POS
USE abyte_pos;

-- Default Admin (password: Admin@123)
INSERT IGNORE INTO users (name, email, password_hash, role_id)
VALUES ('Admin', 'admin@pos.com', '$2a$10$8KzaN0XBR.6CkXPKJxGOkOeK5RjMrqFhPcHzGcsFdFvIiwd5I.xoC', 1);

-- Default Manager (password: Manager@123)
INSERT IGNORE INTO users (name, email, password_hash, role_id)
VALUES ('Manager', 'manager@pos.com', '$2a$10$QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abcdefghijklmnop', 2);

-- Default Cashier (password: Cashier@123)
INSERT IGNORE INTO users (name, email, password_hash, role_id)
VALUES ('Cashier', 'cashier@pos.com', '$2a$10$QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abcdefghijklmnop', 3);

-- Categories
INSERT IGNORE INTO categories (category_name) VALUES
  ('General Store'), ('Mobile & Electronics'), ('Pharmacy'), ('Garments');

-- Sample Products
INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) VALUES
  ('Basmati Rice 5kg', 1, 850.00, 50, '8901234560001'),
  ('Flour 10kg', 1, 650.00, 40, '8901234560002'),
  ('Sugar 1kg', 1, 150.00, 100, '8901234560003'),
  ('Cooking Oil 1L', 1, 480.00, 60, '8901234560004'),
  ('iPhone 14', 2, 249999.00, 5, '1901234560005'),
  ('Samsung Galaxy S23', 2, 179999.00, 8, '1901234560006'),
  ('USB-C Charger', 2, 1500.00, 30, '1901234560007'),
  ('Wireless Earbuds', 2, 3500.00, 20, '1901234560008'),
  ('Paracetamol 500mg', 3, 50.00, 200, '2901234560009'),
  ('Antibiotics Strip', 3, 350.00, 80, '2901234560010'),
  ('Bandages Pack', 3, 120.00, 150, '2901234560011'),
  ('Cough Syrup', 3, 180.00, 90, '2901234560012'),
  ('Cotton T-Shirt', 4, 799.00, 45, '3901234560013'),
  ('Denim Jeans', 4, 2499.00, 25, '3901234560014'),
  ('Winter Jacket', 4, 4999.00, 15, '3901234560015'),
  ('Sports Shoes', 4, 3499.00, 20, '3901234560016');

-- Create inventory records for all products
INSERT INTO inventory (product_id, available_stock)
SELECT product_id, stock_quantity FROM products
ON DUPLICATE KEY UPDATE available_stock = VALUES(available_stock);
