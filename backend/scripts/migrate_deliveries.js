// migrate_deliveries.js — creates deliveries table
const { getConnection } = require('../config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        delivery_id       INT PRIMARY KEY AUTO_INCREMENT,
        delivery_number   VARCHAR(50)  NOT NULL UNIQUE,
        sale_id           INT          NULL,
        customer_id       INT          NOT NULL,
        delivery_address  TEXT         NOT NULL,
        delivery_city     VARCHAR(100) DEFAULT '',
        delivery_phone    VARCHAR(20)  DEFAULT '',
        rider_name        VARCHAR(100) DEFAULT '',
        rider_phone       VARCHAR(20)  DEFAULT '',
        status            ENUM('pending','assigned','dispatched','in_transit','delivered','failed','cancelled')
                          NOT NULL DEFAULT 'pending',
        delivery_charges  DECIMAL(10,2) DEFAULT 0,
        estimated_delivery DATE         NULL,
        actual_delivery   TIMESTAMP    NULL,
        notes             TEXT,
        created_by        INT          NULL,
        created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id)    REFERENCES sales(sale_id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_del_status   (status),
        INDEX idx_del_customer (customer_id),
        INDEX idx_del_number   (delivery_number),
        INDEX idx_del_date     (created_at)
      )
    `);
    console.log('✓ Table deliveries created/verified.');

    // Add permission for Manager (Admin always has full access)
    await conn.query(
      'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
      ['Manager', 'sales.deliveries']
    );
    await conn.query(
      'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
      ['Cashier', 'sales.deliveries']
    );
    console.log('✓ Permissions seeded for Manager and Cashier.');

    await conn.commit();
    console.log('\nDeliveries migration completed.');
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

migrate();
