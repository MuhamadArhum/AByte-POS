// =============================================================
// tokenBlacklist.js - In-Memory Token Revocation Store
// Tokens added here (on logout) are rejected by authenticate middleware.
// Memory is cleared on server restart — acceptable for single-client mode.
// =============================================================

const blacklist = new Set();

/**
 * Add a token to the blacklist (call on logout).
 * @param {string} token - Raw JWT string
 */
function blacklistToken(token) {
  blacklist.add(token);
}

/**
 * Check if a token has been revoked.
 * @param {string} token - Raw JWT string
 * @returns {boolean}
 */
function isBlacklisted(token) {
  return blacklist.has(token);
}

module.exports = { blacklistToken, isBlacklisted };
