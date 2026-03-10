// =============================================================
// moduleGuard.js - Plan-based Module Access Control
//
// Usage in routes:
//   const { requireModule } = require('../middleware/moduleGuard');
//   router.use(authenticate);
//   router.use(requireModule('accounting'));
//   router.get('/', ...);
//
// Module keys must match what's in the plans.modules JSON array.
// req.user.plan is set by auth.js from the JWT.
// =============================================================

// Define which modules each plan includes.
// These MUST match the modules JSON in the plans table.
const PLAN_MODULES = {
  basic: [
    'inventory',
    'sales',
    'reports',
  ],
  professional: [
    'inventory',
    'sales',
    'reports',
    'accounting',
    'hr_payroll',
  ],
  enterprise: [
    'inventory',
    'sales',
    'reports',
    'accounting',
    'hr_payroll',
    'manufacturing',
    'api_access',
  ],
};

// Upgrade path: which plan gives you a specific module
const MODULE_UPGRADE_PLAN = {
  accounting:    'professional',
  hr_payroll:    'professional',
  manufacturing: 'enterprise',
  api_access:    'enterprise',
};

// Map route prefixes to module keys (for logging/debugging)
const ROUTE_MODULE_MAP = {
  '/api/accounting':     'accounting',
  '/api/staff':          'hr_payroll',
  '/api/payroll':        'hr_payroll',
  '/api/sales-reports':  'reports',
  '/api/inventory-reports': 'reports',
};

// --- requireModule(moduleName) ---
// Returns an Express middleware that:
//   1. Reads req.user.plan (set by authenticate in auth.js)
//   2. Checks if the plan includes moduleName
//   3. Returns 403 with upgrade message if not included
//   4. Also checks modules_enabled override from tenant config
//
// IMPORTANT: Must be used AFTER authenticate middleware.
// Single-client mode: all modules are available — guard always passes.
const requireModule = (moduleName) => {
  return (req, res, next) => next();
};

// --- getPlanModules(plan) ---
// Returns the list of modules available for a plan.
// Used by frontend to show/hide nav items without an API call.
const getPlanModules = (plan) => {
  return PLAN_MODULES[plan] || PLAN_MODULES.basic;
};

// --- isModuleAllowed(plan, moduleName) ---
// Simple boolean check — useful in controllers.
const isModuleAllowed = (plan, moduleName) => {
  return (PLAN_MODULES[plan] || PLAN_MODULES.basic).includes(moduleName);
};

module.exports = { requireModule, getPlanModules, isModuleAllowed, PLAN_MODULES };
