/**
 * Import Menu Products from Excel to DB
 * File: Combined Menu Rates Updated (FC & Restaurant) 19.03.2026.xlsx
 *
 * - Adds missing categories
 * - Inserts products (skips duplicates by product_name + category_id)
 * - If Half price > 0: sets has_variants=1, inserts Full + Half variants
 */

const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
const path = require('path');

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'abyte_pos',
  multipleStatements: false,
};

const EXCEL_FILE = path.join(__dirname, '..', 'Combined Menu Rates Updated (FC & Restaurant) 19.03.2026.xlsx');

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected to DB.');

  try {
    // 1. Read Excel
    const wb = xlsx.readFile(EXCEL_FILE);
    const ws = wb.Sheets['Sheet1'];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    // Extract unique categories from Excel (headCode -> headName)
    const excelCats = {};
    rows.slice(1).forEach(r => {
      if (r[0] !== undefined && r[1]) excelCats[r[0]] = r[1].trim();
    });
    console.log('Excel categories:', excelCats);

    // 2. Load existing DB categories
    const [dbCats] = await conn.execute('SELECT category_id, category_name FROM categories');
    const catByName = {}; // lowercase name -> id
    dbCats.forEach(c => { catByName[c.category_name.toLowerCase()] = c.category_id; });

    // 3. Insert missing categories
    const excelToCatId = {}; // excel headCode -> db category_id
    for (const [headCode, headName] of Object.entries(excelCats)) {
      const key = headName.toLowerCase();
      if (catByName[key]) {
        excelToCatId[headCode] = catByName[key];
        console.log(`Category "${headName}" -> existing id ${catByName[key]}`);
      } else {
        const [res] = await conn.execute(
          'INSERT INTO categories (category_name) VALUES (?)',
          [headName]
        );
        excelToCatId[headCode] = res.insertId;
        catByName[key] = res.insertId;
        console.log(`Category "${headName}" -> NEW id ${res.insertId}`);
      }
    }

    // 4. Get existing products (to skip duplicates)
    const [existingProds] = await conn.execute(
      'SELECT product_name, category_id FROM products'
    );
    const existingSet = new Set(
      existingProds.map(p => `${p.product_name.toLowerCase()}__${p.category_id}`)
    );

    // 5. Insert products
    let inserted = 0, skipped = 0, variantsInserted = 0;

    for (const row of rows.slice(1)) {
      const headCode = row[0];
      const itemName = row[3] ? String(row[3]).trim() : null;
      const fullPrice = parseFloat(row[4]) || 0;
      const halfPrice = parseFloat(row[5]) || 0;

      if (!itemName || !fullPrice) { skipped++; continue; }

      const catId = excelToCatId[headCode] || null;
      const key = `${itemName.toLowerCase()}__${catId}`;

      if (existingSet.has(key)) {
        console.log(`  SKIP (exists): ${itemName}`);
        skipped++;
        continue;
      }

      const hasVariants = halfPrice > 0 ? 1 : 0;

      const [prodRes] = await conn.execute(
        `INSERT INTO products
          (product_name, category_id, price, has_variants, product_type, unit, is_active)
         VALUES (?, ?, ?, ?, 'finished_good', 'pcs', 1)`,
        [itemName, catId, fullPrice, hasVariants]
      );
      const productId = prodRes.insertId;
      existingSet.add(key);
      inserted++;

      // Insert variants if Half price exists
      if (hasVariants) {
        const fullSku = `P${productId}-FULL`;
        const halfSku = `P${productId}-HALF`;

        await conn.execute(
          `INSERT INTO product_variants (product_id, sku, variant_name, price_adjustment, stock_quantity)
           VALUES (?, ?, 'Full', 0, 0)`,
          [productId, fullSku]
        );
        await conn.execute(
          `INSERT INTO product_variants (product_id, sku, variant_name, price_adjustment, stock_quantity)
           VALUES (?, ?, 'Half', ?, 0)`,
          [productId, halfSku, halfPrice - fullPrice]
        );
        variantsInserted += 2;
      }
    }

    console.log('\n=============================');
    console.log(`Products inserted : ${inserted}`);
    console.log(`Products skipped  : ${skipped}`);
    console.log(`Variants inserted : ${variantsInserted}`);
    console.log('=============================');

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
