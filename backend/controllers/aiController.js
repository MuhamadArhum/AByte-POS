const Groq = require("groq-sdk");
const { query } = require("../config/database");

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── Comprehensive business context from all modules ────────────────────────
async function getSystemContext() {
  try {
    const [
      salesToday,
      salesThisMonth,
      topProducts,
      lowStock,
      stockSummary,
      customerSummary,
      recentSales,
      staffSummary,
      pendingLoans,
      expenseSummary,
      registerStatus,
      inventoryValue,
      topCustomers,
      salesByCategory,
      pendingOrders,
    ] = await Promise.all([

      // ── Sales: Today ───────────────────────────────────────────────
      query(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(total_amount), 0) as total,
               COALESCE(AVG(total_amount), 0) as avg_sale
        FROM sales
        WHERE DATE(sale_date) = CURDATE()
          AND status != 'refunded'
      `),

      // ── Sales: This Month ──────────────────────────────────────────
      query(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(total_amount), 0) as total,
               COALESCE(SUM(profit), 0) as profit
        FROM sales
        WHERE YEAR(sale_date)  = YEAR(CURDATE())
          AND MONTH(sale_date) = MONTH(CURDATE())
          AND status != 'refunded'
      `),

      // ── Top 5 Best-Selling Products (this month) ───────────────────
      query(`
        SELECT p.product_name,
               SUM(si.quantity) as qty_sold,
               SUM(si.subtotal) as revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.product_id
        JOIN sales s    ON si.sale_id    = s.sale_id
        WHERE YEAR(s.sale_date)  = YEAR(CURDATE())
          AND MONTH(s.sale_date) = MONTH(CURDATE())
        GROUP BY p.product_id, p.product_name
        ORDER BY qty_sold DESC
        LIMIT 5
      `),

      // ── Low Stock (available < reorder_level or < 10) ─────────────
      query(`
        SELECT p.product_name,
               i.available_stock,
               COALESCE(p.reorder_level, 10) as reorder_level
        FROM inventory i
        JOIN products  p ON i.product_id = p.product_id
        WHERE i.available_stock <= COALESCE(p.reorder_level, 10)
        ORDER BY i.available_stock ASC
        LIMIT 10
      `),

      // ── Inventory Summary ──────────────────────────────────────────
      query(`
        SELECT COUNT(*)                     as total_products,
               SUM(i.available_stock)       as total_units,
               COUNT(CASE WHEN i.available_stock = 0 THEN 1 END) as out_of_stock
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE p.is_active = 1
      `),

      // ── Customers ─────────────────────────────────────────────────
      query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today,
               SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE())
                         AND YEAR(created_at)  = YEAR(CURDATE())  THEN 1 ELSE 0 END) as new_this_month
        FROM customers
        WHERE customer_id != 1
      `),

      // ── Recent 5 Sales ─────────────────────────────────────────────
      query(`
        SELECT s.sale_id,
               COALESCE(c.customer_name, 'Walk-in') as customer,
               s.total_amount,
               s.payment_method,
               s.sale_date
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.customer_id
        ORDER BY s.sale_date DESC
        LIMIT 5
      `),

      // ── HR: Staff ─────────────────────────────────────────────────
      query(`
        SELECT COUNT(*) as total_staff,
               SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active,
               COALESCE(SUM(basic_salary), 0) as total_payroll
        FROM staff
      `),

      // ── HR: Pending / Active Loans ────────────────────────────────
      query(`
        SELECT COUNT(*) as active_loans,
               COALESCE(SUM(remaining_balance), 0) as total_outstanding
        FROM staff_loans
        WHERE status = 'active'
      `),

      // ── Expenses: This Month ───────────────────────────────────────
      query(`
        SELECT COALESCE(SUM(amount), 0) as total_expense,
               COUNT(*) as expense_count
        FROM expenses
        WHERE YEAR(expense_date)  = YEAR(CURDATE())
          AND MONTH(expense_date) = MONTH(CURDATE())
      `),

      // ── Cash Register Status ───────────────────────────────────────
      query(`
        SELECT status,
               opening_amount,
               closing_amount,
               opened_at
        FROM cash_registers
        ORDER BY register_id DESC
        LIMIT 1
      `),

      // ── Inventory Value ────────────────────────────────────────────
      query(`
        SELECT COALESCE(SUM(i.available_stock * p.cost_price), 0) as stock_value
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE p.is_active = 1
      `),

      // ── Top 5 Customers by Revenue (this month) ───────────────────
      query(`
        SELECT c.customer_name,
               COUNT(s.sale_id)         as purchase_count,
               SUM(s.total_amount)      as total_spent
        FROM sales s
        JOIN customers c ON s.customer_id = c.customer_id
        WHERE c.customer_id != 1
          AND YEAR(s.sale_date)  = YEAR(CURDATE())
          AND MONTH(s.sale_date) = MONTH(CURDATE())
        GROUP BY c.customer_id, c.customer_name
        ORDER BY total_spent DESC
        LIMIT 5
      `),

      // ── Sales by Category (this month) ────────────────────────────
      query(`
        SELECT cat.category_name,
               SUM(si.quantity) as qty_sold,
               SUM(si.subtotal) as revenue
        FROM sale_items si
        JOIN products  p   ON si.product_id   = p.product_id
        JOIN categories cat ON p.category_id  = cat.category_id
        JOIN sales      s   ON si.sale_id     = s.sale_id
        WHERE YEAR(s.sale_date)  = YEAR(CURDATE())
          AND MONTH(s.sale_date) = MONTH(CURDATE())
        GROUP BY cat.category_id, cat.category_name
        ORDER BY revenue DESC
        LIMIT 5
      `),

      // ── Pending/Processing Purchase Orders ────────────────────────
      query(`
        SELECT COUNT(*) as pending_orders,
               COALESCE(SUM(total_amount), 0) as pending_value
        FROM purchase_orders
        WHERE status IN ('pending', 'ordered', 'partial')
      `),
    ]);

    const reg = registerStatus[0];
    const registerInfo = reg
      ? `${reg.status === 'open' ? 'OPEN' : 'CLOSED'} (opened at ${reg.opened_at ? new Date(reg.opened_at).toLocaleTimeString() : 'N/A'}, opening cash Rs. ${reg.opening_amount || 0})`
      : 'No register data';

    return `
=== ABYTE POS — LIVE BUSINESS DATA ===
Date: ${new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-PK')}

--- SALES: TODAY ---
• Transactions: ${salesToday[0].count}
• Total Revenue: Rs. ${Number(salesToday[0].total).toLocaleString()}
• Average Sale Value: Rs. ${Number(salesToday[0].avg_sale).toFixed(0)}

--- SALES: THIS MONTH ---
• Transactions: ${salesThisMonth[0].count}
• Total Revenue: Rs. ${Number(salesThisMonth[0].total).toLocaleString()}
• Total Profit: Rs. ${Number(salesThisMonth[0].profit).toLocaleString()}

--- RECENT 5 SALES ---
${recentSales.map(s =>
  `• #${s.sale_id} | ${s.customer} | Rs. ${s.total_amount} | ${s.payment_method} | ${new Date(s.sale_date).toLocaleString()}`
).join('\n') || '• No recent sales'}

--- TOP SELLING PRODUCTS (THIS MONTH) ---
${topProducts.map((p, i) =>
  `${i + 1}. ${p.product_name} — ${p.qty_sold} units sold — Rs. ${Number(p.revenue).toLocaleString()} revenue`
).join('\n') || '• No data'}

--- SALES BY CATEGORY (THIS MONTH) ---
${salesByCategory.map(c =>
  `• ${c.category_name}: ${c.qty_sold} units — Rs. ${Number(c.revenue).toLocaleString()}`
).join('\n') || '• No data'}

--- INVENTORY ---
• Total Active Products: ${stockSummary[0].total_products}
• Total Units in Stock: ${Number(stockSummary[0].total_units).toLocaleString()}
• Out of Stock Products: ${stockSummary[0].out_of_stock}
• Total Stock Value: Rs. ${Number(inventoryValue[0].stock_value).toLocaleString()}

--- LOW / OUT OF STOCK ITEMS ---
${lowStock.length > 0
  ? lowStock.map(i => `• ${i.product_name}: ${i.available_stock} units (reorder at ${i.reorder_level})`).join('\n')
  : '• All products are well-stocked'}

--- PURCHASE ORDERS (PENDING) ---
• Pending Orders: ${pendingOrders[0].pending_orders}
• Pending Value: Rs. ${Number(pendingOrders[0].pending_value).toLocaleString()}

--- CUSTOMERS ---
• Total Registered Customers: ${customerSummary[0].total}
• New Customers Today: ${customerSummary[0].new_today}
• New Customers This Month: ${customerSummary[0].new_this_month}

--- TOP CUSTOMERS (THIS MONTH) ---
${topCustomers.map((c, i) =>
  `${i + 1}. ${c.customer_name} — ${c.purchase_count} purchases — Rs. ${Number(c.total_spent).toLocaleString()}`
).join('\n') || '• No customer data'}

--- HUMAN RESOURCES ---
• Total Staff: ${staffSummary[0].total_staff}
• Active Staff: ${staffSummary[0].active}
• Monthly Payroll: Rs. ${Number(staffSummary[0].total_payroll).toLocaleString()}
• Active Loans: ${pendingLoans[0].active_loans} (Rs. ${Number(pendingLoans[0].total_outstanding).toLocaleString()} outstanding)

--- EXPENSES (THIS MONTH) ---
• Total Expenses: Rs. ${Number(expenseSummary[0].total_expense).toLocaleString()}
• Expense Entries: ${expenseSummary[0].expense_count}

--- CASH REGISTER ---
• Status: ${registerInfo}
===`;
  } catch (error) {
    console.error("Error fetching AI context:", error);
    return "System context unavailable. Database error occurred.";
  }
}

// ── Chat endpoint ──────────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "Groq API Key not configured. Please add GROQ_API_KEY to .env file." });
    }

    const systemContext = await getSystemContext();

    const messages = [
      {
        role: "system",
        content: `You are an AI Business Assistant for AByte POS & ERP system.
You have access to real-time data from all business modules: Sales, Inventory, HR, Customers, Expenses, and Cash Register.

${systemContext}

Your instructions:
- Answer questions using the real-time data provided above
- Be professional, concise, and actionable
- Support both English and Urdu/Roman Urdu languages naturally
- Use specific numbers from the data when answering
- For data you don't have, say clearly "I don't have that data available right now"
- Format answers with bullet points and bold headings where helpful
- You can do calculations (e.g. profit margins, comparisons) using the provided numbers
- If asked to compare periods, note that you only have current data
- Keep responses focused and under 300 words unless a detailed breakdown is specifically needed`
      }
    ];

    // Add conversation history (last 10 messages for context)
    if (history && Array.isArray(history)) {
      history.slice(-10).forEach(msg => {
        if (msg.role && msg.parts?.[0]) {
          messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
          });
        }
      });
    }

    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 600,
      temperature: 0.7,
      top_p: 1,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("AI Chat Error:", { message: error.message, status: error.status });

    let errorMessage = "Failed to process AI request";
    if (error.status === 401) errorMessage = "Invalid Groq API key. Please check GROQ_API_KEY in .env file.";
    else if (error.status === 429) errorMessage = "Rate limit exceeded. Please try again in a moment.";

    res.status(500).json({ error: errorMessage, details: error.message });
  }
};
