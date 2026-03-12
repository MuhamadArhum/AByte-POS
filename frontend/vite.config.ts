import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: false,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts (recharts is heavy)
          'vendor-charts': ['recharts'],
          // Animation
          'vendor-motion': ['framer-motion'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // QZ Tray (printer bridge)
          'vendor-qz': ['qz-tray'],
          // Accounting pages
          'pages-accounts': [
            './src/pages/accounts/ChartOfAccounts',
            './src/pages/accounts/JournalEntries',
            './src/pages/accounts/GeneralLedger',
            './src/pages/accounts/TrialBalance',
            './src/pages/accounts/ProfitLoss',
            './src/pages/accounts/BalanceSheet',
            './src/pages/accounts/BankAccounts',
            './src/pages/accounts/PaymentVouchers',
            './src/pages/accounts/ReceiptVouchers',
          ],
          // HR pages
          'pages-hr': [
            './src/pages/hr/Staff',
            './src/pages/hr/Attendance',
            './src/pages/hr/DailyAttendance',
            './src/pages/hr/SalarySheet',
            './src/pages/hr/PayrollProcessing',
            './src/pages/hr/AdvancePayments',
            './src/pages/hr/LoanManagement',
            './src/pages/hr/HolidayCalendar',
            './src/pages/hr/LeaveRequests',
            './src/pages/hr/StaffReports',
            './src/pages/hr/EmployeeLedger',
            './src/pages/hr/IncrementHistory',
          ],
          // Sales pages
          'pages-sales': [
            './src/pages/sales/SalesReports',
            './src/pages/sales/Quotations',
            './src/pages/sales/CreditSales',
            './src/pages/sales/Layaway',
            './src/pages/sales/Coupons',
            './src/pages/sales/GiftCards',
            './src/pages/sales/PriceRules',
            './src/pages/sales/SalesTargets',
            './src/pages/sales/Invoices',
            './src/pages/sales/LoyaltyProgram',
          ],
          // Inventory pages
          'pages-inventory': [
            './src/pages/inventory/Inventory',
            './src/pages/inventory/InventoryReports',
            './src/pages/inventory/StockAdjustments',
            './src/pages/inventory/StockTransfers',
            './src/pages/inventory/StockCount',
            './src/pages/inventory/PurchaseOrders',
            './src/pages/inventory/Bundles',
            './src/pages/inventory/ProductVariants',
          ],
        },
      },
    },
  },
})
