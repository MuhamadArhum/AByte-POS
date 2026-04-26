// =============================================================
// aiController.js - AI Chat Assistant Controller
// Handles AI-powered business chat using Groq (Llama model).
// Builds full business context from DB before sending to AI.
// Used by: /api/ai routes
// =============================================================

const { query } = require("../config/database");

let groq = null;

function getGroqClient() {
  if (!groq && process.env.GROQ_API_KEY) {
    const Groq = require("groq-sdk");
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const safeQuery = async (sql, params = []) => {
  try { return await query(sql, params); }
  catch (e) { console.error('[AI safeQuery error]', e.message, sql.slice(0, 80)); return []; }
};

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
      safeQuery(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(total_amount), 0) as total,
               COALESCE(AVG(total_amount), 0) as avg_sale
        FROM sales
        WHERE DATE(sale_date) = CURDATE()
          AND status != 'refunded'
      `),

      // ── Sales: This Month ──────────────────────────────────────────
      safeQuery(`
        SELECT COUNT(*) as count,
               COALESCE(SUM(total_amount), 0) as total,
               COALESCE(SUM(profit), 0) as profit
        FROM sales
        WHERE YEAR(sale_date)  = YEAR(CURDATE())
          AND MONTH(sale_date) = MONTH(CURDATE())
          AND status != 'refunded'
      `),

      // ── Top 5 Best-Selling Products (this month) ───────────────────
      safeQuery(`
        SELECT p.product_name,
               SUM(sd.quantity) as qty_sold,
               SUM(sd.subtotal) as revenue
        FROM sale_details sd
        JOIN products p ON sd.product_id = p.product_id
        JOIN sales s    ON sd.sale_id    = s.sale_id
        WHERE YEAR(s.sale_date)  = YEAR(CURDATE())
          AND MONTH(s.sale_date) = MONTH(CURDATE())
        GROUP BY p.product_id, p.product_name
        ORDER BY qty_sold DESC
        LIMIT 5
      `),

      // ── Low Stock ─────────────────────────────────────────────────
      safeQuery(`
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
      safeQuery(`
        SELECT COUNT(*)                     as total_products,
               SUM(i.available_stock)       as total_units,
               COUNT(CASE WHEN i.available_stock = 0 THEN 1 END) as out_of_stock
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE p.is_active = 1
      `),

      // ── Customers ─────────────────────────────────────────────────
      safeQuery(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today,
               SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE())
                         AND YEAR(created_at)  = YEAR(CURDATE())  THEN 1 ELSE 0 END) as new_this_month
        FROM customers
        WHERE customer_id != 1
      `),

      // ── Recent 5 Sales ─────────────────────────────────────────────
      safeQuery(`
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
      safeQuery(`
        SELECT COUNT(*) as total_staff,
               SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active,
               COALESCE(SUM(basic_salary), 0) as total_payroll
        FROM staff
      `),

      // ── HR: Loans ─────────────────────────────────────────────────
      safeQuery(`
        SELECT COUNT(*) as active_loans,
               COALESCE(SUM(remaining_balance), 0) as total_outstanding
        FROM staff_loans
        WHERE status = 'active'
      `),

      // ── Expenses: This Month (CPV) ────────────────────────────────
      safeQuery(`
        SELECT COALESCE(SUM(amount), 0) as total_expense,
               COUNT(*) as expense_count
        FROM payment_vouchers
        WHERE YEAR(voucher_date)  = YEAR(CURDATE())
          AND MONTH(voucher_date) = MONTH(CURDATE())
      `),

      // ── Cash Register Status ───────────────────────────────────────
      safeQuery(`
        SELECT status, opening_amount, closing_amount, opened_at
        FROM cash_registers
        ORDER BY register_id DESC
        LIMIT 1
      `),

      // ── Inventory Value ────────────────────────────────────────────
      safeQuery(`
        SELECT COALESCE(SUM(i.available_stock * p.cost_price), 0) as stock_value
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE p.is_active = 1
      `),

      // ── Top 5 Customers (this month) ──────────────────────────────
      safeQuery(`
        SELECT c.customer_name,
               COUNT(s.sale_id)    as purchase_count,
               SUM(s.total_amount) as total_spent
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
      safeQuery(`
        SELECT cat.category_name,
               SUM(sd.quantity) as qty_sold,
               SUM(sd.subtotal) as revenue
        FROM sale_details sd
        JOIN products   p   ON sd.product_id  = p.product_id
        JOIN categories cat ON p.category_id  = cat.category_id
        JOIN sales      s   ON sd.sale_id     = s.sale_id
        WHERE YEAR(s.sale_date)  = YEAR(CURDATE())
          AND MONTH(s.sale_date) = MONTH(CURDATE())
        GROUP BY cat.category_id, cat.category_name
        ORDER BY revenue DESC
        LIMIT 5
      `),

      // ── Pending Purchase Orders ────────────────────────────────────
      safeQuery(`
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

    const st  = salesToday[0]      || { count: 0, total: 0, avg_sale: 0 };
    const sm  = salesThisMonth[0]  || { count: 0, total: 0, profit: 0 };
    const ss  = stockSummary[0]    || { total_products: 0, total_units: 0, out_of_stock: 0 };
    const cs  = customerSummary[0] || { total: 0, new_today: 0, new_this_month: 0 };
    const hf  = staffSummary[0]    || { total_staff: 0, active: 0, total_payroll: 0 };
    const ln  = pendingLoans[0]    || { active_loans: 0, total_outstanding: 0 };
    const ex  = expenseSummary[0]  || { total_expense: 0, expense_count: 0 };
    const inv = inventoryValue[0]  || { stock_value: 0 };
    const po  = pendingOrders[0]   || { pending_orders: 0, pending_value: 0 };

    return `
=== AByte ERP — LIVE BUSINESS DATA ===
Date: ${new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-PK')}

--- SALES: TODAY ---
• Transactions: ${st.count}
• Total Revenue: Rs. ${Number(st.total).toLocaleString()}
• Average Sale Value: Rs. ${Number(st.avg_sale).toFixed(0)}

--- SALES: THIS MONTH ---
• Transactions: ${sm.count}
• Total Revenue: Rs. ${Number(sm.total).toLocaleString()}
• Total Profit: Rs. ${Number(sm.profit).toLocaleString()}

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
• Total Active Products: ${ss.total_products}
• Total Units in Stock: ${Number(ss.total_units).toLocaleString()}
• Out of Stock Products: ${ss.out_of_stock}
• Total Stock Value: Rs. ${Number(inv.stock_value).toLocaleString()}

--- LOW / OUT OF STOCK ITEMS ---
${lowStock.length > 0
  ? lowStock.map(i => `• ${i.product_name}: ${i.available_stock} units (reorder at ${i.reorder_level})`).join('\n')
  : '• All products are well-stocked'}

--- PURCHASE ORDERS (PENDING) ---
• Pending Orders: ${po.pending_orders}
• Pending Value: Rs. ${Number(po.pending_value).toLocaleString()}

--- CUSTOMERS ---
• Total Registered Customers: ${cs.total}
• New Customers Today: ${cs.new_today}
• New Customers This Month: ${cs.new_this_month}

--- TOP CUSTOMERS (THIS MONTH) ---
${topCustomers.map((c, i) =>
  `${i + 1}. ${c.customer_name} — ${c.purchase_count} purchases — Rs. ${Number(c.total_spent).toLocaleString()}`
).join('\n') || '• No customer data'}

--- HUMAN RESOURCES ---
• Total Staff: ${hf.total_staff}
• Active Staff: ${hf.active}
• Monthly Payroll: Rs. ${Number(hf.total_payroll).toLocaleString()}
• Active Loans: ${ln.active_loans} (Rs. ${Number(ln.total_outstanding).toLocaleString()} outstanding)

--- EXPENSES / CPV (THIS MONTH) ---
• Total Payments: Rs. ${Number(ex.total_expense).toLocaleString()}
• Payment Entries: ${ex.expense_count}

--- CASH REGISTER ---
• Status: ${registerInfo}
===`;
  } catch (error) {
    console.error("Error fetching AI context:", error);
    return `=== AByte ERP — PARTIAL DATA ===
Date: ${new Date().toLocaleDateString()}
Note: Some data could not be loaded. ${error.message}
===`;
  }
}

// ── Chat endpoint ──────────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!getGroqClient()) {
      return res.status(500).json({ error: "Groq API Key not configured. Please add GROQ_API_KEY to .env file." });
    }

    const groq = getGroqClient();
    if (!groq) {
      return res.status(500).json({ error: "Groq API Key not configured. Please add GROQ_API_KEY to .env file." });
    }

    const systemContext = await getSystemContext();

    const messages = [
      {
        role: "system",
        content: `You are an AI Business Assistant for AByte ERP & ERP system.
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
