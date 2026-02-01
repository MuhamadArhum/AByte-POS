const { query } = require('../config/database');

exports.dailyReport = async (req, res) => {
  try {
    const summary = await query(
      `SELECT
         COUNT(*) as total_transactions,
         COALESCE(SUM(total_amount), 0) as total_sales,
         COALESCE(SUM(discount), 0) as total_discount,
         COALESCE(SUM(net_amount), 0) as total_revenue
       FROM sales WHERE DATE(sale_date) = CURDATE()`
    );
    res.json(summary[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.dateRangeReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    const summary = await query(
      `SELECT
         COUNT(*) as total_transactions,
         COALESCE(SUM(total_amount), 0) as total_sales,
         COALESCE(SUM(discount), 0) as total_discount,
         COALESCE(SUM(net_amount), 0) as total_revenue,
         COALESCE(AVG(net_amount), 0) as avg_transaction
       FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?`,
      [start_date, end_date]
    );

    const daily = await query(
      `SELECT
         DATE(sale_date) as date,
         COUNT(*) as transactions,
         SUM(net_amount) as revenue
       FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?
       GROUP BY DATE(sale_date) ORDER BY date`,
      [start_date, end_date]
    );

    res.json({ summary: summary[0], daily });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.productReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = `SELECT
         p.product_name,
         SUM(sd.quantity) as total_quantity,
         SUM(sd.total_price) as total_revenue
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       JOIN sales s ON sd.sale_id = s.sale_id`;
    const params = [];

    if (start_date && end_date) {
      sql += ' WHERE DATE(s.sale_date) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    sql += ' GROUP BY p.product_id, p.product_name ORDER BY total_revenue DESC';
    const rows = await query(sql, params);

    const totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.total_revenue), 0);
    const withPercentage = rows.map(r => ({
      ...r,
      percentage: totalRevenue > 0 ? ((parseFloat(r.total_revenue) / totalRevenue) * 100).toFixed(2) : 0,
    }));

    res.json(withPercentage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.inventoryReport = async (req, res) => {
  try {
    const all = await query(
      `SELECT p.product_name, p.price, i.available_stock, c.category_name,
              (p.price * i.available_stock) as stock_value
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       ORDER BY p.product_name`
    );

    const lowStock = all.filter(r => r.available_stock > 0 && r.available_stock < 10);
    const outOfStock = all.filter(r => r.available_stock === 0);
    const totalValue = all.reduce((sum, r) => sum + parseFloat(r.stock_value || 0), 0);

    res.json({
      products: all,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      total_inventory_value: totalValue,
      total_products: all.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
