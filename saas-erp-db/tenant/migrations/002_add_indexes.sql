-- =============================================================
-- Migration 002: Performance indexes
-- Adds composite + covering indexes for the most common
-- query patterns across the ERP modules.
-- Safe to re-run: all use CREATE INDEX IF NOT EXISTS
-- =============================================================

-- ─────────────────────────────────────────
-- INVENTORY — stock availability lookups
-- ─────────────────────────────────────────
-- "Show all products low on stock in warehouse X"
CREATE INDEX IF NOT EXISTS idx_inv_low_stock
    ON inventory (warehouse_id, qty_on_hand);

-- ─────────────────────────────────────────
-- INVENTORY MOVEMENTS — date-range reports
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_im_product_date
    ON inventory_movements (product_id, created_at);

CREATE INDEX IF NOT EXISTS idx_im_type_date
    ON inventory_movements (movement_type, created_at);

-- ─────────────────────────────────────────
-- SALES ORDERS — dashboard / reporting
-- ─────────────────────────────────────────
-- "Open orders for customer X in date range"
CREATE INDEX IF NOT EXISTS idx_so_customer_status_date
    ON sales_orders (customer_id, status, order_date);

-- "Orders assigned to salesperson"
CREATE INDEX IF NOT EXISTS idx_so_assigned_status
    ON sales_orders (assigned_to, status);

-- Covering index for revenue report (avoids heap fetch)
CREATE INDEX IF NOT EXISTS idx_so_date_amounts
    ON sales_orders (order_date, status, total_amount, paid_amount);

-- ─────────────────────────────────────────
-- INVOICES — AR aging / overdue alerts
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_customer_due_status
    ON invoices (customer_id, due_date, status);

CREATE INDEX IF NOT EXISTS idx_inv_overdue
    ON invoices (status, due_date, balance_due);

-- ─────────────────────────────────────────
-- PURCHASES — AP aging
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_po_vendor_status_date
    ON purchases (vendor_id, status, order_date);

-- ─────────────────────────────────────────
-- EMPLOYEES — HR lookups
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_emp_dept_active
    ON employees (department_id, is_active);

-- ─────────────────────────────────────────
-- PRODUCTS — search & category listing
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prod_category_active
    ON products (category_id, is_active);

-- ─────────────────────────────────────────
-- AUDIT LOG — time-range + entity queries
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_al_table_record_date
    ON audit_log (table_name, record_id, created_at);

-- ─────────────────────────────────────────
-- PROJECTS — status + manager dashboard
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proj_manager_status
    ON projects (manager_id, status);

CREATE INDEX IF NOT EXISTS idx_pt_due_status
    ON project_tasks (due_date, status);

-- ─────────────────────────────────────────
-- ASSETS — assigned + status
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asset_assigned_status
    ON assets (assigned_to, status);

-- ─────────────────────────────────────────
-- MARK MIGRATION APPLIED
-- ─────────────────────────────────────────
INSERT IGNORE INTO _migrations (migration_name, applied_at)
VALUES ('002_add_indexes.sql', NOW());
