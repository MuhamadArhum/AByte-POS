import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  Wallet,
  RotateCcw,
  ScrollText,
  Database,
  DollarSign,
  Store,
  TrendingUp,
  HelpCircle,
  Calendar,
  FileText,
  BookOpen,
  Scale,
  FileBarChart,
  Book,
  Building2,
  CreditCard,
  Receipt,
  PieChart,
  Percent,
  Target,
  FileCheck,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AIWidget from './AIWidget';

interface MenuItem {
  icon: any;
  label: string;
  path?: string;
  moduleKey?: string;
  color?: string;
  children?: MenuItem[];
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    sales: false,
    inventory: false,
    'human resources': false,
    accounts: false,
    system: false
  });
  const [notifications] = useState([
    { id: 1, title: 'Low Stock Alert', message: 'Product ABC is running low', time: '5m ago', read: false },
    { id: 2, title: 'New Order', message: 'Order #1234 received', time: '10m ago', read: false },
    { id: 3, title: 'Payment Successful', message: 'Payment of $150 received', time: '1h ago', read: true },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const menuStructure: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/',
      moduleKey: 'dashboard',
      color: 'blue'
    },
    {
      icon: ShoppingCart,
      label: 'Sales',
      moduleKey: 'sales',
      color: 'emerald',
      children: [
        { icon: ShoppingCart, label: 'POS', path: '/pos', moduleKey: 'sales.pos' },
        { icon: Users, label: 'Customers', path: '/customers', moduleKey: 'sales.customers' },
        { icon: Wallet, label: 'Cash Register', path: '/cash-register', moduleKey: 'sales.register' },
        { icon: RotateCcw, label: 'Returns', path: '/returns', moduleKey: 'sales.returns' },
        { icon: FileText, label: 'Quotations', path: '/quotations', moduleKey: 'sales.quotations' },
        { icon: BookOpen, label: 'Credit Sales', path: '/credit-sales', moduleKey: 'sales.credit' },
        { icon: Wallet, label: 'Layaway', path: '/layaway', moduleKey: 'sales.layaway' },
        { icon: Tag, label: 'Coupons', path: '/coupons', moduleKey: 'sales.coupons' },
        { icon: CreditCard, label: 'Loyalty', path: '/loyalty', moduleKey: 'sales.loyalty' },
        { icon: Receipt, label: 'Gift Cards', path: '/gift-cards', moduleKey: 'sales.giftcards' },
        { icon: Percent, label: 'Price Rules', path: '/price-rules', moduleKey: 'sales.pricerules' },
        { icon: Target, label: 'Sales Targets', path: '/sales-targets', moduleKey: 'sales.targets' },
        { icon: FileCheck, label: 'Invoices', path: '/invoices', moduleKey: 'sales.invoices' },
        { icon: PieChart, label: 'Sales Reports', path: '/sales-reports', moduleKey: 'sales.reports' },
      ]
    },
    {
      icon: Package,
      label: 'Inventory',
      moduleKey: 'inventory',
      color: 'purple',
      children: [
        { icon: Package, label: 'Products', path: '/inventory', moduleKey: 'inventory.products' },
        { icon: ScrollText, label: 'Categories', path: '/categories', moduleKey: 'inventory.categories' },
        { icon: Package, label: 'Purchase Orders', path: '/purchase-orders', moduleKey: 'inventory.purchases' },
        { icon: RotateCcw, label: 'Stock Transfers', path: '/stock-transfers', moduleKey: 'inventory.transfers' },
        { icon: FileText, label: 'Stock Adjustments', path: '/stock-adjustments', moduleKey: 'inventory.adjustments' },
        { icon: Bell, label: 'Stock Alerts', path: '/stock-alerts', moduleKey: 'inventory.alerts' },
        { icon: Users, label: 'Suppliers', path: '/suppliers', moduleKey: 'inventory.suppliers' },
        { icon: BarChart3, label: 'Inventory Reports', path: '/inventory-reports', moduleKey: 'inventory.reports' },
      ]
    },
    {
      icon: Users,
      label: 'Human Resources',
      moduleKey: 'hr',
      color: 'cyan',
      children: [
        { icon: User, label: 'Staff', path: '/staff', moduleKey: 'hr.staff' },
        { icon: ScrollText, label: 'Attendance', path: '/attendance', moduleKey: 'hr.attendance' },
        { icon: ScrollText, label: 'Daily Attendance', path: '/daily-attendance', moduleKey: 'hr.daily-attendance' },
        { icon: DollarSign, label: 'Salary Sheet', path: '/salary-sheet', moduleKey: 'hr.salary-sheet' },
        { icon: DollarSign, label: 'Payroll Processing', path: '/payroll', moduleKey: 'hr.payroll' },
        { icon: DollarSign, label: 'Advance Payments', path: '/advance-payments', moduleKey: 'hr.advances' },
        { icon: DollarSign, label: 'Loans', path: '/loans', moduleKey: 'hr.loans' },
        { icon: TrendingUp, label: 'Increments', path: '/increments', moduleKey: 'hr.increments' },
        { icon: ScrollText, label: 'Employee Ledger', path: '/employee-ledger', moduleKey: 'hr.ledger' },
        { icon: Calendar, label: 'Holidays', path: '/holidays', moduleKey: 'hr.holidays' },
        { icon: FileText, label: 'Leave Requests', path: '/leave-requests', moduleKey: 'hr.leaves' },
        { icon: BarChart3, label: 'Staff Reports', path: '/staff-reports', moduleKey: 'hr.reports' },
      ]
    },
    {
      icon: DollarSign,
      label: 'Accounts',
      moduleKey: 'accounts',
      color: 'rose',
      children: [
        { icon: BookOpen, label: 'Chart of Accounts', path: '/chart-of-accounts', moduleKey: 'accounts.chart' },
        { icon: FileText, label: 'Journal Entries', path: '/journal-entries', moduleKey: 'accounts.journal' },
        { icon: Book, label: 'General Ledger', path: '/general-ledger', moduleKey: 'accounts.ledger' },
        { icon: Scale, label: 'Trial Balance', path: '/trial-balance', moduleKey: 'accounts.trial-balance' },
        { icon: TrendingUp, label: 'Profit & Loss', path: '/profit-loss', moduleKey: 'accounts.profit-loss' },
        { icon: FileBarChart, label: 'Balance Sheet', path: '/balance-sheet', moduleKey: 'accounts.balance-sheet' },
        { icon: Building2, label: 'Bank Accounts', path: '/bank-accounts', moduleKey: 'accounts.bank-accounts' },
        { icon: CreditCard, label: 'Payment Vouchers', path: '/payment-vouchers', moduleKey: 'accounts.payment-vouchers' },
        { icon: Receipt, label: 'Receipt Vouchers', path: '/receipt-vouchers', moduleKey: 'accounts.receipt-vouchers' },
        { icon: Wallet, label: 'Expenses', path: '/expenses', moduleKey: 'accounts.expenses' },
        { icon: TrendingUp, label: 'Analytics', path: '/analytics', moduleKey: 'accounts.analytics' },
        { icon: BarChart3, label: 'Reports', path: '/reports', moduleKey: 'accounts.reports' },
      ]
    },
    {
      icon: Settings,
      label: 'System',
      moduleKey: 'system',
      color: 'gray',
      children: [
        { icon: Store, label: 'Stores', path: '/stores', moduleKey: 'system.stores' },
        { icon: ScrollText, label: 'Audit Log', path: '/audit-log', moduleKey: 'system.audit' },
        { icon: Database, label: 'Backup', path: '/backup', moduleKey: 'system.backup' },
        { icon: Settings, label: 'Settings', path: '/settings', moduleKey: 'system.settings' },
      ]
    }
  ];

  const filterMenuByPermission = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => item.moduleKey ? hasPermission(item.moduleKey) : true)
      .map(item => ({
        ...item,
        children: item.children ? filterMenuByPermission(item.children) : undefined,
      }))
      .filter(item => !item.children || item.children.length > 0);
  };

  const filteredMenu = filterMenuByPermission(menuStructure);

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderMenuItem = (item: MenuItem, index: number) => {
    const Icon = item.icon;
    const menuKey = item.label.toLowerCase();
    const isExpanded = expandedMenus[menuKey];
    const isActive = item.path && location.pathname === item.path;
    const hasChildren = item.children && item.children.length > 0;
    const isParentActive = hasChildren && item.children!.some(child => child.path === location.pathname);

    if (hasChildren && !isCollapsed) {
      return (
        <div key={index} className="space-y-1">
          {/* Parent Menu Item */}
          <button
            onClick={() => toggleMenu(menuKey)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isParentActive
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                size={20}
                className={`flex-shrink-0 ${
                  isParentActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-emerald-600'
                }`}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {isExpanded ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>

          {/* Children Menu Items */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-4 space-y-1 border-l-2 border-gray-100 pl-2"
              >
                {item.children!.map((child, childIndex) => {
                  const ChildIcon = child.icon;
                  const isChildActive = child.path && location.pathname === child.path;
                  return (
                    <Link
                      key={childIndex}
                      to={child.path!}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                        isChildActive
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-md'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <ChildIcon
                        size={18}
                        className={`flex-shrink-0 ${
                          isChildActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-600'
                        }`}
                      />
                      <span className="text-sm">{child.label}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Single menu item (no children) or collapsed view
    if (item.path) {
      return (
        <Link
          key={index}
          to={item.path}
          className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
            isActive
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-200 scale-105'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:scale-105'
          } ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? item.label : ''}
        >
          {isActive && !isCollapsed && (
            <motion.div
              layoutId="activeTab"
              className="absolute left-0 top-0 bottom-0 w-1.5 bg-white rounded-r-full"
              transition={{ type: "spring", duration: 0.5 }}
            />
          )}

          <Icon
            size={22}
            className={`flex-shrink-0 transition-transform duration-200 ${
              isActive
                ? 'text-white scale-110'
                : 'text-gray-400 group-hover:text-emerald-600 group-hover:scale-110'
            }`}
          />
          {!isCollapsed && (
            <span className="whitespace-nowrap overflow-hidden text-sm">
              {item.label}
            </span>
          )}

          {!isActive && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10 rounded-xl" />
          )}
        </Link>
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${isCollapsed ? 'w-20' : 'w-72'} bg-white border-r-2 border-gray-200/50 flex flex-col shadow-xl z-20 transition-all duration-300 ease-in-out relative hidden md:flex`}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-5 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 overflow-hidden whitespace-nowrap"
            >
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0 ring-4 ring-emerald-100">
                A
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">AByte</span>
                <p className="text-xs text-gray-500 font-medium">Point of Sale</p>
              </div>
            </motion.div>
          )}
          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ring-emerald-100">
                A
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-white text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 absolute -right-4 top-24 border-2 border-gray-200 shadow-lg z-30 hover:scale-110"
          >
             {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* User Info Card - Only show when not collapsed */}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-emerald-600 font-semibold capitalize">{user?.role_name || user?.role || 'Staff'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {filteredMenu.map((item, index) => renderMenuItem(item, index))}
        </nav>

        {/* Bottom Section */}
        {!isCollapsed && (
          <div className="p-4 border-t-2 border-gray-100 bg-gray-50/50">
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                <HelpCircle size={18} />
                <span>Help & Support</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-20 bg-white border-b-2 border-gray-200/50 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">AByte POS</h1>
              <p className="text-sm text-gray-500">Complete Business Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setIsNotificationOpen(!isNotificationOpen); setIsProfileOpen(false); }}
                className="relative p-2.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? 'bg-emerald-50/40' : ''}`}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${!n.read ? 'text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 truncate">{n.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{n.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <button className="w-full text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotificationOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-200"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name || 'User'}</p>
                  <p className="text-xs text-emerald-600 font-medium capitalize">{user?.role_name || user?.role}</p>
                </div>
                <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  {/* User Info Header */}
                  <div className="px-4 py-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-emerald-600 font-medium capitalize">{user?.role_name || user?.role || 'Staff'}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <Settings size={16} className="text-gray-400" />
                      Settings
                    </Link>
                    <Link
                      to="/audit-log"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <ScrollText size={16} className="text-gray-400" />
                      Activity Log
                    </Link>
                  </div>

                  <div className="py-2 border-t border-gray-100">
                    <button
                      onClick={() => { setIsProfileOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-40 flex flex-col md:hidden"
            >
              {/* Logo */}
              <div className="h-20 flex items-center gap-3 px-5 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                  A
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">AByte</span>
                  <p className="text-xs text-gray-500 font-medium">Point of Sale</p>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-500" />
                </button>
              </div>

              {/* User card */}
              <div className="mx-4 mt-4 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-emerald-600 font-semibold capitalize">{user?.role_name || 'Staff'}</p>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                {filteredMenu.map((item, index) => renderMenuItem(item, index))}
              </nav>

              {/* Bottom */}
              <div className="p-4 border-t-2 border-gray-100">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* AI Widget */}
      <AIWidget />
    </div>
  );
};

export default Layout;
