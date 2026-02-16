const { query } = require('../config/database');

exports.getStockSummary = async (req, res) => {
  try {
    const [summary] = await query(`
      SELECT
        COUNT(DISTINCT p.product_id) as total_products,
        COALESCE(SUM(CASE WHEN COALESCE(i.available_stock, p.stock_quantity, 0) > 0
          THEN CAST(p.price AS DECIMAL(12,2)) * COALESCE(i.available_stock, p.stock_quantity, 0) ELSE 0 END), 0) as total_stock_value,
        COALESCE(SUM(COALESCE(i.available_stock, p.stock_quantity, 0)), 0) as total_units,
        SUM(CASE WHEN COALESCE(i.available_stock, p.stock_quantity, 0) > 0
          AND COALESCE(i.available_stock, p.stock_quantity, 0) < 10 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN COALESCE(i.available_stock, p.stock_quantity, 0) = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
    `);

    res.json({
      total_products: Number(summary.total_products),
      total_stock_value: Number(summary.total_stock_value),
      total_units: Number(summary.total_units),
      low_stock_count: Number(summary.low_stock_count),
      out_of_stock_count: Number(summary.out_of_stock_count),
    });
  } catch (error) {
    console.error('Stock summary error:', error);
    res.status(500).json({ message: 'Failed to fetch stock summary' });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const data = await query(`
      SELECT p.product_id, p.product_name, p.price, c.category_name,
        COALESCE(SUM(sd.quantity), 0) as units_sold,
        COALESCE(SUM(sd.total_price), 0) as revenue
      FROM products p
      LEFT JOIN sale_details sd ON p.product_id = sd.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      GROUP BY p.product_id
      HAVING units_sold > 0
      ORDER BY units_sold DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({ data });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ message: 'Failed to fetch top products' });
  }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const data = await query(`
      SELECT c.category_id, c.category_name,
        COUNT(p.product_id) as product_count,
        COALESCE(SUM(COALESCE(i.available_stock, p.stock_quantity, 0)), 0) as total_stock,
        COALESCE(SUM(CAST(p.price AS DECIMAL(12,2)) * COALESCE(i.available_stock, p.stock_quantity, 0)), 0) as stock_value
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      GROUP BY c.category_id
      ORDER BY stock_value DESC
    `);

    res.json({ data });
  } catch (error) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ message: 'Failed to fetch category breakdown' });
  }
};

exports.getSlowMovers = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const data = await query(`
      SELECT p.product_id, p.product_name, p.price, c.category_name,
        COALESCE(i.available_stock, p.stock_quantity, 0) as current_stock,
        MAX(s.sale_date) as last_sale_date,
        DATEDIFF(CURRENT_DATE, MAX(s.sale_date)) as days_since_last_sale,
        COALESCE(i.available_stock, p.stock_quantity, 0) * p.price as value_at_risk
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN sale_details sd ON p.product_id = sd.product_id
      LEFT JOIN sales s ON sd.sale_id = s.sale_id AND s.status = 'completed'
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE COALESCE(i.available_stock, p.stock_quantity, 0) > 0
      GROUP BY p.product_id
      HAVING last_sale_date IS NULL OR days_since_last_sale > ?
      ORDER BY days_since_last_sale DESC
      LIMIT 50
    `, [parseInt(days)]);

    res.json({ data });
  } catch (error) {
    console.error('Slow movers error:', error);
    res.status(500).json({ message: 'Failed to fetch slow movers' });
  }
};
