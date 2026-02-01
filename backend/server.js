// =============================================================
// server.js - Main Entry Point for AByte POS Backend
// This file sets up the Express server, applies middleware,
// registers all API routes, and starts listening for requests.
// =============================================================

const express = require('express');     // Web framework for building the REST API
const cors = require('cors');           // Allows frontend (port 5173) to call backend (port 5000)
const helmet = require('helmet');       // Adds security headers to all HTTP responses
const morgan = require('morgan');       // Logs every HTTP request to the console (method, url, status, time)
require('dotenv').config();             // Loads environment variables from .env file into process.env

// --- Import Route Files ---
// Each route file handles a specific group of API endpoints
const authRoutes = require('./routes/authRoutes');           // Login and token verification
const userRoutes = require('./routes/userRoutes');           // CRUD operations for system users (Admin only)
const productRoutes = require('./routes/productRoutes');     // CRUD operations for products and categories
const inventoryRoutes = require('./routes/inventoryRoutes'); // View and update stock levels
const salesRoutes = require('./routes/salesRoutes');         // Create sales and view sale history
const customerRoutes = require('./routes/customerRoutes');   // Manage customer records
const reportRoutes = require('./routes/reportRoutes');       // Sales and inventory reports

// Create the Express application instance
const app = express();

// --- Middleware Setup ---
// Middleware runs on every request before it reaches the route handlers
app.use(helmet());         // Security: sets headers like X-Content-Type-Options, X-Frame-Options, etc.
app.use(cors());           // CORS: allows cross-origin requests from the React frontend
app.use(morgan('dev'));    // Logging: prints colored request logs like "GET /api/products 200 12ms"
app.use(express.json());   // Body Parser: parses incoming JSON request bodies into req.body

// --- API Route Registration ---
// Each route is mounted under /api/ prefix
// Example: authRoutes handles POST /api/auth/login, GET /api/auth/verify
app.use('/api/auth', authRoutes);           // Authentication routes (login, verify token)
app.use('/api/users', userRoutes);          // User management routes (Admin only)
app.use('/api/products', productRoutes);    // Product and category routes
app.use('/api/inventory', inventoryRoutes); // Inventory/stock routes
app.use('/api/sales', salesRoutes);         // Sales transaction routes
app.use('/api/customers', customerRoutes);  // Customer management routes
app.use('/api/reports', reportRoutes);      // Report generation routes

// Health check endpoint - used to verify server is running
// Example: GET /api/health returns { status: 'ok' }
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Global Error Handler ---
// Catches any unhandled errors thrown in route handlers
// Express identifies this as an error handler because it has 4 parameters (err, req, res, next)
app.use((err, req, res, next) => {
  console.error(err.stack);  // Log the full error stack trace to console
  res.status(500).json({ message: 'Internal server error' });
});

// --- Start Server ---
// Reads port from .env file (default: 5000) and starts listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
