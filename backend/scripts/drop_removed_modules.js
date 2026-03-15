// drop_removed_modules.js
// Drops tables for: Loyalty, Coupons, Layaway, Gift Cards
// Run once: node backend/scripts/drop_removed_modules.js

const { getConnection } = require('../config/database');

async function drop() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Drop in FK-safe order (child tables first)
    const tables = [
      'gift_card_transactions',
      'gift_cards',
      'loyalty_transactions',
      'loyalty_config',
      'layaway_payments',
      'layaway_items',
      'layaway_orders',
      'coupon_redemptions',
      'coupons',
    ];

    for (const table of tables) {
      await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`✓ Dropped: ${table}`);
    }

    // Remove RBAC permission rows for these modules
    const keys = ['sales.layaway', 'sales.coupons', 'sales.loyalty', 'sales.giftcards'];
    for (const key of keys) {
      await conn.query('DELETE FROM role_permissions WHERE module_key = ?', [key]);
      console.log(`✓ Removed permission: ${key}`);
    }

    await conn.commit();
    console.log('\nAll done. Tables dropped and permissions removed.');
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

drop();
