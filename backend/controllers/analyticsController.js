const { query } = require('../config/database');

exports.getDashboardStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const [salesStats] = await query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_sales,
        SUM(discount) as total_discount,
        SUM(net_amount) as net_sales,
        AVG(net_amount) as avg_transaction
      FROM sales
      WHERE sale_date BETWEEN ? AND ?
    `, [start_date, end_date]);

    const [expenseStats] = await query(`
      SELECT SUM(amount) as total_expenses
      FROM expenses
      WHERE expense_date BETWEEN ? AND ?
    `, [start_date, end_date]);

    const topProducts = await query(`
      SELECT p.product_name, SUM(sd.quantity) as units_sold, SUM(sd.total_price) as revenue
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE s.sale_date BETWEEN ? AND ?
      GROUP BY sd.product_id, p.product_name
      ORDER BY revenue DESC
      LIMIT 5
    `, [start_date, end_date]);

    const profit = (salesStats?.net_sales || 0) - (expenseStats?.total_expenses || 0);

    res.json({
      sales: salesStats || {},
      expenses: expenseStats || {},
      profit,
      topProducts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalesTrend = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;

    let groupBy;
    if (period === 'daily') groupBy = 'DATE(sale_date)';
    else if (period === 'weekly') groupBy = 'YEARWEEK(sale_date)';
    else groupBy = 'DATE_FORMAT(sale_date, "%Y-%m")';

    const trend = await query(`
      SELECT
        ${groupBy} as period,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        SUM(net_amount) as net_sales
      FROM sales
      WHERE sale_date BETWEEN ? AND ?
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, [start_date, end_date]);

    res.json({ data: trend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const breakdown = await query(`
      SELECT c.category_name, SUM(sd.total_price) as revenue, SUM(sd.quantity) as units_sold
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE s.sale_date BETWEEN ? AND ?
      GROUP BY c.category_id, c.category_name
      ORDER BY revenue DESC
    `, [start_date, end_date]);

    res.json({ data: breakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
