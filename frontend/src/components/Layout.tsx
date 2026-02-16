import React, { useState } from 'react';
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
  Search,
  Wallet,
  RotateCcw,
  ScrollText,
  Database,
  DollarSign,
  Store,
  TrendingUp,
  HelpCircle,
  X,
  Calendar,
  FileText,
  BookOpen,
  Scale,
  FileBarChart,
  Book,
  Building2,
  CreditCard,
  Receipt,
  Tag,
  Star,
  Layers,
  PieChart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AIWidget from './AIWidget';

interface MenuItem {
  icon: any;
  label: string;
  path?: string;
  roles: string[];
  color?: string;
  children?: MenuItem[];
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      roles: ['Admin', 'Manager', 'Cashier'],
      color: 'blue'
    },
    {
      icon: ShoppingCart,
      label: 'Sales',
      roles: ['Admin', 'Manager', 'Cashier'],
      color: 'emerald',
      children: [
        { icon: ShoppingCart, label: 'POS', path: '/pos', roles: ['Admin', 'Manager', 'Cashier'] },
        { icon: ScrollText, label: 'Orders', path: '/orders', roles: ['Admin', 'Manager', 'Cashier'] },
        { icon: Wallet, label: 'Cash Register', path: '/cash-register', roles: ['Admin', 'Manager', 'Cashier'] },
        { icon: RotateCcw, label: 'Returns', path: '/returns', roles: ['Admin', 'Manager'] },
        { icon: FileText, label: 'Quotations', path: '/quotations', roles: ['Admin', 'Manager'] },
        { icon: BookOpen, label: 'Credit Sales', path: '/credit-sales', roles: ['Admin', 'Manager'] },
        { icon: Layers, label: 'Layaway', path: '/layaway', roles: ['Admin', 'Manager'] },
        { icon: Tag, label: 'Coupons', path: '/coupons', roles: ['Admin', 'Manager'] },
        { icon: Star, label: 'Loyalty Program', path: '/loyalty', roles: ['Admin', 'Manager'] },
        { icon: PieChart, label: 'Sales Reports', path: '/sales-reports', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      icon: Package,
      label: 'Inventory',
      roles: ['Admin', 'Manager'],
      color: 'purple',
      children: [
        { icon: Package, label: 'Products', path: '/inventory', roles: ['Admin', 'Manager'] },
        { icon: ScrollText, label: 'Categories', path: '/categories', roles: ['Admin', 'Manager'] },
        { icon: Package, label: 'Purchase Orders', path: '/purchase-orders', roles: ['Admin', 'Manager'] },
        { icon: RotateCcw, label: 'Stock Transfers', path: '/stock-transfers', roles: ['Admin', 'Manager'] },
        { icon: FileText, label: 'Stock Adjustments', path: '/stock-adjustments', roles: ['Admin', 'Manager'] },
        { icon: Bell, label: 'Stock Alerts', path: '/stock-alerts', roles: ['Admin', 'Manager'] },
        { icon: Users, label: 'Suppliers', path: '/suppliers', roles: ['Admin', 'Manager'] },
        { icon: BarChart3, label: 'Inventory Reports', path: '/inventory-reports', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      icon: Users,
      label: 'Human Resources',
      roles: ['Admin', 'Manager', 'Cashier'],
      color: 'cyan',
      children: [
        { icon: Users, label: 'Customers', path: '/customers', roles: ['Admin', 'Manager', 'Cashier'] },
        { icon: User, label: 'Staff', path: '/staff', roles: ['Admin'] },
        { icon: ScrollText, label: 'Attendance', path: '/attendance', roles: ['Admin', 'Manager'] },
        { icon: ScrollText, label: 'Daily Attendance', path: '/daily-attendance', roles: ['Admin', 'Manager'] },
        { icon: DollarSign, label: 'Salary Sheet', path: '/salary-sheet', roles: ['Admin', 'Manager'] },
        { icon: DollarSign, label: 'Payroll Processing', path: '/payroll', roles: ['Admin'] },
        { icon: DollarSign, label: 'Advance Payments', path: '/advance-payments', roles: ['Admin', 'Manager'] },
        { icon: DollarSign, label: 'Loans', path: '/loans', roles: ['Admin', 'Manager'] },
        { icon: TrendingUp, label: 'Increments', path: '/increments', roles: ['Admin', 'Manager'] },
        { icon: ScrollText, label: 'Employee Ledger', path: '/employee-ledger', roles: ['Admin', 'Manager'] },
        { icon: Calendar, label: 'Holidays', path: '/holidays', roles: ['Admin', 'Manager'] },
        { icon: FileText, label: 'Leave Requests', path: '/leave-requests', roles: ['Admin', 'Manager'] },
        { icon: BarChart3, label: 'Staff Reports', path: '/staff-reports', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      icon: DollarSign,
      label: 'Accounts',
      roles: ['Admin', 'Manager'],
      color: 'rose',
      children: [
        { icon: BookOpen, label: 'Chart of Accounts', path: '/chart-of-accounts', roles: ['Admin', 'Manager'] },
        { icon: FileText, label: 'Journal Entries', path: '/journal-entries', roles: ['Admin', 'Manager'] },
        { icon: Book, label: 'General Ledger', path: '/general-ledger', roles: ['Admin', 'Manager'] },
        { icon: Scale, label: 'Trial Balance', path: '/trial-balance', roles: ['Admin', 'Manager'] },
        { icon: TrendingUp, label: 'Profit & Loss', path: '/profit-loss', roles: ['Admin', 'Manager'] },
        { icon: FileBarChart, label: 'Balance Sheet', path: '/balance-sheet', roles: ['Admin', 'Manager'] },
        { icon: Building2, label: 'Bank Accounts', path: '/bank-accounts', roles: ['Admin', 'Manager'] },
        { icon: CreditCard, label: 'Payment Vouchers', path: '/payment-vouchers', roles: ['Admin', 'Manager'] },
        { icon: Receipt, label: 'Receipt Vouchers', path: '/receipt-vouchers', roles: ['Admin', 'Manager'] },
        { icon: Wallet, label: 'Expenses', path: '/expenses', roles: ['Admin', 'Manager'] },
        { icon: TrendingUp, label: 'Analytics', path: '/analytics', roles: ['Admin', 'Manager', 'Cashier'] },
        { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      icon: Settings,
      label: 'System',
      roles: ['Admin', 'Manager'],
      color: 'gray',
      children: [
        { icon: Store, label: 'Stores', path: '/stores', roles: ['Admin'] },
        { icon: ScrollText, label: 'Audit Log', path: '/audit-log', roles: ['Admin', 'Manager'] },
        { icon: Database, label: 'Backup', path: '/backup', roles: ['Admin'] },
        { icon: Settings, label: 'Settings', path: '/settings', roles: ['Admin'] },
      ]
    }
  ];

  const filterMenuByRole = (items: MenuItem[]): MenuItem[] => {
    const userRole = user?.role_name || user?.role;
    if (!userRole) return [];

    return items.filter(item => {
      if (!item.roles.includes(userRole)) return false;
      if (item.children) {
        item.children = filterMenuByRole(item.children);
        return item.children.length > 0;
      }
      return true;
    });
  };

  const filteredMenu = filterMenuByRole(menuStructure);

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
    const isParentActive = hasChildren && item.children.some(child => child.path === location.pathname);

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
                {item.children.map((child, childIndex) => {
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
              <h1 className="text-2xl font-bold text-gray-800">AByte POS</h1>
              <p className="text-sm text-gray-500">Complete Business Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* User Profile */}
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-xl transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="text-left hidden lg:block">
                <p className="text-sm font-semibold text-gray-800">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role_name || user?.role}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* AI Widget */}
      <AIWidget />
    </div>
  );
};

export default Layout;
