-- =============================================================
-- Migration 001: Initial tenant schema
-- Applied to every new tenant database at creation time.
-- Covers: users, employees, departments, products, inventory,
--         sales_orders, invoices, vendors, purchases,
--         projects, assets, audit_log, migration tracker.
-- =============================================================

-- ─────────────────────────────────────────
-- MIGRATION TRACKER (must be table #1)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS _migrations (
    id             INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    migration_name VARCHAR(255)  NOT NULL UNIQUE,
    applied_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum       CHAR(64)      NULL        -- SHA-256 of migration file content
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(150)  NOT NULL UNIQUE,
    code        VARCHAR(20)   NOT NULL UNIQUE,
    manager_id  INT UNSIGNED  NULL,          -- FK set after users table created
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- ROLES (RBAC)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(80)   NOT NULL UNIQUE,
    permissions JSON          NULL,          -- JSON array of permission strings
    is_system   TINYINT(1)    NOT NULL DEFAULT 0,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (name, permissions, is_system) VALUES
('Super Admin',  '["*"]',                                                          1),
('Admin',        '["users.*","employees.*","finance.*","inventory.*","reports.*"]', 1),
('Manager',      '["employees.read","inventory.*","sales.*","reports.read"]',       1),
('Accountant',   '["finance.*","invoices.*","purchases.*","reports.read"]',         1),
('Staff',        '["sales.create","inventory.read"]',                               1);


-- ─────────────────────────────────────────
-- USERS (tenant-level auth)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED  NOT NULL,  -- logical filter; same as tenant, for row-level safety
    role_id         INT UNSIGNED  NOT NULL,
    department_id   INT UNSIGNED  NULL,
    username        VARCHAR(100)  NOT NULL UNIQUE,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    full_name       VARCHAR(200)  NOT NULL,
    phone           VARCHAR(30)   NULL,
    avatar_url      VARCHAR(500)  NULL,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    last_login_at   TIMESTAMP     NULL,
    mfa_secret      VARCHAR(100)  NULL,       -- TOTP secret (base32-encoded)
    mfa_enabled     TINYINT(1)    NOT NULL DEFAULT 0,
    failed_logins   TINYINT       NOT NULL DEFAULT 0,
    locked_until    TIMESTAMP     NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email     (email),
    INDEX idx_active    (is_active),
    INDEX idx_role      (role_id),
    INDEX idx_dept      (department_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id)
        REFERENCES roles(id),
    CONSTRAINT fk_users_dept FOREIGN KEY (department_id)
        REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Now add the FK from departments to users (manager)
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_manager
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────
-- EMPLOYEES (HR profile linked to user)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    user_id         INT UNSIGNED  NULL UNIQUE,   -- NULL = employee without system login
    department_id   INT UNSIGNED  NOT NULL,
    employee_code   VARCHAR(50)   NOT NULL UNIQUE,
    full_name       VARCHAR(200)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    phone           VARCHAR(30)   NULL,
    address         TEXT          NULL,
    national_id     VARCHAR(50)   NULL,
    date_of_birth   DATE          NULL,
    gender          ENUM('male','female','other') NULL,
    hire_date       DATE          NOT NULL,
    end_date        DATE          NULL,
    position        VARCHAR(100)  NULL,
    employment_type ENUM('full_time','part_time','contract','intern') NOT NULL DEFAULT 'full_time',
    salary          DECIMAL(14,2) NOT NULL DEFAULT 0,
    salary_currency VARCHAR(3)   NOT NULL DEFAULT 'PKR',
    bank_account    VARCHAR(100)  NULL,
    bank_name       VARCHAR(100)  NULL,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_code      (employee_code),
    INDEX idx_dept      (department_id),
    INDEX idx_active    (is_active),
    CONSTRAINT fk_emp_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_dept FOREIGN KEY (department_id)
        REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- PRODUCT CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
    id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    parent_id   INT UNSIGNED  NULL,
    name        VARCHAR(150)  NOT NULL,
    code        VARCHAR(30)   NULL UNIQUE,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_parent (parent_id),
    CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id)
        REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- PRODUCTS / ITEMS / SKUs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id              INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
    category_id     INT UNSIGNED    NULL,
    sku             VARCHAR(100)    NOT NULL UNIQUE,
    barcode         VARCHAR(100)    NULL UNIQUE,
    name            VARCHAR(300)    NOT NULL,
    description     TEXT            NULL,
    unit            VARCHAR(30)     NOT NULL DEFAULT 'pcs',   -- pcs, kg, ltr, box...
    cost_price      DECIMAL(14,4)   NOT NULL DEFAULT 0,
    sale_price      DECIMAL(14,4)   NOT NULL DEFAULT 0,
    tax_rate        DECIMAL(6,4)    NOT NULL DEFAULT 0,       -- 0.17 = 17%
    has_variants    TINYINT(1)      NOT NULL DEFAULT 0,
    track_inventory TINYINT(1)      NOT NULL DEFAULT 1,
    min_stock_level INT             NOT NULL DEFAULT 0,
    max_stock_level INT             NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    created_by      INT UNSIGNED    NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FULLTEXT INDEX ft_name_desc (name, description),
    INDEX idx_sku        (sku),
    INDEX idx_category   (category_id),
    INDEX idx_active     (is_active),
    CONSTRAINT fk_prod_cat FOREIGN KEY (category_id)
        REFERENCES product_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_prod_creator FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- WAREHOUSES / LOCATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
    id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(150)  NOT NULL,
    code        VARCHAR(20)   NOT NULL UNIQUE,
    address     TEXT          NULL,
    manager_id  INT UNSIGNED  NULL,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_active (is_active),
    CONSTRAINT fk_wh_manager FOREIGN KEY (manager_id)
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- INVENTORY (stock per warehouse)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    product_id      INT UNSIGNED  NOT NULL,
    warehouse_id    INT UNSIGNED  NOT NULL,
    qty_on_hand     DECIMAL(14,4) NOT NULL DEFAULT 0,
    qty_reserved    DECIMAL(14,4) NOT NULL DEFAULT 0,   -- committed to open orders
    qty_available   DECIMAL(14,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) VIRTUAL,
    last_counted_at TIMESTAMP     NULL,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_product_warehouse (product_id, warehouse_id),
    INDEX idx_product   (product_id),
    INDEX idx_warehouse (warehouse_id),
    CONSTRAINT fk_inv_product   FOREIGN KEY (product_id)   REFERENCES products(id)   ON DELETE CASCADE,
    CONSTRAINT fk_inv_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- INVENTORY MOVEMENTS (ledger)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
    id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    product_id      INT UNSIGNED     NOT NULL,
    warehouse_id    INT UNSIGNED     NOT NULL,
    movement_type   ENUM('purchase_receipt','sale_shipment','transfer_in','transfer_out',
                         'adjustment_add','adjustment_remove','return_in','return_out',
                         'opening_stock','write_off') NOT NULL,
    reference_type  VARCHAR(50)      NULL,   -- 'sales_order','purchase_order','transfer'
    reference_id    INT UNSIGNED     NULL,
    qty             DECIMAL(14,4)    NOT NULL,  -- always positive; type determines direction
    qty_before      DECIMAL(14,4)    NOT NULL DEFAULT 0,
    qty_after       DECIMAL(14,4)    NOT NULL DEFAULT 0,
    unit_cost       DECIMAL(14,4)    NULL,
    notes           VARCHAR(500)     NULL,
    created_by      INT UNSIGNED     NULL,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_product   (product_id),
    INDEX idx_warehouse (warehouse_id),
    INDEX idx_ref       (reference_type, reference_id),
    INDEX idx_created   (created_at),
    CONSTRAINT fk_im_product   FOREIGN KEY (product_id)   REFERENCES products(id),
    CONSTRAINT fk_im_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_im_creator   FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- VENDORS / SUPPLIERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    code            VARCHAR(30)   NOT NULL UNIQUE,
    company_name    VARCHAR(200)  NOT NULL,
    contact_person  VARCHAR(150)  NULL,
    email           VARCHAR(255)  NULL,
    phone           VARCHAR(30)   NULL,
    address         TEXT          NULL,
    tax_id          VARCHAR(50)   NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'PKR',
    credit_days     TINYINT UNSIGNED NOT NULL DEFAULT 30,
    credit_limit    DECIMAL(14,2) NOT NULL DEFAULT 0,
    outstanding_bal DECIMAL(14,2) NOT NULL DEFAULT 0,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    notes           TEXT          NULL,
    created_by      INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_code   (code),
    INDEX idx_active (is_active),
    FULLTEXT INDEX ft_vendor_name (company_name),
    CONSTRAINT fk_vendor_creator FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    code            VARCHAR(30)   NOT NULL UNIQUE,
    full_name       VARCHAR(200)  NOT NULL,
    company_name    VARCHAR(200)  NULL,
    email           VARCHAR(255)  NULL,
    phone           VARCHAR(30)   NULL,
    address         TEXT          NULL,
    tax_id          VARCHAR(50)   NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'PKR',
    credit_days     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    credit_limit    DECIMAL(14,2) NOT NULL DEFAULT 0,
    outstanding_bal DECIMAL(14,2) NOT NULL DEFAULT 0,
    loyalty_points  INT           NOT NULL DEFAULT 0,
    assigned_to     INT UNSIGNED  NULL,     -- sales rep
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_code      (code),
    INDEX idx_active    (is_active),
    INDEX idx_assigned  (assigned_to),
    FULLTEXT INDEX ft_customer_name (full_name, company_name),
    CONSTRAINT fk_cust_rep FOREIGN KEY (assigned_to)
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- PURCHASE ORDERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    po_number       VARCHAR(50)   NOT NULL UNIQUE,
    vendor_id       INT UNSIGNED  NOT NULL,
    warehouse_id    INT UNSIGNED  NOT NULL,
    status          ENUM('draft','confirmed','partially_received',
                         'received','invoiced','closed','cancelled') NOT NULL DEFAULT 'draft',
    order_date      DATE          NOT NULL,
    expected_date   DATE          NULL,
    received_date   DATE          NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'PKR',
    exchange_rate   DECIMAL(14,6) NOT NULL DEFAULT 1,
    subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes           TEXT          NULL,
    created_by      INT UNSIGNED  NULL,
    approved_by     INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vendor    (vendor_id),
    INDEX idx_status    (status),
    INDEX idx_date      (order_date),
    CONSTRAINT fk_po_vendor    FOREIGN KEY (vendor_id)    REFERENCES vendors(id),
    CONSTRAINT fk_po_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_po_creator   FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_po_approver  FOREIGN KEY (approved_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS purchase_items (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    purchase_id     INT UNSIGNED  NOT NULL,
    product_id      INT UNSIGNED  NOT NULL,
    qty_ordered     DECIMAL(14,4) NOT NULL,
    qty_received    DECIMAL(14,4) NOT NULL DEFAULT 0,
    unit_cost       DECIMAL(14,4) NOT NULL,
    tax_rate        DECIMAL(6,4)  NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,4) NOT NULL DEFAULT 0,
    line_total      DECIMAL(14,4) NOT NULL DEFAULT 0,

    INDEX idx_purchase (purchase_id),
    INDEX idx_product  (product_id),
    CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_product  FOREIGN KEY (product_id)  REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- SALES ORDERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    order_number    VARCHAR(50)   NOT NULL UNIQUE,
    customer_id     INT UNSIGNED  NOT NULL,
    warehouse_id    INT UNSIGNED  NOT NULL,
    assigned_to     INT UNSIGNED  NULL,
    status          ENUM('draft','confirmed','picking','shipped',
                         'delivered','invoiced','cancelled','returned') NOT NULL DEFAULT 'draft',
    order_date      DATE          NOT NULL,
    delivery_date   DATE          NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'PKR',
    exchange_rate   DECIMAL(14,6) NOT NULL DEFAULT 1,
    subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
    shipping_charge DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
    paid_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
    balance_due     DECIMAL(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) VIRTUAL,
    shipping_address TEXT          NULL,
    notes           TEXT          NULL,
    created_by      INT UNSIGNED  NULL,
    approved_by     INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_customer  (customer_id),
    INDEX idx_status    (status),
    INDEX idx_date      (order_date),
    INDEX idx_assigned  (assigned_to),
    CONSTRAINT fk_so_customer  FOREIGN KEY (customer_id)  REFERENCES customers(id),
    CONSTRAINT fk_so_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_so_assigned  FOREIGN KEY (assigned_to)  REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_so_creator   FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_so_approver  FOREIGN KEY (approved_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS sales_order_items (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    order_id        INT UNSIGNED  NOT NULL,
    product_id      INT UNSIGNED  NOT NULL,
    qty_ordered     DECIMAL(14,4) NOT NULL,
    qty_shipped     DECIMAL(14,4) NOT NULL DEFAULT 0,
    unit_price      DECIMAL(14,4) NOT NULL,
    discount_pct    DECIMAL(6,4)  NOT NULL DEFAULT 0,
    tax_rate        DECIMAL(6,4)  NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,4) NOT NULL DEFAULT 0,
    line_total      DECIMAL(14,4) NOT NULL DEFAULT 0,

    INDEX idx_order   (order_id),
    INDEX idx_product (product_id),
    CONSTRAINT fk_soi_order   FOREIGN KEY (order_id)   REFERENCES sales_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_soi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- INVOICES (AR — accounts receivable)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    invoice_number  VARCHAR(50)   NOT NULL UNIQUE,
    order_id        INT UNSIGNED  NULL,       -- linked sales order (optional)
    customer_id     INT UNSIGNED  NOT NULL,
    status          ENUM('draft','sent','partial','paid','overdue','cancelled','void') NOT NULL DEFAULT 'draft',
    issue_date      DATE          NOT NULL,
    due_date        DATE          NOT NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'PKR',
    subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
    paid_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
    balance_due     DECIMAL(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) VIRTUAL,
    notes           TEXT          NULL,
    pdf_url         VARCHAR(500)  NULL,
    created_by      INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_customer (customer_id),
    INDEX idx_status   (status),
    INDEX idx_due      (due_date),
    INDEX idx_order    (order_id),
    CONSTRAINT fk_inv_order    FOREIGN KEY (order_id)    REFERENCES sales_orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_inv_creator  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS invoice_items (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    invoice_id      INT UNSIGNED  NOT NULL,
    product_id      INT UNSIGNED  NULL,
    description     VARCHAR(500)  NOT NULL,
    qty             DECIMAL(14,4) NOT NULL DEFAULT 1,
    unit_price      DECIMAL(14,4) NOT NULL,
    discount_pct    DECIMAL(6,4)  NOT NULL DEFAULT 0,
    tax_rate        DECIMAL(6,4)  NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(14,4) NOT NULL DEFAULT 0,
    line_total      DECIMAL(14,4) NOT NULL DEFAULT 0,

    INDEX idx_invoice (invoice_id),
    CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_ii_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- PAYMENTS against invoices
CREATE TABLE IF NOT EXISTS payments (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    invoice_id      INT UNSIGNED  NOT NULL,
    payment_date    DATE          NOT NULL,
    amount          DECIMAL(14,2) NOT NULL,
    method          ENUM('cash','bank_transfer','cheque','card','online') NOT NULL DEFAULT 'cash',
    reference_no    VARCHAR(100)  NULL,
    notes           VARCHAR(500)  NULL,
    received_by     INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_invoice (invoice_id),
    INDEX idx_date    (payment_date),
    CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_pay_user    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    code            VARCHAR(30)   NOT NULL UNIQUE,
    name            VARCHAR(300)  NOT NULL,
    customer_id     INT UNSIGNED  NULL,
    manager_id      INT UNSIGNED  NULL,
    status          ENUM('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
    start_date      DATE          NOT NULL,
    end_date        DATE          NULL,
    budget          DECIMAL(16,2) NOT NULL DEFAULT 0,
    spent           DECIMAL(16,2) NOT NULL DEFAULT 0,
    progress_pct    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    description     TEXT          NULL,
    created_by      INT UNSIGNED  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status   (status),
    INDEX idx_customer (customer_id),
    INDEX idx_manager  (manager_id),
    CONSTRAINT fk_proj_customer FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE SET NULL,
    CONSTRAINT fk_proj_manager  FOREIGN KEY (manager_id)  REFERENCES users(id)      ON DELETE SET NULL,
    CONSTRAINT fk_proj_creator  FOREIGN KEY (created_by)  REFERENCES users(id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS project_members (
    project_id      INT UNSIGNED  NOT NULL,
    user_id         INT UNSIGNED  NOT NULL,
    role_in_project VARCHAR(80)   NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pm_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS project_tasks (
    id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    project_id      INT UNSIGNED  NOT NULL,
    parent_task_id  INT UNSIGNED  NULL,
    title           VARCHAR(300)  NOT NULL,
    description     TEXT          NULL,
    assigned_to     INT UNSIGNED  NULL,
    status          ENUM('todo','in_progress','review','done','cancelled') NOT NULL DEFAULT 'todo',
    priority        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    due_date        DATE          NULL,
    estimated_hours DECIMAL(8,2)  NULL,
    actual_hours    DECIMAL(8,2)  NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_project  (project_id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_status   (status),
    CONSTRAINT fk_pt_project  FOREIGN KEY (project_id)    REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pt_parent   FOREIGN KEY (parent_task_id) REFERENCES project_tasks(id) ON DELETE SET NULL,
    CONSTRAINT fk_pt_assigned FOREIGN KEY (assigned_to)   REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- FIXED ASSETS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id                  INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    asset_code          VARCHAR(50)   NOT NULL UNIQUE,
    name                VARCHAR(200)  NOT NULL,
    category            VARCHAR(100)  NULL,
    location            VARCHAR(200)  NULL,
    assigned_to         INT UNSIGNED  NULL,
    status              ENUM('active','maintenance','disposed','lost') NOT NULL DEFAULT 'active',
    purchase_date       DATE          NULL,
    purchase_cost       DECIMAL(14,2) NOT NULL DEFAULT 0,
    current_value       DECIMAL(14,2) NOT NULL DEFAULT 0,
    depreciation_method ENUM('straight_line','reducing_balance','none') NOT NULL DEFAULT 'straight_line',
    useful_life_years   TINYINT       NULL,
    salvage_value       DECIMAL(14,2) NOT NULL DEFAULT 0,
    depreciation_rate   DECIMAL(6,4)  NULL,
    serial_number       VARCHAR(100)  NULL,
    warranty_expiry     DATE          NULL,
    notes               TEXT          NULL,
    created_by          INT UNSIGNED  NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status    (status),
    INDEX idx_assigned  (assigned_to),
    INDEX idx_category  (category),
    CONSTRAINT fk_asset_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE SET NULL,
    CONSTRAINT fk_asset_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- TENANT AUDIT LOG
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    user_id         INT UNSIGNED     NULL,
    action          VARCHAR(100)     NOT NULL,
    table_name      VARCHAR(100)     NULL,
    record_id       INT UNSIGNED     NULL,
    old_values      JSON             NULL,
    new_values      JSON             NULL,
    ip_address      VARCHAR(45)      NULL,
    user_agent      VARCHAR(500)     NULL,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user      (user_id),
    INDEX idx_action    (action),
    INDEX idx_table     (table_name, record_id),
    INDEX idx_created   (created_at),
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- SETTINGS (key-value store per tenant)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    `key`       VARCHAR(100)  NOT NULL UNIQUE,
    value       TEXT          NULL,
    data_type   ENUM('string','integer','boolean','json') NOT NULL DEFAULT 'string',
    description VARCHAR(500)  NULL,
    updated_by  INT UNSIGNED  NULL,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (`key`, value, data_type, description) VALUES
('company_name',       NULL,    'string',  'Company display name'),
('base_currency',      'PKR',   'string',  'Default currency code'),
('fiscal_year_start',  '01-01', 'string',  'MM-DD format'),
('invoice_prefix',     'INV-',  'string',  'Invoice number prefix'),
('po_prefix',          'PO-',   'string',  'Purchase order prefix'),
('so_prefix',          'SO-',   'string',  'Sales order prefix'),
('low_stock_alerts',   'true',  'boolean', 'Email alerts when stock < min level'),
('tax_number',         NULL,    'string',  'Company tax registration number');


-- ─────────────────────────────────────────
-- MARK THIS MIGRATION AS APPLIED
-- ─────────────────────────────────────────
INSERT IGNORE INTO _migrations (migration_name, applied_at)
VALUES ('001_initial_schema.sql', NOW());
