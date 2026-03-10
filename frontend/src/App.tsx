import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PermissionGuard from './components/PermissionGuard';
// Root Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

// Sales Module
import POS from './pages/sales/POS';
import Orders from './pages/sales/Orders';
import CashRegister from './pages/sales/CashRegister';
import Returns from './pages/sales/Returns';
import Quotations from './pages/sales/Quotations';
import CreditSales from './pages/sales/CreditSales';
import PriceRules from './pages/sales/PriceRules';
import SalesTargets from './pages/sales/SalesTargets';
import Invoices from './pages/sales/Invoices';
import SalesReports from './pages/sales/SalesReports';

// Inventory Module
import Inventory from './pages/inventory/Inventory';
import Categories from './pages/inventory/Categories';
import PurchaseOrders from './pages/inventory/PurchaseOrders';
import StockTransfers from './pages/inventory/StockTransfers';
import StockAdjustments from './pages/inventory/StockAdjustments';
import StockAlerts from './pages/inventory/StockAlerts';
import Suppliers from './pages/inventory/Suppliers';
import InventoryReports from './pages/inventory/InventoryReports';

// HR Module
import Customers from './pages/hr/Customers';
import Staff from './pages/hr/Staff';
import Attendance from './pages/hr/Attendance';
import DailyAttendance from './pages/hr/DailyAttendance';
import SalarySheet from './pages/hr/SalarySheet';
import PayrollProcessing from './pages/hr/PayrollProcessing';
import AdvancePayments from './pages/hr/AdvancePayments';
import LoanManagement from './pages/hr/LoanManagement';
import IncrementHistory from './pages/hr/IncrementHistory';
import EmployeeLedger from './pages/hr/EmployeeLedger';
import HolidayCalendar from './pages/hr/HolidayCalendar';
import LeaveRequests from './pages/hr/LeaveRequests';
import StaffReports from './pages/hr/StaffReports';

// Accounts Module
import ChartOfAccounts from './pages/accounts/ChartOfAccounts';
import JournalEntries from './pages/accounts/JournalEntries';
import GeneralLedger from './pages/accounts/GeneralLedger';
import TrialBalance from './pages/accounts/TrialBalance';
import ProfitLoss from './pages/accounts/ProfitLoss';
import BalanceSheet from './pages/accounts/BalanceSheet';
import BankAccounts from './pages/accounts/BankAccounts';
import PaymentVouchers from './pages/accounts/PaymentVouchers';
import ReceiptVouchers from './pages/accounts/ReceiptVouchers';
import Expenses from './pages/accounts/Expenses';
import Analytics from './pages/accounts/Analytics';
import Reports from './pages/accounts/Reports';

// System Module
import Stores from './pages/system/Stores';
import AuditLog from './pages/system/AuditLog';
import Backup from './pages/system/Backup';
import SettingsPage from './pages/system/Settings';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

// Sales Extra
import Layaway from './pages/sales/Layaway';
import Coupons from './pages/sales/Coupons';
import Loyalty from './pages/sales/LoyaltyProgram';
import GiftCards from './pages/sales/GiftCards';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      {/* Unguarded - all authenticated users */}
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/cash-register" element={<CashRegister />} />
                      <Route path="/customers" element={<PermissionGuard moduleKey="sales.customers"><Customers /></PermissionGuard>} />

                      {/* Sales */}
                      <Route path="/returns" element={<PermissionGuard moduleKey="sales.returns"><Returns /></PermissionGuard>} />
                      <Route path="/quotations" element={<PermissionGuard moduleKey="sales.quotations"><Quotations /></PermissionGuard>} />
                      <Route path="/credit-sales" element={<PermissionGuard moduleKey="sales.credit"><CreditSales /></PermissionGuard>} />
                      <Route path="/layaway" element={<PermissionGuard moduleKey="sales.layaway"><Layaway /></PermissionGuard>} />
                      <Route path="/coupons" element={<PermissionGuard moduleKey="sales.coupons"><Coupons /></PermissionGuard>} />
                      <Route path="/loyalty" element={<PermissionGuard moduleKey="sales.loyalty"><Loyalty /></PermissionGuard>} />
                      <Route path="/gift-cards" element={<PermissionGuard moduleKey="sales.giftcards"><GiftCards /></PermissionGuard>} />
                      <Route path="/price-rules" element={<PermissionGuard moduleKey="sales.pricerules"><PriceRules /></PermissionGuard>} />
                      <Route path="/sales-targets" element={<PermissionGuard moduleKey="sales.targets"><SalesTargets /></PermissionGuard>} />
                      <Route path="/invoices" element={<PermissionGuard moduleKey="sales.invoices"><Invoices /></PermissionGuard>} />
                      <Route path="/sales-reports" element={<PermissionGuard moduleKey="sales.reports"><SalesReports /></PermissionGuard>} />

                      {/* Inventory */}
                      <Route path="/inventory" element={<PermissionGuard moduleKey="inventory.products"><Inventory /></PermissionGuard>} />
                      <Route path="/categories" element={<PermissionGuard moduleKey="inventory.categories"><Categories /></PermissionGuard>} />
                      <Route path="/purchase-orders" element={<PermissionGuard moduleKey="inventory.purchases"><PurchaseOrders /></PermissionGuard>} />
                      <Route path="/stock-transfers" element={<PermissionGuard moduleKey="inventory.transfers"><StockTransfers /></PermissionGuard>} />
                      <Route path="/stock-adjustments" element={<PermissionGuard moduleKey="inventory.adjustments"><StockAdjustments /></PermissionGuard>} />
                      <Route path="/stock-alerts" element={<PermissionGuard moduleKey="inventory.alerts"><StockAlerts /></PermissionGuard>} />
                      <Route path="/suppliers" element={<PermissionGuard moduleKey="inventory.suppliers"><Suppliers /></PermissionGuard>} />
                      <Route path="/inventory-reports" element={<PermissionGuard moduleKey="inventory.reports"><InventoryReports /></PermissionGuard>} />

                      {/* HR */}
                      <Route path="/staff" element={<PermissionGuard moduleKey="hr.staff"><Staff /></PermissionGuard>} />
                      <Route path="/attendance" element={<PermissionGuard moduleKey="hr.attendance"><Attendance /></PermissionGuard>} />
                      <Route path="/daily-attendance" element={<PermissionGuard moduleKey="hr.daily-attendance"><DailyAttendance /></PermissionGuard>} />
                      <Route path="/salary-sheet" element={<PermissionGuard moduleKey="hr.salary-sheet"><SalarySheet /></PermissionGuard>} />
                      <Route path="/payroll" element={<PermissionGuard moduleKey="hr.payroll"><PayrollProcessing /></PermissionGuard>} />
                      <Route path="/advance-payments" element={<PermissionGuard moduleKey="hr.advances"><AdvancePayments /></PermissionGuard>} />
                      <Route path="/loans" element={<PermissionGuard moduleKey="hr.loans"><LoanManagement /></PermissionGuard>} />
                      <Route path="/increments" element={<PermissionGuard moduleKey="hr.increments"><IncrementHistory /></PermissionGuard>} />
                      <Route path="/employee-ledger" element={<PermissionGuard moduleKey="hr.ledger"><EmployeeLedger /></PermissionGuard>} />
                      <Route path="/holidays" element={<PermissionGuard moduleKey="hr.holidays"><HolidayCalendar /></PermissionGuard>} />
                      <Route path="/leave-requests" element={<PermissionGuard moduleKey="hr.leaves"><LeaveRequests /></PermissionGuard>} />
                      <Route path="/staff-reports" element={<PermissionGuard moduleKey="hr.reports"><StaffReports /></PermissionGuard>} />

                      {/* Accounts */}
                      <Route path="/chart-of-accounts" element={<PermissionGuard moduleKey="accounts.chart"><ChartOfAccounts /></PermissionGuard>} />
                      <Route path="/journal-entries" element={<PermissionGuard moduleKey="accounts.journal"><JournalEntries /></PermissionGuard>} />
                      <Route path="/general-ledger" element={<PermissionGuard moduleKey="accounts.ledger"><GeneralLedger /></PermissionGuard>} />
                      <Route path="/trial-balance" element={<PermissionGuard moduleKey="accounts.trial-balance"><TrialBalance /></PermissionGuard>} />
                      <Route path="/profit-loss" element={<PermissionGuard moduleKey="accounts.profit-loss"><ProfitLoss /></PermissionGuard>} />
                      <Route path="/balance-sheet" element={<PermissionGuard moduleKey="accounts.balance-sheet"><BalanceSheet /></PermissionGuard>} />
                      <Route path="/bank-accounts" element={<PermissionGuard moduleKey="accounts.bank-accounts"><BankAccounts /></PermissionGuard>} />
                      <Route path="/payment-vouchers" element={<PermissionGuard moduleKey="accounts.payment-vouchers"><PaymentVouchers /></PermissionGuard>} />
                      <Route path="/receipt-vouchers" element={<PermissionGuard moduleKey="accounts.receipt-vouchers"><ReceiptVouchers /></PermissionGuard>} />
                      <Route path="/expenses" element={<PermissionGuard moduleKey="accounts.expenses"><Expenses /></PermissionGuard>} />
                      <Route path="/analytics" element={<PermissionGuard moduleKey="accounts.analytics"><Analytics /></PermissionGuard>} />
                      <Route path="/reports" element={<PermissionGuard moduleKey="accounts.reports"><Reports /></PermissionGuard>} />

                      {/* System */}
                      <Route path="/stores" element={<PermissionGuard moduleKey="system.stores"><Stores /></PermissionGuard>} />
                      <Route path="/audit-log" element={<PermissionGuard moduleKey="system.audit"><AuditLog /></PermissionGuard>} />
                      <Route path="/backup" element={<PermissionGuard moduleKey="system.backup"><Backup /></PermissionGuard>} />
                      <Route path="/settings" element={<PermissionGuard moduleKey="system.settings"><SettingsPage /></PermissionGuard>} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
