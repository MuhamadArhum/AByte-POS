const Groq = require("groq-sdk");
const { query } = require("../config/database");

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
- Total Revenue: Rs. ${salesToday[0].total || 0}
- Low Stock Items: ${lowStock.map(i => `${i.product_name} (${i.available_stock} left)`).join(", ") || "None"}
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

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "Groq API Key not configured. Please add GROQ_API_KEY to .env file." });
    }

    const systemContext = await getSystemContext();

    // Convert history to chat format
    const messages = [
      {
        role: "system",
        content: `You are an AI Assistant for AByte POS (Point of Sale) system.
Your role is to help store owners and managers with sales analysis, inventory management, and business insights.

Current Real-time Business Data:
${systemContext}

Instructions:
- Answer questions based on the provided real-time data above
- Be professional, concise, and helpful
- Support both English and Urdu/Roman Urdu languages
- If asked about data you don't have, say so clearly
- Keep responses brief and actionable
- Use bullet points for lists
- Mention specific numbers from the data when relevant`
      }
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        if (msg.role && msg.parts && msg.parts[0]) {
          messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
          });
        }
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: message
    });

    // Call Groq API with Llama 3 model
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Fast and high-quality
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 1,
    });

    const reply = completion.choices[0].message.content;

    res.json({ reply });
  } catch (error) {
    console.error("AI Chat Error:", {
      message: error.message,
      status: error.status,
      type: error.type
    });

    let errorMessage = "Failed to process AI request";
    if (error.status === 401) {
      errorMessage = "Invalid Groq API key. Please check your GROQ_API_KEY in .env file.";
    } else if (error.status === 429) {
      errorMessage = "Rate limit exceeded. Please try again in a moment.";
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message
    });
  }
};
