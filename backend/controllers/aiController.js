const { GoogleGenerativeAI } = require("@google/generative-ai");
const { query } = require("../config/database");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper to get system context
async function getSystemContext() {
  try {
    // Get daily sales
    const salesToday = await query(
      "SELECT COUNT(*) as count, SUM(total_amount) as total FROM sales WHERE DATE(sale_date) = CURDATE()"
    );
    
    // Get low stock items (less than 10)
    const lowStock = await query(
      "SELECT p.product_name, i.available_stock FROM inventory i JOIN products p ON i.product_id = p.product_id WHERE i.available_stock < 10 LIMIT 5"
    );

    // Get total customers
    const customers = await query("SELECT COUNT(*) as count FROM customers");

    return `
      System Context (Today):
      - Sales Count: ${salesToday[0].count}
      - Total Revenue: ${salesToday[0].total || 0}
      - Low Stock Items: ${lowStock.map(i => `${i.product_name} (${i.available_stock})`).join(", ")}
      - Total Customers: ${customers[0].count}
    `;
  } catch (error) {
    console.error("Error fetching context:", error);
    return "System context unavailable due to database error.";
  }
}

exports.chat = async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API Key not configured" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const systemContext = await getSystemContext();
    const systemPrompt = `
      You are an AI Assistant for the AByte POS system. 
      Your role is to help store managers with sales, inventory, and insights.
      
      Current Real-time Data:
      ${systemContext}

      Instructions:
      - Answer questions based on the provided data.
      - Be professional, concise, and helpful.
      - You support English and Urdu/Roman Urdu.
      - If you don't know something, say so.
    `;

    // Construct chat
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${message}`);
    const response = result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: "Failed to process AI request" });
  }
};
