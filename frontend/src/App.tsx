import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
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
import Layaway from './pages/sales/Layaway';
import Coupons from './pages/sales/Coupons';
import LoyaltyProgram from './pages/sales/LoyaltyProgram';
import GiftCards from './pages/sales/GiftCards';
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

// Role Protected Route Component
const RoleRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  // Support both role_name (backend sends this) and role (backward compatibility)
  const userRole = user?.role_name || user?.role;

  if (!user || !userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
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
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/cash-register" element={<CashRegister />} />
                      <Route
                        path="/inventory"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Inventory />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/returns"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Returns />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Reports />
                          </RoleRoute>
                        }
                      />
                      <Route path="/customers" element={<Customers />} />
                      <Route
                        path="/audit-log"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <AuditLog />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/backup"
                        element={
                          <RoleRoute allowedRoles={['Admin']}>
                            <Backup />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/suppliers"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Suppliers />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/expenses"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Expenses />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/staff"
                        element={
                          <RoleRoute allowedRoles={['Admin']}>
                            <Staff />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/attendance"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Attendance />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/purchase-orders"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <PurchaseOrders />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/stock-alerts"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <StockAlerts />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/categories"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Categories />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/stock-adjustments"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <StockAdjustments />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/stock-transfers"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <StockTransfers />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/inventory-reports"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <InventoryReports />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/stores"
                        element={
                          <RoleRoute allowedRoles={['Admin']}>
                            <Stores />
                          </RoleRoute>
                        }
                      />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route
                        path="/staff-reports"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <StaffReports />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/salary-sheet"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <SalarySheet />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/daily-attendance"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <DailyAttendance />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/loans"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <LoanManagement />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/employee-ledger"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <EmployeeLedger />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/increments"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <IncrementHistory />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/payroll"
                        element={
                          <RoleRoute allowedRoles={['Admin']}>
                            <PayrollProcessing />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/advance-payments"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <AdvancePayments />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/holidays"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <HolidayCalendar />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/leave-requests"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <LeaveRequests />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/chart-of-accounts"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <ChartOfAccounts />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/journal-entries"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <JournalEntries />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/general-ledger"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <GeneralLedger />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/trial-balance"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <TrialBalance />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/profit-loss"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <ProfitLoss />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/balance-sheet"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <BalanceSheet />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/bank-accounts"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <BankAccounts />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/payment-vouchers"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <PaymentVouchers />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/receipt-vouchers"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <ReceiptVouchers />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/quotations"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Quotations />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/credit-sales"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <CreditSales />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/layaway"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Layaway />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/coupons"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Coupons />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/loyalty"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <LoyaltyProgram />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/sales-reports"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <SalesReports />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/gift-cards"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <GiftCards />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/price-rules"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <PriceRules />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/sales-targets"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <SalesTargets />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/invoices"
                        element={
                          <RoleRoute allowedRoles={['Admin', 'Manager']}>
                            <Invoices />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <RoleRoute allowedRoles={['Admin']}>
                            <SettingsPage />
                          </RoleRoute>
                        }
                      />
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
