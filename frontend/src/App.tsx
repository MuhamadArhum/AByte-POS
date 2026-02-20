import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import CashRegister from './pages/CashRegister';
import Returns from './pages/Returns';
import AuditLog from './pages/AuditLog';
import Backup from './pages/Backup';
import Orders from './pages/Orders';
import Suppliers from './pages/Suppliers';
import Expenses from './pages/Expenses';
import Staff from './pages/Staff';
import Attendance from './pages/Attendance';
import PurchaseOrders from './pages/PurchaseOrders';
import StockAlerts from './pages/StockAlerts';
import Stores from './pages/Stores';
import Analytics from './pages/Analytics';
import Layout from './components/Layout';
import StaffReports from './pages/StaffReports';
import SalarySheet from './pages/SalarySheet';
import DailyAttendance from './pages/DailyAttendance';
import LoanManagement from './pages/LoanManagement';
import EmployeeLedger from './pages/EmployeeLedger';
import IncrementHistory from './pages/IncrementHistory';
import PayrollProcessing from './pages/PayrollProcessing';
import AdvancePayments from './pages/AdvancePayments';
import HolidayCalendar from './pages/HolidayCalendar';
import LeaveRequests from './pages/LeaveRequests';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import GeneralLedger from './pages/GeneralLedger';
import TrialBalance from './pages/TrialBalance';
import ProfitLoss from './pages/ProfitLoss';
import BalanceSheet from './pages/BalanceSheet';
import BankAccounts from './pages/BankAccounts';
import PaymentVouchers from './pages/PaymentVouchers';
import ReceiptVouchers from './pages/ReceiptVouchers';
import Categories from './pages/Categories';
import StockAdjustments from './pages/StockAdjustments';
import StockTransfers from './pages/StockTransfers';
import InventoryReports from './pages/InventoryReports';
import Quotations from './pages/Quotations';
import CreditSales from './pages/CreditSales';
import Layaway from './pages/Layaway';
import Coupons from './pages/Coupons';
import LoyaltyProgram from './pages/LoyaltyProgram';
import SalesReports from './pages/SalesReports';
import GiftCards from './pages/GiftCards';
import PriceRules from './pages/PriceRules';
import SalesTargets from './pages/SalesTargets';
import Invoices from './pages/Invoices';
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
