-- ============================================================
-- INVENTORY MODULE COMPLETE MIGRATION
-- Run this in your MariaDB/MySQL client or via CLI:
--   mysql -u root -p abyte_pos < migration_inventory_complete.sql
-- ============================================================

-- 1. Update product_type ENUM (add semi_finished)
ALTER TABLE products
  MODIFY COLUMN product_type ENUM('finished_good','raw_material','semi_finished') NOT NULL DEFAULT 'finished_good';

-- 2. Add avg_cost to inventory table
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(15,4) NOT NULL DEFAULT 0;

-- 3. Add additional_charges to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS additional_charges DECIMAL(15,2) DEFAULT 0,
  MODIFY COLUMN total_amount DECIMAL(15,2) NOT NULL;

-- 4. Add extra columns to products if missing
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_stock_level INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;

-- ============================================================
-- NEW TABLES
-- ============================================================

-- 5. Sections (departments for stock issuance)
CREATE TABLE IF NOT EXISTS sections (
  section_id   INT PRIMARY KEY AUTO_INCREMENT,
  section_name VARCHAR(100) NOT NULL,
  description  TEXT,
  is_active    TINYINT DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Stock Issues (issue stock to a section)
CREATE TABLE IF NOT EXISTS stock_issues (
  issue_id     INT PRIMARY KEY AUTO_INCREMENT,
  issue_number VARCHAR(30) NOT NULL UNIQUE,
  section_id   INT NOT NULL,
  issue_date   DATE NOT NULL,
  notes        TEXT,
  status       ENUM('draft','issued') DEFAULT 'issued',
  created_by   INT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(section_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS stock_issue_items (
  item_id    INT PRIMARY KEY AUTO_INCREMENT,
  issue_id   INT NOT NULL,
  product_id INT NOT NULL,
  quantity   DECIMAL(10,3) NOT NULL,
  unit_cost  DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (issue_id)   REFERENCES stock_issues(issue_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 7. Stock Issue Returns (return from section back to warehouse)
CREATE TABLE IF NOT EXISTS stock_issue_returns (
  return_id     INT PRIMARY KEY AUTO_INCREMENT,
  return_number VARCHAR(30) NOT NULL UNIQUE,
  section_id    INT NOT NULL,
  return_date   DATE NOT NULL,
  notes         TEXT,
  created_by    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(section_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS stock_issue_return_items (
  item_id    INT PRIMARY KEY AUTO_INCREMENT,
  return_id  INT NOT NULL,
  product_id INT NOT NULL,
  quantity   DECIMAL(10,3) NOT NULL,
  FOREIGN KEY (return_id)  REFERENCES stock_issue_returns(return_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 8. Raw Sales (direct raw material sales)
CREATE TABLE IF NOT EXISTS raw_sales (
  sale_id       INT PRIMARY KEY AUTO_INCREMENT,
  sale_number   VARCHAR(30) NOT NULL UNIQUE,
  section_id    INT,
  customer_name VARCHAR(100),
  sale_date     DATE NOT NULL,
  total_amount  DECIMAL(10,2) DEFAULT 0,
  notes         TEXT,
  created_by    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(section_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS raw_sale_items (
  item_id     INT PRIMARY KEY AUTO_INCREMENT,
  sale_id     INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    DECIMAL(10,3) NOT NULL,
  unit_price  DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES raw_sales(sale_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 9. Purchase Vouchers / GRN (Goods Received Notes)
CREATE TABLE IF NOT EXISTS inv_purchase_vouchers (
  pv_id         INT PRIMARY KEY AUTO_INCREMENT,
  pv_number     VARCHAR(30) NOT NULL UNIQUE,
  po_id         INT,
  supplier_id   INT,
  voucher_date  DATE NOT NULL,
  total_amount  DECIMAL(15,2) DEFAULT 0,
  notes         TEXT,
  created_by    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id)       REFERENCES purchase_orders(po_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  FOREIGN KEY (created_by)  REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS inv_purchase_voucher_items (
  item_id           INT PRIMARY KEY AUTO_INCREMENT,
  pv_id             INT NOT NULL,
  product_id        INT NOT NULL,
  quantity_received DECIMAL(10,3) NOT NULL,
  unit_price        DECIMAL(10,2) NOT NULL,
  total_price       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pv_id)      REFERENCES inv_purchase_vouchers(pv_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 10. Purchase Returns (return goods to supplier)
CREATE TABLE IF NOT EXISTS purchase_returns (
  pr_id         INT PRIMARY KEY AUTO_INCREMENT,
  pr_number     VARCHAR(30) NOT NULL UNIQUE,
  pv_id         INT,
  supplier_id   INT,
  return_date   DATE NOT NULL,
  total_amount  DECIMAL(15,2) DEFAULT 0,
  notes         TEXT,
  created_by    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pv_id)       REFERENCES inv_purchase_vouchers(pv_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  FOREIGN KEY (created_by)  REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  item_id           INT PRIMARY KEY AUTO_INCREMENT,
  pr_id             INT NOT NULL,
  product_id        INT NOT NULL,
  quantity_returned DECIMAL(10,3) NOT NULL,
  unit_price        DECIMAL(10,2) NOT NULL,
  total_price       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pr_id)      REFERENCES purchase_returns(pr_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 11. Stock Layers (FIFO cost tracking per product)
CREATE TABLE IF NOT EXISTS stock_layers (
  layer_id      INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  pv_id         INT NULL,
  source_type   ENUM('purchase','opening','adjustment') NOT NULL DEFAULT 'purchase',
  ref_date      DATE NOT NULL,
  qty_original  DECIMAL(15,3) NOT NULL,
  qty_remaining DECIMAL(15,3) NOT NULL,
  unit_cost     DECIMAL(15,4) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sl_product (product_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Opening Stock Entries history
CREATE TABLE IF NOT EXISTS opening_stock_entries (
  entry_id   INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity   DECIMAL(15,3) NOT NULL,
  unit_cost  DECIMAL(15,4) NOT NULL DEFAULT 0,
  entry_date DATE NOT NULL,
  notes      VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Initialize avg_cost from existing cost_price data
-- ============================================================
UPDATE inventory i
  JOIN products p ON i.product_id = p.product_id
  SET i.avg_cost = COALESCE(p.cost_price, 0)
  WHERE i.avg_cost = 0 AND p.cost_price > 0;

SELECT 'Migration complete! All inventory tables created.' AS result;
