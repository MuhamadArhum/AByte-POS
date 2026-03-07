-- =============================================================
-- erp_master.sql
-- Master control-plane database for multi-tenant SaaS ERP
-- Purpose: tracks companies, credentials, migrations, backups,
--          alerts, and connection metadata for every tenant.
-- Run once on the master MariaDB server.
-- =============================================================

CREATE DATABASE IF NOT EXISTS erp_master
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE erp_master;

-- ─────────────────────────────────────────
-- 1. COMPANIES (one row per tenant)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id              INT UNSIGNED     PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(200)     NOT NULL,
    slug            VARCHAR(100)     NOT NULL UNIQUE,   -- URL-safe short name, e.g. "acme-corp"
    db_name         VARCHAR(100)     NOT NULL UNIQUE,   -- e.g. "erp_tenant_acme"
    db_host         VARCHAR(255)     NOT NULL DEFAULT 'localhost',
    db_port         SMALLINT UNSIGNED NOT NULL DEFAULT 3306,
    db_user         VARCHAR(100)     NOT NULL,
    db_password     VARCHAR(255)     NOT NULL,          -- store AES-256 encrypted in prod
    plan            ENUM('starter','growth','enterprise') NOT NULL DEFAULT 'starter',
    max_users       SMALLINT UNSIGNED NOT NULL DEFAULT 10,
    is_active       TINYINT(1)       NOT NULL DEFAULT 1,
    owner_email     VARCHAR(255)     NOT NULL,
    timezone        VARCHAR(60)      NOT NULL DEFAULT 'Asia/Karachi',
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    suspended_at    TIMESTAMP        NULL,
    notes           TEXT             NULL,

    INDEX idx_slug     (slug),
    INDEX idx_active   (is_active),
    INDEX idx_plan     (plan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- 2. GLOBAL MIGRATION TRACKING
--    Which migration file has been applied to each tenant
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_migrations (
    id              INT UNSIGNED     PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED     NOT NULL,
    migration_name  VARCHAR(255)     NOT NULL,   -- e.g. "001_initial_schema.sql"
    applied_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by      VARCHAR(100)     NOT NULL DEFAULT 'system',
    checksum        CHAR(64)         NULL,        -- SHA-256 of the migration file

    UNIQUE KEY uq_company_migration (company_id, migration_name),
    INDEX idx_company   (company_id),
    CONSTRAINT fk_tm_company FOREIGN KEY (company_id)
        REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- 3. BACKUP LOG
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_logs (
    id              INT UNSIGNED     PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED     NOT NULL,
    backup_file     VARCHAR(500)     NOT NULL,
    file_size_bytes BIGINT UNSIGNED  NULL,
    backup_type     ENUM('full','incremental') NOT NULL DEFAULT 'full',
    status          ENUM('running','success','failed') NOT NULL DEFAULT 'running',
    started_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at     TIMESTAMP        NULL,
    duration_sec    INT UNSIGNED     NULL,
    error_message   TEXT             NULL,
    retention_days  TINYINT UNSIGNED NOT NULL DEFAULT 30,

    INDEX idx_company   (company_id),
    INDEX idx_status    (status),
    INDEX idx_started   (started_at),
    CONSTRAINT fk_bl_company FOREIGN KEY (company_id)
        REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- 4. MONITORING ALERTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id              INT UNSIGNED     PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED     NULL,            -- NULL = platform-wide alert
    alert_type      VARCHAR(100)     NOT NULL,        -- 'slow_query','db_size','connections','cpu'
    severity        ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
    message         TEXT             NOT NULL,
    metric_value    DECIMAL(20,4)    NULL,
    threshold_value DECIMAL(20,4)    NULL,
    acknowledged    TINYINT(1)       NOT NULL DEFAULT 0,
    acknowledged_by VARCHAR(100)     NULL,
    acknowledged_at TIMESTAMP        NULL,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company   (company_id),
    INDEX idx_type      (alert_type),
    INDEX idx_severity  (severity),
    INDEX idx_ack       (acknowledged),
    CONSTRAINT fk_ma_company FOREIGN KEY (company_id)
        REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- 5. CONNECTION POOL STATS (optional audit)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connection_stats (
    id              INT UNSIGNED     PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED     NOT NULL,
    active_conns    SMALLINT UNSIGNED NULL,
    idle_conns      SMALLINT UNSIGNED NULL,
    total_queries   INT UNSIGNED      NULL,
    avg_query_ms    DECIMAL(10,2)     NULL,
    recorded_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company   (company_id),
    INDEX idx_recorded  (recorded_at),
    CONSTRAINT fk_cs_company FOREIGN KEY (company_id)
        REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────
-- 6. AUDIT LOG (platform-level)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS master_audit_log (
    id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
    company_id      INT UNSIGNED     NULL,
    action          VARCHAR(100)     NOT NULL,  -- 'TENANT_CREATED','BACKUP_RUN','MIGRATION_APPLIED'
    actor           VARCHAR(100)     NOT NULL DEFAULT 'system',
    details         JSON             NULL,
    ip_address      VARCHAR(45)      NULL,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company   (company_id),
    INDEX idx_action    (action),
    INDEX idx_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SAMPLE DATA — 2 demo tenants
-- Passwords shown in plain text for demo; encrypt in production
-- =============================================================

INSERT INTO companies
    (name, slug, db_name, db_host, db_port, db_user, db_password, plan, max_users, owner_email)
VALUES
    (
        'Acme Corporation',
        'acme-corp',
        'erp_tenant_acme',
        'localhost',
        3306,
        'erp_u_acme',
        'Acme@SecureP@ss!91',     -- CHANGE: store AES_ENCRYPT() value in production
        'growth',
        50,
        'admin@acmecorp.com'
    ),
    (
        'Sunrise Traders',
        'sunrise-traders',
        'erp_tenant_sunrise',
        'localhost',
        3306,
        'erp_u_sunrise',
        'Sunrise@SecureP@ss!72',
        'starter',
        10,
        'owner@sunrisetraders.com'
    );


-- =============================================================
-- HELPER STORED PROCEDURE: get company by slug
-- =============================================================
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS get_company_by_slug(IN p_slug VARCHAR(100))
BEGIN
    SELECT id, name, slug, db_name, db_host, db_port, db_user, db_password,
           plan, max_users, is_active, owner_email, timezone
    FROM   companies
    WHERE  slug = p_slug AND is_active = 1
    LIMIT  1;
END$$

-- HELPER STORED PROCEDURE: suspend a tenant
CREATE PROCEDURE IF NOT EXISTS suspend_tenant(IN p_company_id INT UNSIGNED, IN p_reason TEXT)
BEGIN
    UPDATE companies
    SET    is_active    = 0,
           suspended_at = NOW(),
           notes        = CONCAT(IFNULL(notes,''), '\n[SUSPENDED] ', p_reason)
    WHERE  id = p_company_id;

    INSERT INTO master_audit_log (company_id, action, details)
    VALUES (p_company_id, 'TENANT_SUSPENDED', JSON_OBJECT('reason', p_reason));
END$$

DELIMITER ;
