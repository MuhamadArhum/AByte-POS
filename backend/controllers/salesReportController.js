const { query } = require('../config/database');

exports.getSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const [summary] = await query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COALESCE(AVG(net_amount), 0) as avg_order,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
    `, [from, to]);

    res.json({
      total_orders: Number(summary.total_orders) || 0,
      total_sales: Number(summary.total_sales) || 0,
      avg_order: Number(summary.avg_order) || 0,
      total_discount: Number(summary.total_discount) || 0,
      total_tax: Number(summary.total_tax) || 0
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getHourlySales = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const rows = await query(`
      SELECT HOUR(sale_date) as hour, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) = ?
      GROUP BY HOUR(sale_date) ORDER BY hour
    `, [date]);

    const hourly = Array.from({ length: 24 }, (_, i) => {
      const found = rows.find(r => Number(r.hour) === i);
      return { hour: i, orders: found ? Number(found.orders) : 0, revenue: found ? Number(found.revenue) : 0 };
    });
    res.json({ data: hourly });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getPaymentBreakdown = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const rows = await query(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY payment_method ORDER BY total DESC
    `, [from, to]);

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const data = rows.map(r => ({ method: r.payment_method, count: Number(r.count), total: Number(r.total), percentage: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0 }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCashierPerformance = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const rows = await query(`
      SELECT s.user_id, u.name as cashier_name, COUNT(*) as order_count,
        COALESCE(SUM(s.net_amount), 0) as total_sales, COALESCE(AVG(s.net_amount), 0) as avg_sale
      FROM sales s JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY s.user_id ORDER BY total_sales DESC
    `, [from, to]);

    res.json({ data: rows.map(r => ({ ...r, total_sales: Number(r.total_sales), avg_sale: Number(r.avg_sale), order_count: Number(r.order_count) })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getDailyTrend = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const rows = await query(`
      SELECT DATE(sale_date) as date, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY DATE(sale_date) ORDER BY date
    `, [from, to]);

    res.json({ data: rows.map(r => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTopCustomers = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const rows = await query(`
      SELECT s.customer_id, c.customer_name, COUNT(*) as order_count, COALESCE(SUM(s.net_amount), 0) as total_spent
      FROM sales s JOIN customers c ON s.customer_id = c.customer_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY s.customer_id ORDER BY total_spent DESC LIMIT 15
    `, [from, to]);

    res.json({ data: rows.map(r => ({ ...r, total_spent: Number(r.total_spent), order_count: Number(r.order_count) })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getSalesComparison = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = new Date(date_from || new Date().toISOString().split('T')[0]);
    const to = new Date(date_to || new Date().toISOString().split('T')[0]);
    const days = Math.max(1, Math.ceil((to - from) / 86400000) + 1);

    const prevFrom = new Date(from.getTime() - days * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(from.getTime() - 86400000).toISOString().split('T')[0];

    const [[current], [previous]] = await Promise.all([
      query('SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?', ['completed', from.toISOString().split('T')[0], to.toISOString().split('T')[0]]),
      query('SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?', ['completed', prevFrom, prevTo])
    ]);

    const currentTotal = Number(current.total);
    const prevTotal = Number(previous.total);
    const change = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0;

    res.json({ current_period: { total: currentTotal, orders: Number(current.orders) }, previous_period: { total: prevTotal, orders: Number(previous.orders) }, change_percent: change });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};
