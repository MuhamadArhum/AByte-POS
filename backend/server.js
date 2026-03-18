// =============================================================
// server.js - Main Entry Point for AByte POS Backend
//
// Multi-tenant SaaS flow:
//   1. Frontend sends X-Tenant-Subdomain header (set from window.location.hostname)
//   2. authController reads subdomain → looks up tenant in abyte_master
//   3. JWT includes { tenant_db, tenant_id, plan }
//   4. authenticate middleware routes all queries to correct tenant DB
//   5. requireModule middleware guards plan-based features
// =============================================================

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
require('dotenv').config();

// --- Import Route Files ---
const authRoutes            = require('./routes/authRoutes');
const userRoutes            = require('./routes/userRoutes');
const productRoutes         = require('./routes/productRoutes');
const inventoryRoutes       = require('./routes/inventoryRoutes');
const salesRoutes           = require('./routes/salesRoutes');
const customerRoutes        = require('./routes/customerRoutes');
const reportRoutes          = require('./routes/reportRoutes');
const settingsRoutes        = require('./routes/settingsRoutes');
const aiRoutes              = require('./routes/aiRoutes');
const auditRoutes           = require('./routes/auditRoutes');
const registerRoutes        = require('./routes/registerRoutes');
const returnRoutes          = require('./routes/returnRoutes');
const backupRoutes          = require('./routes/backupRoutes');
const variantRoutes         = require('./routes/variantRoutes');
const bundleRoutes          = require('./routes/bundleRoutes');
const supplierRoutes        = require('./routes/supplierRoutes');
const staffRoutes           = require('./routes/staffRoutes');
const purchaseOrderRoutes   = require('./routes/purchaseOrderRoutes');
const storeRoutes           = require('./routes/storeRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');
const accountingRoutes      = require('./routes/accountingRoutes');
const stockAdjustmentRoutes = require('./routes/stockAdjustmentRoutes');
const stockTransferRoutes   = require('./routes/stockTransferRoutes');
const inventoryReportRoutes = require('./routes/inventoryReportRoutes');
const salesReportRoutes     = require('./routes/salesReportRoutes');
const sectionsRoutes        = require('./routes/sectionsRoutes');
const issuanceRoutes        = require('./routes/issuanceRoutes');
const purchaseVoucherRoutes = require('./routes/purchaseVoucherRoutes');
const purchaseReturnRoutes  = require('./routes/purchaseReturnRoutes');
const openingStockRoutes    = require('./routes/openingStockRoutes');
const creditSaleRoutes      = require('./routes/creditSaleRoutes');
const quotationRoutes       = require('./routes/quotationRoutes');
const priceRuleRoutes       = require('./routes/priceRuleRoutes');
const salesTargetRoutes     = require('./routes/salesTargetRoutes');
const deliveryRoutes        = require('./routes/deliveryRoutes');
const permissionRoutes      = require('./routes/permissionRoutes');
const tenantRoutes          = require('./routes/tenantRoutes');

// --- Module Guard (plan-based access) ---
const { requireModule } = require('./middleware/moduleGuard');

const app = express();

// ── Global Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors());   // Allow all origins — restrict in production via nginx/reverse proxy

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Request logger header
app.use((req, res, next) => {
  next();
});

// ── API Routes ───────────────────────────────────────────────

// Health check — public, no auth (used to wake up Render free tier)
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// Auth (no tenant guard needed — login resolves tenant itself)
app.use('/api/auth',    authRoutes);

// Tenant management (Admin-only, uses master DB)
app.use('/api/tenants', tenantRoutes);

// Core routes (available on all plans)
app.use('/api/users',           userRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/backup',          backupRoutes);
app.use('/api/permissions',     permissionRoutes);
app.use('/api/stores',          storeRoutes);
app.use('/api/analytics',       analyticsRoutes);

// Sales module (basic+)
app.use('/api/sales',           salesRoutes);
app.use('/api/register',        registerRoutes);
app.use('/api/returns',         returnRoutes);
app.use('/api/credit-sales',    creditSaleRoutes);
app.use('/api/quotations',      quotationRoutes);
app.use('/api/price-rules',     priceRuleRoutes);
app.use('/api/sales-targets',   salesTargetRoutes);
app.use('/api/deliveries',      deliveryRoutes);

// Inventory module (basic+)
app.use('/api/products',            productRoutes);
app.use('/api/variants',            variantRoutes);
app.use('/api/bundles',             bundleRoutes);
app.use('/api/inventory',           inventoryRoutes);
app.use('/api/suppliers',           supplierRoutes);
app.use('/api/purchase-orders',     purchaseOrderRoutes);
app.use('/api/stock-adjustments',   stockAdjustmentRoutes);
app.use('/api/stock-transfers',     stockTransferRoutes);
app.use('/api/sections',            sectionsRoutes);
app.use('/api/issuance',            issuanceRoutes);
app.use('/api/purchase-vouchers',   purchaseVoucherRoutes);
app.use('/api/purchase-returns',    purchaseReturnRoutes);
app.use('/api/opening-stock',       openingStockRoutes);

// Reports module (basic+)
app.use('/api/reports',             reportRoutes);
app.use('/api/sales-reports',       salesReportRoutes);
app.use('/api/inventory-reports',   inventoryReportRoutes);

// Accounting module — PROFESSIONAL+ only
// requireModule is applied INSIDE accountingRoutes (see Step 4 note)
app.use('/api/accounting',          accountingRoutes);

// HR/Payroll module — PROFESSIONAL+ only
app.use('/api/staff',               staffRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Serve React Frontend ──────────────────────────────────────
// Must be AFTER all /api routes so API calls are not intercepted.
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all: any non-API route returns index.html (SPA routing)
app.use((req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ message: err.message });
  }
  console.error('[ERROR]', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  AByte POS  –  Backend Server            ║`);
  console.log(`║  Listening on port ${PORT}                  ║`);
  console.log(`║  DB: ${(process.env.DB_NAME || 'abyte_pos').padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
