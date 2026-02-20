const { getConnection } = require('./config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_id INT PRIMARY KEY AUTO_INCREMENT,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        sale_id INT NULL,
        quotation_id INT NULL,
        customer_id INT NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled') DEFAULT 'draft',
        due_date DATE NULL,
        payment_terms VARCHAR(100) DEFAULT 'Due on Receipt',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_inv_number (invoice_number),
        INDEX idx_inv_customer (customer_id),
        INDEX idx_inv_status (status)
      )
    `);
    console.log('Created invoices table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        item_id INT PRIMARY KEY AUTO_INCREMENT,
        invoice_id INT NOT NULL,
        product_id INT NOT NULL,
        variant_id INT NULL,
        description VARCHAR(255),
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('Created invoice_items table');

    await conn.commit();
    console.log('\nInvoices migration completed successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();
