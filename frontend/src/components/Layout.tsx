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
  User,
  Search,
  Wallet,
  RotateCcw,
  ScrollText,
  Database,
  Sun,
  Moon,
  HelpCircle,
  Mail,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AIWidget from './AIWidget';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications] = useState([
    { id: 1, title: 'Low Stock Alert', message: 'Product ABC is running low', time: '5m ago', read: false },
    { id: 2, title: 'New Order', message: 'Order #1234 received', time: '10m ago', read: false },
    { id: 3, title: 'Payment Successful', message: 'Payment of $150 received', time: '1h ago', read: true },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  
  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['Admin', 'Manager', 'Cashier'], color: 'blue' },
    { icon: ShoppingCart, label: 'POS', path: '/pos', roles: ['Admin', 'Manager', 'Cashier'], color: 'emerald' },
    { icon: Wallet, label: 'Cash Register', path: '/cash-register', roles: ['Admin', 'Manager', 'Cashier'], color: 'amber' },
    { icon: Package, label: 'Inventory', path: '/inventory', roles: ['Admin', 'Manager'], color: 'purple' },
    { icon: RotateCcw, label: 'Returns', path: '/returns', roles: ['Admin', 'Manager'], color: 'orange' },
    { icon: Users, label: 'Customers', path: '/customers', roles: ['Admin', 'Manager', 'Cashier'], color: 'cyan' },
    { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['Admin', 'Manager'], color: 'indigo' },
    { icon: ScrollText, label: 'Audit Log', path: '/audit-log', roles: ['Admin', 'Manager'], color: 'pink' },
    { icon: Database, label: 'Backup', path: '/backup', roles: ['Admin'], color: 'teal' },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['Admin'], color: 'gray' },
  ];

  const menuItems = allMenuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Get page title based on current route
  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    return currentItem?.label || 'Dashboard';
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
                <p className="text-xs text-emerald-600 font-semibold capitalize">{user?.role || 'Staff'}</p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-200 scale-105' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:scale-105'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                {/* Active Indicator */}
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
                
                {/* Hover Effect */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10 rounded-xl" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        {!isCollapsed && (
          <div className="p-4 border-t-2 border-gray-100 bg-gray-50/50">
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                <HelpCircle size={18} />
                <span>Help & Support</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 md:hidden flex flex-col"
            >
              {/* Mobile Header */}
              <div className="h-20 flex items-center justify-between px-5 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    A
                  </div>
                  <div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">AByte</span>
                    <p className="text-xs text-gray-500 font-medium">Point of Sale</p>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={24} />
                </button>
              </div>

              {/* Mobile Menu Items */}
              <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={22} className={isActive ? 'text-white' : 'text-gray-400'} />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-20 bg-white border-b-2 border-gray-200/50 flex items-center justify-between px-6 z-10 shadow-sm">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2.5 text-gray-500 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 lg:hidden transition-all"
            >
              <Menu size={24} />
            </button>
            
            {/* Page Title */}
            <div className="hidden md:block">
              <h1 className="text-2xl font-bold text-gray-800">{getPageTitle()}</h1>
              <p className="text-sm text-gray-500">Welcome back, {user?.name?.split(' ')[0] || 'User'}! 👋</p>
            </div>

            {/* Search Bar */}
            <div className="relative hidden lg:block ml-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search products, customers, orders..." 
                className="pl-11 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-80 transition-all text-sm placeholder-gray-400"
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all border-2 border-transparent hover:border-gray-200"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotificationOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsNotificationOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border-2 border-gray-100 z-20 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b-2 border-gray-50 bg-gradient-to-r from-emerald-50 to-teal-50">
                        <p className="text-sm font-bold text-gray-800">Notifications</p>
                        <p className="text-xs text-gray-500">{unreadCount} unread messages</p>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                              !notif.read ? 'bg-blue-50/50' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-semibold text-gray-800">{notif.title}</p>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                          </div>
                        ))}
                      </div>

                      <div className="px-4 py-3 border-t-2 border-gray-50 bg-gray-50">
                        <button className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                          View all notifications →
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-xl hover:bg-gray-50 transition-all border-2 border-transparent hover:border-gray-200"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-800 leading-none">{user?.name || 'User'}</p>
                  <p className="text-xs text-emerald-600 mt-1 capitalize font-semibold">{user?.role || 'Staff'}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-emerald-100">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsProfileOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border-2 border-gray-100 py-2 z-20 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b-2 border-gray-50 bg-gradient-to-r from-emerald-50 to-teal-50">
                        <p className="text-sm font-bold text-gray-800">Signed in as</p>
                        <p className="text-sm text-gray-600 truncate font-medium">{user?.email || 'user@example.com'}</p>
                      </div>
                      
                      <div className="py-2">
                        <Link 
                          to="/settings" 
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-medium"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings size={18} />
                          Account Settings
                        </Link>
                        <Link 
                          to="/settings" 
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-medium"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <User size={18} />
                          My Profile
                        </Link>
                        <button 
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-medium"
                        >
                          <HelpCircle size={18} />
                          Help Center
                        </button>
                      </div>
                      
                      <div className="border-t-2 border-gray-50 pt-2 mt-2">
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all font-semibold"
                        >
                          <LogOut size={18} />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Page Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 p-6">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      {/* AI Widget */}
      <AIWidget />
    </div>
  );
};

export default Layout;