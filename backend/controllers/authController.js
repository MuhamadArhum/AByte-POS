// =============================================================
// authController.js - Authentication Controller
// Handles user login and token verification.
// Used by: POST /api/auth/login and GET /api/auth/verify
// =============================================================

const bcrypt = require('bcryptjs');          // Library to compare hashed passwords
const jwt = require('jsonwebtoken');         // Library to create and verify JWT tokens
const { query } = require('../config/database');  // Database query helper

// --- Login Handler ---
// Called when user submits email and password on the login page.
// Steps: Validate input -> Find user by email -> Compare password -> Generate JWT token
// Returns: { token, user: { user_id, name, email, role } }
exports.login = async (req, res) => {
  try {
    // Extract email and password from the request body (sent by frontend)
    const { email, password } = req.body;

    // Validate that both fields are provided
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Look up the user in the database by email
    // JOIN with roles table to also get the role name (Admin, Manager, Cashier)
    const rows = await query(
      'SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.email = ?',
      [email]
    );

    // If no user found with this email, return generic error
    // (We don't say "email not found" to prevent email enumeration attacks)
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];

    // Compare the plain text password with the bcrypt hash stored in the database
    // bcrypt.compare() handles the salt automatically
    const isMatch = await bcrypt.compare(password, user.password_hash);

    // If password doesn't match, return generic error
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Password is correct - generate a JWT token
    // The token contains: userId and role (payload)
    // It's signed with the secret key and expires in 24 hours
    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name },  // Payload (data stored in token)
      process.env.JWT_SECRET,                            // Secret key for signing
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } // Token expiry time
    );

    // Send the token and user info back to the frontend
    // Frontend stores the token in localStorage and sends it with every request
    res.json({
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Verify Token Handler ---
// Called when the frontend app loads to check if the stored token is still valid.
// The authenticate middleware (auth.js) has already verified the token and set req.user.
// This just returns the user data back to the frontend.
exports.verify = async (req, res) => {
  res.json({
    user: {
      user_id: req.user.user_id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role_name,
    },
  });
};
