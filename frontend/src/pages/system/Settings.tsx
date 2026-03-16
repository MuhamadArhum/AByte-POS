import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Save,
  Building2,
  Phone,
  Mail,
  Globe,
  FileText,
  Loader2,
  Settings as SettingsIcon,
  Users,
  Shield,
  Plus,
  Trash2,
  Edit,
  X,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Server,
  Key,
  Printer,
  Hash,
  DollarSign,
  Package,
  Wifi,
  Usb,
  CheckCircle,
  XCircle,
  Play,
  Tag,
  RotateCcw,
  CreditCard,
  Truck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { isQZAvailable } from '../../utils/qzPrinter';

interface User {
  user_id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  role_id: number;
  created_at: string;
}

const Settings = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('store');

  // All settings from DB
  const [settings, setSettings] = useState<any>({
    store_name: '', address: '', phone: '', email: '', website: '',
    receipt_header: '', receipt_footer: '', receipt_logo: '',
    tax_rate: 0, currency_symbol: 'Rs.', default_delivery_charges: 0,
    low_stock_threshold: 10, default_payment_method: 'cash', auto_print_receipt: false,
    barcode_prefix: '', invoice_prefix: 'INV-', date_format: 'DD/MM/YYYY', timezone: 'Asia/Karachi',
    business_hours_open: '09:00', business_hours_close: '21:00',
    allow_negative_stock: false, discount_requires_approval: false, max_cashier_discount: 50,
    session_timeout_minutes: 480,
    receipt_show_store_name: true, receipt_show_address: true, receipt_show_phone: true, receipt_show_tax: true,
    receipt_paper_width: '80mm',
    printer_type: 'none', printer_ip: '', printer_port: 9100, printer_name: '', printer_paper_width: 80,
    view_completed_orders_password: '', refund_password: '', reports_password: ''
  });

  // Show/hide state for POS security password fields
  const [showViewCompletedPw, setShowViewCompletedPw] = useState(false);
  const [showRefundPw, setShowRefundPw] = useState(false);
  const [showReportsPw, setShowReportsPw] = useState(false);

  // Roles
  interface Role { role_id: number; role_name: string; }
  const [roles, setRoles] = useState<Role[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [roleError, setRoleError] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', name: '', email: '', password: '', role_id: 0 });
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Password
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new_password: false, confirm: false });

  // System info
  const [systemInfo, setSystemInfo] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Multi-printer management
  interface PrinterEntry {
    printer_id: number;
    name: string;
    type: 'network' | 'usb';
    ip_address: string | null;
    port: number;
    printer_share_name: string | null;
    paper_width: number;
    purpose: string;
    is_active: number;
  }
  type PrinterPurpose = 'receipt' | 'invoice' | 'quotation' | 'return_receipt' | 'credit_sale' | 'layaway_receipt';
  const [printers, setPrinters] = useState<PrinterEntry[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterEntry | null>(null);
  const [printerForm, setPrinterForm] = useState({ name: '', type: 'network' as 'network' | 'usb', ip_address: '', port: 9100, printer_share_name: '', paper_width: 80, purpose: 'receipt' as PrinterPurpose, is_active: true });
  const [printerSaving, setPrinterSaving] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<number | null>(null);
  const [printerTestResults, setPrinterTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [qzStatus, setQzStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  useEffect(() => {
    fetchSettings();
    if (currentUser?.role_name === 'Admin') {
      fetchUsers();
      fetchRoles();
      fetchPrinters();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'printer') {
      setQzStatus('checking');
      isQZAvailable().then(ok => setQzStatus(ok ? 'available' : 'unavailable'));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'system' && currentUser?.role_name === 'Admin' && !systemInfo) {
      fetchSystemInfo();
    }
    if (activeTab === 'access' && currentUser?.role_name === 'Admin') {
      fetchPermissions();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings({ ...settings, ...res.data });
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/users/roles');
      setRoles(res.data.data || []);
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const res = await api.get('/settings/system-info');
      setSystemInfo(res.data);
    } catch (err) {
      console.error('Failed to load system info', err);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await api.get('/settings/printers');
      setPrinters(res.data);
    } catch (err) {
      console.error('Failed to load printers', err);
    }
  };

  const openPrinterModal = (printer?: PrinterEntry) => {
    if (printer) {
      setEditingPrinter(printer);
      setPrinterForm({ name: printer.name, type: printer.type, ip_address: printer.ip_address || '', port: printer.port || 9100, printer_share_name: printer.printer_share_name || '', paper_width: printer.paper_width || 80, purpose: printer.purpose as PrinterPurpose, is_active: printer.is_active === 1 });
    } else {
      setEditingPrinter(null);
      setPrinterForm({ name: '', type: 'network', ip_address: '', port: 9100, printer_share_name: '', paper_width: 80, purpose: 'receipt', is_active: true });
    }
    setShowPrinterModal(true);
  };

  const handlePrinterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrinterSaving(true);
    try {
      if (editingPrinter) {
        await api.put(`/settings/printers/${editingPrinter.printer_id}`, printerForm);
        toast.success('Printer updated');
      } else {
        await api.post('/settings/printers', printerForm);
        toast.success('Printer added');
      }
      setShowPrinterModal(false);
      setEditingPrinter(null);
      fetchPrinters();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save printer');
    } finally {
      setPrinterSaving(false);
    }
  };

  const handleDeletePrinter = async (id: number) => {
    if (!confirm('Delete this printer?')) return;
    try {
      await api.delete(`/settings/printers/${id}`);
      toast.success('Printer deleted');
      fetchPrinters();
    } catch (err) {
      toast.error('Failed to delete printer');
    }
  };

  const handleTestPrinterById = async (printer: PrinterEntry) => {
    setTestingPrinterId(printer.printer_id);
    setPrinterTestResults(prev => { const n = { ...prev }; delete n[printer.printer_id]; return n; });
    try {
      const res = await api.post(`/settings/printers/${printer.printer_id}/test`);
      setPrinterTestResults(prev => ({ ...prev, [printer.printer_id]: { success: true, message: res.data.message } }));
    } catch (err: any) {
      setPrinterTestResults(prev => ({ ...prev, [printer.printer_id]: { success: false, message: err.response?.data?.message || 'Test failed' } }));
    } finally {
      setTestingPrinterId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const payload: any = { username: userForm.username, name: userForm.name, email: userForm.email, role_id: userForm.role_id };
        if (userForm.password) payload.password = userForm.password;
        await api.put(`/users/${editingUser.user_id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', userForm);
        toast.success('User created');
      }
      setShowUserModal(false);
      setEditingUser(null);
      const defaultRoleId = roles.find(r => r.role_name === 'Cashier')?.role_id || roles.find(r => r.role_name !== 'Admin')?.role_id || 0;
      setUserForm({ username: '', name: '', email: '', password: '', role_id: defaultRoleId });
      setShowUserPassword(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const handleCreateRole = async () => {
    setRoleError('');
    if (!newRoleName.trim()) return setRoleError('Role name is required');
    setRoleSaving(true);
    try {
      await api.post('/users/roles', { role_name: newRoleName.trim() });
      toast.success(`Role "${newRoleName.trim()}" created`);
      setShowRoleModal(false);
      setNewRoleName('');
      fetchRoles();
    } catch (err: any) {
      setRoleError(err.response?.data?.message || 'Failed to create role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/roles/${roleId}`);
      toast.success(`Role "${roleName}" deleted`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.post('/settings/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const openUserModal = (user?: User) => {
    const defaultRoleId = roles.find(r => r.role_name === 'Cashier')?.role_id || roles.find(r => r.role_name !== 'Admin')?.role_id || 0;
    if (user) {
      setEditingUser(user);
      setUserForm({ username: user.username, name: user.name, email: user.email, password: '', role_id: user.role_id });
    } else {
      setEditingUser(null);
      setUserForm({ username: '', name: '', email: '', password: '', role_id: defaultRoleId });
    }
    setShowUserModal(true);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // ===== ACCESS CONTROL STATE =====
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={40} />
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  const MODULE_TREE = [
    {
      key: 'dashboard', label: 'Dashboard', children: [],
    },
    {
      key: 'sales', label: 'Sales', children: [
        { key: 'sales.pos', label: 'POS Terminal' },
        { key: 'sales.orders', label: 'Orders' },
        { key: 'sales.register', label: 'Cash Register' },
        { key: 'sales.returns', label: 'Returns' },
        { key: 'sales.quotations', label: 'Quotations' },
        { key: 'sales.credit', label: 'Credit Sales' },
        { key: 'sales.pricerules', label: 'Price Rules' },
        { key: 'sales.targets', label: 'Sales Targets' },
        { key: 'sales.deliveries', label: 'Deliveries' },
        { key: 'sales.reports', label: 'Sales Reports' },
      ],
    },
    {
      key: 'inventory', label: 'Inventory', children: [
        { key: 'inventory.products', label: 'Products' },
        { key: 'inventory.categories', label: 'Categories' },
        { key: 'inventory.purchases', label: 'Purchase Orders' },
        { key: 'inventory.transfers', label: 'Stock Transfers' },
        { key: 'inventory.adjustments', label: 'Stock Adjustments' },
        { key: 'inventory.alerts', label: 'Stock Alerts' },
        { key: 'inventory.suppliers', label: 'Suppliers' },
        { key: 'inventory.reports', label: 'Inventory Reports' },
      ],
    },
    {
      key: 'hr', label: 'Human Resources', children: [
        { key: 'hr.customers', label: 'Customers' },
        { key: 'hr.staff', label: 'Staff' },
        { key: 'hr.attendance', label: 'Attendance' },
        { key: 'hr.daily-attendance', label: 'Daily Attendance' },
        { key: 'hr.salary-sheet', label: 'Salary Sheet' },
        { key: 'hr.payroll', label: 'Payroll Processing' },
        { key: 'hr.advances', label: 'Advance Payments' },
        { key: 'hr.loans', label: 'Loans' },
        { key: 'hr.increments', label: 'Increments' },
        { key: 'hr.ledger', label: 'Employee Ledger' },
        { key: 'hr.holidays', label: 'Holidays' },
        { key: 'hr.leaves', label: 'Leave Requests' },
        { key: 'hr.reports', label: 'Staff Reports' },
      ],
    },
    {
      key: 'accounts', label: 'Accounts', children: [
        { key: 'accounts.chart', label: 'Chart of Accounts' },
        { key: 'accounts.journal', label: 'Journal Entries' },
        { key: 'accounts.ledger', label: 'General Ledger' },
        { key: 'accounts.trial-balance', label: 'Trial Balance' },
        { key: 'accounts.profit-loss', label: 'Profit & Loss' },
        { key: 'accounts.balance-sheet', label: 'Balance Sheet' },
        { key: 'accounts.bank-accounts', label: 'Bank Accounts' },
        { key: 'accounts.payment-vouchers', label: 'Payment Vouchers' },
        { key: 'accounts.receipt-vouchers', label: 'Receipt Vouchers' },
        { key: 'accounts.expenses', label: 'Expenses' },
        { key: 'accounts.analytics', label: 'Analytics' },
        { key: 'accounts.reports', label: 'Reports' },
      ],
    },
    {
      key: 'system', label: 'System', children: [
        { key: 'system.stores', label: 'Stores' },
        { key: 'system.audit', label: 'Audit Log' },
        { key: 'system.backup', label: 'Backup' },
        { key: 'system.settings', label: 'Settings' },
        { key: 'system.ai_widget', label: 'AI Assistant' },
      ],
    },
  ];

  const fetchPermissions = async () => {
    setPermLoading(true);
    try {
      const res = await api.get('/permissions');
      const data = res.data as Record<string, string[]>;
      const mapped: Record<string, Set<string>> = {};
      for (const [role, keys] of Object.entries(data)) {
        mapped[role] = new Set(keys);
      }
      setPerms(mapped);
    } catch (err) {
      console.error('Failed to load permissions', err);
      toast.error('Failed to load permissions');
    } finally {
      setPermLoading(false);
    }
  };

  const savePermissions = async (role: string) => {
    setPermSaving(prev => ({ ...prev, [role]: true }));
    try {
      await api.put(`/permissions/${role}`, { permissions: Array.from(perms[role] || []) });
      toast.success(`${role} permissions saved`);
    } catch (err) {
      console.error('Failed to save permissions', err);
      toast.error('Failed to save permissions');
    } finally {
      setPermSaving(prev => ({ ...prev, [role]: false }));
    }
  };

  const togglePerm = (role: string, key: string, isParent: boolean, childKeys: string[]) => {
    setPerms(prev => {
      const next = new Set(prev[role] || []);
      if (isParent) {
        if (next.has(key)) {
          // Parent OFF → remove parent + all children
          next.delete(key);
          childKeys.forEach(c => next.delete(c));
        } else {
          // Parent ON → add parent only (children stay unchanged)
          next.add(key);
        }
      } else {
        // Child toggle
        const parentKey = key.split('.')[0];
        if (next.has(key)) {
          // Child OFF
          next.delete(key);
          // If no children of parent remain, also remove parent
          const siblingKeys = childKeys; // childKeys = all siblings
          const anyChildLeft = siblingKeys.some(c => c !== key && next.has(c));
          if (!anyChildLeft) next.delete(parentKey);
        } else {
          // Child ON → also auto-enable parent
          next.add(key);
          next.add(parentKey);
        }
      }
      return { ...prev, [role]: next };
    });
  };

  const tabs = [
    { id: 'store', name: 'Store Info', icon: Building2 },
    { id: 'receipt', name: 'Receipt & Invoice', icon: Receipt },
    { id: 'pos', name: 'POS Settings', icon: ShoppingCart },
    { id: 'users', name: 'Users', icon: Users, adminOnly: true },
    { id: 'printer', name: 'Printer', icon: Printer, adminOnly: true },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'system', name: 'System', icon: Server, adminOnly: true },
    { id: 'access', name: 'Access Control', icon: Lock, adminOnly: true },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 mb-2 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <SettingsIcon className="text-white" size={24} />
          </div>
          Settings & Configuration
        </h1>
        <p className="text-gray-600">Manage your store settings, users, and system configuration</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => {
            if (tab.adminOnly && currentUser?.role_name !== 'Admin') return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${activeTab === tab.id
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                <Icon size={20} />
                {tab.name}
              </button>
            );
          })}
        </div>

        <div className="p-8">

          {/* ========== STORE INFO TAB ========== */}
          {activeTab === 'store' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Store Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Store Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.store_name}
                      onChange={e => setSettings({ ...settings, store_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.phone}
                      onChange={e => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="email" value={settings.email}
                      onChange={e => setSettings({ ...settings, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.website}
                      onChange={e => setSettings({ ...settings, website: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Tax Rate (%)</label>
                  <input type="number" step="0.01" value={settings.tax_rate}
                    onChange={e => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Currency Symbol</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.currency_symbol}
                      onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="Rs." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business Hours - Open</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="time" value={settings.business_hours_open}
                      onChange={e => setSettings({ ...settings, business_hours_open: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business Hours - Close</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="time" value={settings.business_hours_close}
                      onChange={e => setSettings({ ...settings, business_hours_close: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <textarea value={settings.address} rows={3}
                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== RECEIPT & INVOICE TAB ========== */}
          {activeTab === 'receipt' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Receipt & Invoice Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Paper Width</label>
                  <select value={settings.receipt_paper_width}
                    onChange={e => setSettings({ ...settings, receipt_paper_width: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option value="58mm">58mm (Small)</option>
                    <option value="80mm">80mm (Standard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number Prefix</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.invoice_prefix}
                      onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="INV-" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Header Message</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.receipt_header || ''}
                      onChange={e => setSettings({ ...settings, receipt_header: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Welcome to our store!" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Footer Message</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.receipt_footer}
                      onChange={e => setSettings({ ...settings, receipt_footer: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Thank you for shopping with us!" />
                  </div>
                </div>
              </div>

              {/* Receipt Show/Hide Toggles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt Display Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'receipt_show_store_name', label: 'Show Store Name', icon: Building2 },
                    { key: 'receipt_show_address', label: 'Show Address', icon: Globe },
                    { key: 'receipt_show_phone', label: 'Show Phone Number', icon: Phone },
                    { key: 'receipt_show_tax', label: 'Show Tax Details', icon: DollarSign },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3">
                          <Icon size={20} className="text-gray-500" />
                          <span className="font-medium text-gray-700">{item.label}</span>
                        </div>
                        <div className="relative">
                          <input type="checkbox" className="sr-only peer"
                            checked={!!settings[item.key]}
                            onChange={e => setSettings({ ...settings, [item.key]: e.target.checked })} />
                          <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Receipt Preview */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt Preview</h3>
                <div className="max-w-xs mx-auto bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 font-mono text-sm text-center">
                  {settings.receipt_header && <p className="text-xs text-gray-500 mb-2">{settings.receipt_header}</p>}
                  {settings.receipt_show_store_name && <p className="font-bold text-lg">{settings.store_name || 'Store Name'}</p>}
                  {settings.receipt_show_address && settings.address && <p className="text-xs text-gray-500">{settings.address}</p>}
                  {settings.receipt_show_phone && settings.phone && <p className="text-xs text-gray-500">Tel: {settings.phone}</p>}
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  <p className="text-xs text-gray-400">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400">Invoice: {settings.invoice_prefix}000001</p>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  <div className="text-left text-xs space-y-1">
                    <div className="flex justify-between"><span>Sample Item x2</span><span>{settings.currency_symbol} 500.00</span></div>
                    <div className="flex justify-between"><span>Another Item x1</span><span>{settings.currency_symbol} 250.00</span></div>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  {settings.receipt_show_tax && (
                    <div className="text-left text-xs">
                      <div className="flex justify-between"><span>Subtotal</span><span>{settings.currency_symbol} 750.00</span></div>
                      <div className="flex justify-between text-gray-500"><span>Tax ({settings.tax_rate}%)</span><span>{settings.currency_symbol} {(750 * (settings.tax_rate || 0) / 100).toFixed(2)}</span></div>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm mt-1">
                    <span>Total</span>
                    <span>{settings.currency_symbol} {(750 + 750 * (settings.tax_rate || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  {settings.receipt_footer && <p className="text-xs text-gray-500">{settings.receipt_footer}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== POS SETTINGS TAB ========== */}
          {activeTab === 'pos' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">POS Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Payment Method</label>
                  <select value={settings.default_payment_method}
                    onChange={e => setSettings({ ...settings, default_payment_method: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Low Stock Alert Threshold</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="number" value={settings.low_stock_threshold}
                      onChange={e => setSettings({ ...settings, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="10" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Products below this quantity will show in alerts</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Barcode Prefix</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.barcode_prefix}
                      onChange={e => setSettings({ ...settings, barcode_prefix: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. AB" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Cashier Discount (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={settings.max_cashier_discount}
                    onChange={e => setSettings({ ...settings, max_cashier_discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  <p className="text-xs text-gray-500 mt-1">Maximum discount cashiers can apply (Admin/Manager have no limit)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Delivery Charges (Rs.)</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="number" step="1" min="0" value={settings.default_delivery_charges}
                      onChange={e => setSettings({ ...settings, default_delivery_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="0" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pre-filled in cart when Delivery mode is selected</p>
                </div>
              </div>

              {/* Toggle Options */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">POS Behavior</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'auto_print_receipt', label: 'Auto-Print Receipt After Sale', desc: 'Automatically print receipt when sale is completed', icon: Printer },
                    { key: 'allow_negative_stock', label: 'Allow Negative Stock', desc: 'Allow selling products even when stock is 0', icon: Package },
                    { key: 'discount_requires_approval', label: 'Discount Requires Approval', desc: 'Require manager approval for discounts above cashier limit', icon: Shield },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Icon size={20} className="text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 block">{item.label}</span>
                            <span className="text-xs text-gray-500">{item.desc}</span>
                          </div>
                        </div>
                        <div className="relative ml-4">
                          <input type="checkbox" className="sr-only peer"
                            checked={!!settings[item.key]}
                            onChange={e => setSettings({ ...settings, [item.key]: e.target.checked })} />
                          <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== PRINTER TAB ========== */}
          {activeTab === 'printer' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-6">

              {/* ── QZ Tray Status Banner (deployed only) ── */}
              {isDeployed && (
                <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                  qzStatus === 'available'   ? 'bg-emerald-50 border-emerald-200' :
                  qzStatus === 'unavailable' ? 'bg-amber-50 border-amber-200' :
                                               'bg-gray-50 border-gray-200'
                }`}>
                  {qzStatus === 'checking' && <Loader2 size={18} className="animate-spin text-gray-400 mt-0.5 shrink-0" />}
                  {qzStatus === 'available' && <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />}
                  {qzStatus === 'unavailable' && <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    {qzStatus === 'checking' && (
                      <p className="text-sm text-gray-600 font-medium">Checking QZ Tray status...</p>
                    )}
                    {qzStatus === 'available' && (
                      <>
                        <p className="text-sm font-semibold text-emerald-800">QZ Tray is running</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Network printer will be accessed directly from your browser. No backend needed.</p>
                      </>
                    )}
                    {qzStatus === 'unavailable' && (
                      <>
                        <p className="text-sm font-semibold text-amber-800">QZ Tray not detected on this PC</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Since this app is deployed on cloud, it cannot reach your local network printer directly.
                          Install <strong>QZ Tray</strong> on each cashier PC to enable automatic thermal printing.
                          Without it, printing will use the browser's print dialog instead.
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <a
                            href="https://qz.io/download/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition"
                          >
                            Download QZ Tray
                          </a>
                          <button
                            onClick={() => { setQzStatus('checking'); isQZAvailable().then(ok => setQzStatus(ok ? 'available' : 'unavailable')); }}
                            className="text-xs text-amber-700 underline hover:no-underline"
                          >
                            Re-check
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Printer Management</h2>
                  <p className="text-sm text-gray-500 mt-1">Add multiple printers and assign each to a specific purpose (Receipt, Invoice, Quotation)</p>
                </div>
                <button onClick={() => openPrinterModal()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition">
                  <Plus size={18} /> Add Printer
                </button>
              </div>

              {/* Purpose legend — Sales Module Sections */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sales Module — Printer Assignment Status</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { purpose: 'receipt',        label: 'POS Receipt',    desc: 'Sale receipts',       icon: Receipt },
                    { purpose: 'invoice',         label: 'Invoice',        desc: 'Customer invoices',   icon: FileText },
                    { purpose: 'quotation',       label: 'Quotation',      desc: 'Price quotes',        icon: Tag },
                    { purpose: 'return_receipt',  label: 'Return Receipt', desc: 'Return/exchange',     icon: RotateCcw },
                    { purpose: 'credit_sale',     label: 'Credit Sale',    desc: 'Credit documents',    icon: CreditCard },
                    { purpose: 'layaway_receipt', label: 'Layaway',        desc: 'Layaway receipts',    icon: Package },
                  ].map(item => {
                    const Icon = item.icon;
                    const hasPrinter = printers.some(p => p.purpose === item.purpose && p.is_active);
                    return (
                      <div key={item.purpose} className={`p-3 rounded-xl border-2 ${hasPrinter ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={hasPrinter ? 'text-emerald-600' : 'text-gray-400'} />
                          <span className="font-semibold text-xs text-gray-700">{item.label}</span>
                          {hasPrinter ? <CheckCircle size={12} className="text-emerald-500 ml-auto" /> : <XCircle size={12} className="text-gray-300 ml-auto" />}
                        </div>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                        <p className={`text-xs font-semibold mt-1 ${hasPrinter ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {hasPrinter ? '✓ Configured' : 'Not set'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Printers List */}
              {printers.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                  <Printer size={40} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No printers added yet</p>
                  <p className="text-sm text-gray-400 mb-4">Add your first printer to enable direct printing</p>
                  <button onClick={() => openPrinterModal()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold">
                    Add First Printer
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {printers.map(printer => {
                    const testResult = printerTestResults[printer.printer_id];
                    const purposeColors: Record<string, string> = { receipt: 'bg-emerald-100 text-emerald-700', invoice: 'bg-emerald-100 text-emerald-700', quotation: 'bg-emerald-100 text-emerald-700', return_receipt: 'bg-orange-100 text-orange-700', credit_sale: 'bg-rose-100 text-rose-700', layaway_receipt: 'bg-emerald-100 text-emerald-700' };
                    const purposeLabels: Record<string, string> = { receipt: 'POS Receipt', invoice: 'Invoice', quotation: 'Quotation', return_receipt: 'Return', credit_sale: 'Credit Sale', layaway_receipt: 'Layaway' };
                    const typeColors: Record<string, string> = { network: 'bg-sky-100 text-sky-700', usb: 'bg-orange-100 text-orange-700' };
                    return (
                      <div key={printer.printer_id} className={`p-4 rounded-xl border-2 flex items-start gap-4 ${printer.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${printer.type === 'network' ? 'bg-sky-100' : 'bg-orange-100'}`}>
                          {printer.type === 'network' ? <Wifi size={20} className="text-sky-600" /> : <Usb size={20} className="text-orange-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800">{printer.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${purposeColors[printer.purpose]}`}>{purposeLabels[printer.purpose] || printer.purpose.toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColors[printer.type]}`}>{printer.type === 'network' ? 'Network' : 'USB'}</span>
                            {!printer.is_active && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">INACTIVE</span>}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {printer.type === 'network' ? `${printer.ip_address}:${printer.port}` : printer.printer_share_name}
                            {' · '}Paper: {printer.paper_width}mm
                          </p>
                          {testResult && (
                            <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                              {testResult.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                              {testResult.message}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleTestPrinterById(printer)} disabled={testingPrinterId === printer.printer_id} title="Test Printer"
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50">
                            {testingPrinterId === printer.printer_id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                          </button>
                          <button onClick={() => openPrinterModal(printer)} title="Edit Printer"
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeletePrinter(printer.printer_id)} title="Delete Printer"
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========== USERS TAB ========== */}
          {activeTab === 'users' && currentUser?.role_name === 'Admin' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-base font-semibold text-gray-800">User Management</h2>
                <button onClick={() => openUserModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold shadow-sm">
                  <Plus size={18} /> Add User
                </button>
              </div>

              {/* Stats Cards */}
              <div className="flex flex-wrap gap-3 mb-6">
                {roles.map((r, i) => {
                  const count = users.filter(u => u.role === r.role_name).length;
                  const palette = ['bg-red-100 text-red-700','bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-purple-100 text-purple-700','bg-amber-100 text-amber-700'];
                  return (
                    <div key={r.role_id} className="flex-1 min-w-28 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${palette[i % palette.length]}`}>{r.role_name}</span>
                      <p className="text-2xl font-bold text-gray-800 mt-2">{count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Manage Roles */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Shield size={14} /> Roles</h3>
                  <button onClick={() => { setNewRoleName(''); setRoleError(''); setShowRoleModal(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
                    <Plus size={13} /> New Role
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => {
                    const BUILT_IN = ['Admin', 'Manager', 'Cashier'];
                    return (
                      <span key={r.role_id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700">
                        {r.role_name}
                        {!BUILT_IN.includes(r.role_name) && (
                          <button onClick={() => handleDeleteRole(r.role_id, r.role_name)}
                            className="text-red-400 hover:text-red-600 transition ml-0.5" title="Delete role">
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(user => (
                      <tr key={user.user_id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-sm font-mono">{user.username}</td>
                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'Admin' ? 'bg-emerald-100 text-emerald-700'
                              : user.role === 'Manager' ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => openUserModal(user)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit">
                              <Edit size={16} />
                            </button>
                            {user.user_id !== currentUser?.user_id && (
                              <button onClick={() => handleDeleteUser(user.user_id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== SECURITY TAB ========== */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* Change Password */}
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-2">Change Password</h2>
                <p className="text-sm text-gray-600 mb-6">Update your account password. Must be at least 6 characters.</p>

                <form onSubmit={handleChangePassword} className="max-w-lg space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.current ? 'text' : 'password'}
                        value={passwordForm.current_password}
                        onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.new_password ? 'text' : 'password'}
                        value={passwordForm.new_password}
                        onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required minLength={6} />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new_password: !showPasswords.new_password })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.new_password ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {passwordForm.new_password && passwordForm.new_password.length < 6 && (
                      <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordForm.confirm_password}
                        onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required minLength={6} />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                    Change Password
                  </button>
                </form>
              </div>

              {/* POS Security Passwords (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-amber-600" />
                    POS Security
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Set passwords to restrict access to sensitive POS actions. Leave empty to disable password protection.
                  </p>

                  <form onSubmit={handleSaveSettings} className="max-w-lg space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        View Completed Orders Password
                      </label>
                      <div className="relative">
                        <input
                          type={showViewCompletedPw ? 'text' : 'password'}
                          value={settings.view_completed_orders_password || ''}
                          onChange={e => setSettings({ ...settings, view_completed_orders_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowViewCompletedPw(!showViewCompletedPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showViewCompletedPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password to view the Completed Orders tab in Orders Management</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Refund Password
                      </label>
                      <div className="relative">
                        <input
                          type={showRefundPw ? 'text' : 'password'}
                          value={settings.refund_password || ''}
                          onChange={e => setSettings({ ...settings, refund_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRefundPw(!showRefundPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showRefundPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password before processing a refund</p>
                    </div>

                    {/* Reports Password */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reports Password
                      </label>
                      <div className="relative">
                        <input
                          type={showReportsPw ? 'text' : 'password'}
                          value={settings.reports_password || ''}
                          onChange={e => setSettings({ ...settings, reports_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowReportsPw(!showReportsPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showReportsPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password to access any report page (once per session)</p>
                    </div>

                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save POS Security Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Session Settings (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-2">Session & Security Settings</h2>
                  <p className="text-sm text-gray-600 mb-6">Configure session timeout and security policies.</p>

                  <form onSubmit={handleSaveSettings} className="max-w-lg space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Session Timeout (minutes)</label>
                      <input type="number" min="5" max="1440" value={settings.session_timeout_minutes}
                        onChange={e => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 480 })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                      <p className="text-xs text-gray-500 mt-1">Auto-logout after inactivity. Default: 480 mins (8 hours)</p>
                    </div>

                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-800 mb-1">Security Tip</p>
                        <p className="text-sm text-yellow-700">
                          Keep session timeout low for shared terminals. Recommended: 30-60 minutes for POS stations.
                        </p>
                      </div>
                    </div>

                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save Security Settings
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========== SYSTEM TAB ========== */}
          {activeTab === 'system' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-2">System Configuration</h2>
                <p className="text-sm text-gray-600 mb-6">Regional settings and system information.</p>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Date Format</label>
                      <select value={settings.date_format}
                        onChange={e => setSettings({ ...settings, date_format: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                        <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Timezone</label>
                      <select value={settings.timezone}
                        onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                        <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
                        <option value="Europe/London">Europe/London (GMT +00:00)</option>
                        <option value="America/New_York">America/New_York (EST -05:00)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

              {/* System Information */}
              <div className="border-t border-gray-200 pt-8">
                <h2 className="text-base font-semibold text-gray-800 mb-4">System Information</h2>
                {systemInfo ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Users</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.users}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={18} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-600">Products</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.products}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Orders</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.orders}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-orange-600" />
                        <span className="text-sm font-medium text-gray-600">Customers</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.customers}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Loading system info...
                  </div>
                )}

                {systemInfo && (
                  <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-700 mb-4">Server Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Node.js</p>
                        <p className="font-medium text-gray-800">{systemInfo.node_version}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Platform</p>
                        <p className="font-medium text-gray-800">{systemInfo.platform}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Uptime</p>
                        <p className="font-medium text-gray-800">{formatUptime(systemInfo.uptime)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Memory Usage</p>
                        <p className="font-medium text-gray-800">{systemInfo.memory} MB</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* About */}
              <div className="border-t border-gray-200 pt-8">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6 text-center">
                  <h3 className="text-base font-semibold text-gray-800 mb-2">AByte POS</h3>
                  <p className="text-gray-600 mb-1">Enterprise Point of Sale System</p>
                  <p className="text-sm text-gray-500">Version 1.0.0</p>
                </div>
              </div>
            </div>
          )}

          {/* ========== ACCESS CONTROL TAB ========== */}
          {activeTab === 'access' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Access Control</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Configure module access for each role. Admin always has full access.
                </p>
              </div>

              {permLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-emerald-600 mr-3" size={24} />
                  <span className="text-gray-600">Loading permissions...</span>
                </div>
              ) : (() => {
                const nonAdminRoles = roles.filter(r => r.role_name !== 'Admin');
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700 w-1/2">Module</th>
                          {nonAdminRoles.map(r => (
                            <th key={r.role_id} className="text-center px-4 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap">{r.role_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {MODULE_TREE.map(parent => {
                          const childKeys = parent.children.map(c => c.key);
                          return (
                            <React.Fragment key={parent.key}>
                              <tr className="bg-gray-50/70">
                                <td className="px-6 py-3">
                                  <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">{parent.label}</span>
                                </td>
                                {nonAdminRoles.map(r => (
                                  <td key={r.role_id} className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => togglePerm(r.role_name, parent.key, true, childKeys)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                        (perms[r.role_name] || new Set()).has(parent.key) ? 'bg-emerald-500' : 'bg-gray-300'
                                      }`}
                                    >
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                        (perms[r.role_name] || new Set()).has(parent.key) ? 'translate-x-6' : 'translate-x-1'
                                      }`} />
                                    </button>
                                  </td>
                                ))}
                              </tr>
                              {parent.children.map(child => (
                                <tr key={child.key} className="hover:bg-gray-50/50">
                                  <td className="pl-12 pr-6 py-2.5">
                                    <span className="text-sm text-gray-600">{child.label}</span>
                                  </td>
                                  {nonAdminRoles.map(r => {
                                    const rolePerms = perms[r.role_name] || new Set();
                                    const parentEnabled = rolePerms.has(parent.key);
                                    const childEnabled = rolePerms.has(child.key);
                                    return (
                                      <td key={r.role_id} className="px-4 py-2.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => parentEnabled ? togglePerm(r.role_name, child.key, false, childKeys) : undefined}
                                          disabled={!parentEnabled}
                                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                            !parentEnabled ? 'bg-gray-200 opacity-50 cursor-not-allowed'
                                              : childEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                                          }`}
                                        >
                                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                            childEnabled && parentEnabled ? 'translate-x-4' : 'translate-x-1'
                                          }`} />
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                      {nonAdminRoles.map(r => (
                        <button
                          key={r.role_id}
                          type="button"
                          onClick={() => savePermissions(r.role_name)}
                          disabled={!!permSaving[r.role_name]}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow transition-all"
                        >
                          {permSaving[r.role_name] ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                          Save {r.role_name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); setShowUserPassword(false); }}
                className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Username <span className="text-red-500">*</span></label>
                <input type="text" value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="e.g. john_cashier"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                <input type="email" value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. john@store.com"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {editingUser ? <span className="text-gray-400 font-normal">(blank = keep current)</span> : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input type={showUserPassword ? 'text' : 'password'} value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-4 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required={!editingUser} minLength={editingUser ? undefined : 8} />
                  <button type="button" onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {userForm.password && userForm.password.length < 8 && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
                <select value={userForm.role_id}
                  onChange={e => setUserForm({ ...userForm, role_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); setShowUserPassword(false); }}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition disabled:opacity-50 shadow-lg">
                  {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editingUser ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Shield size={16} /> Create New Role</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {roleError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{roleError}</div>}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                  placeholder="e.g. Supervisor, Accountant"
                  autoFocus
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Built-in roles (Admin, Manager, Cashier) cannot be deleted.</p>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowRoleModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                Cancel
              </button>
              <button onClick={handleCreateRole} disabled={roleSaving}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition disabled:opacity-50">
                {roleSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingPrinter ? 'Edit Printer' : 'Add New Printer'}
              </h3>
              <button onClick={() => { setShowPrinterModal(false); setEditingPrinter(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePrinterSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Printer Name *</label>
                <input type="text" value={printerForm.name} onChange={e => setPrinterForm({ ...printerForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="e.g. Counter Receipt Printer" required />
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Purpose *</label>
                <p className="text-xs text-gray-400 mb-2">Select what this printer will be used for in the Sales module</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'receipt',        label: 'POS Receipt',    desc: 'Sale receipts' },
                    { value: 'invoice',         label: 'Invoice',        desc: 'Customer bills' },
                    { value: 'quotation',       label: 'Quotation',      desc: 'Price quotes' },
                    { value: 'return_receipt',  label: 'Return',         desc: 'Return/exchange' },
                    { value: 'credit_sale',     label: 'Credit Sale',    desc: 'Credit docs' },
                    { value: 'layaway_receipt', label: 'Layaway',        desc: 'Layaway orders' },
                  ].map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setPrinterForm({ ...printerForm, purpose: p.value as any })}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all ${printerForm.purpose === p.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <p className={`font-semibold text-xs ${printerForm.purpose === p.value ? 'text-emerald-700' : 'text-gray-800'}`}>{p.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Connection Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPrinterForm({ ...printerForm, type: 'network' })}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${printerForm.type === 'network' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Wifi size={18} className={printerForm.type === 'network' ? 'text-sky-600' : 'text-gray-400'} />
                    <div className="text-left">
                      <p className="font-semibold text-sm text-gray-800">Network</p>
                      <p className="text-xs text-gray-500">WiFi / Ethernet</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setPrinterForm({ ...printerForm, type: 'usb' })}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${printerForm.type === 'usb' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Usb size={18} className={printerForm.type === 'usb' ? 'text-orange-600' : 'text-gray-400'} />
                    <div className="text-left">
                      <p className="font-semibold text-sm text-gray-800">USB</p>
                      <p className="text-xs text-gray-500">Direct / Shared</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Network fields */}
              {printerForm.type === 'network' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">IP Address *</label>
                    <input type="text" value={printerForm.ip_address} onChange={e => setPrinterForm({ ...printerForm, ip_address: e.target.value })}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                      placeholder="192.168.1.100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Port</label>
                    <input type="number" value={printerForm.port} onChange={e => setPrinterForm({ ...printerForm, port: parseInt(e.target.value) || 9100 })}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                      placeholder="9100" />
                  </div>
                </div>
              )}

              {/* USB fields */}
              {printerForm.type === 'usb' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Printer Share Name / Path *</label>
                  <input type="text" value={printerForm.printer_share_name} onChange={e => setPrinterForm({ ...printerForm, printer_share_name: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="e.g. \\localhost\ThermalPrinter" required />
                  <p className="text-xs text-gray-400 mt-1">Windows: \\computername\ShareName &nbsp;|&nbsp; Linux: /dev/usb/lp0</p>
                </div>
              )}

              {/* Paper Width */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Width</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPrinterForm({ ...printerForm, paper_width: 58 })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${printerForm.paper_width === 58 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    58mm (Small)
                  </button>
                  <button type="button" onClick={() => setPrinterForm({ ...printerForm, paper_width: 80 })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${printerForm.paper_width === 80 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    80mm (Standard)
                  </button>
                </div>
              </div>

              {/* Active toggle (only for edit) */}
              {editingPrinter && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="printerActive" checked={printerForm.is_active}
                    onChange={e => setPrinterForm({ ...printerForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600" />
                  <label htmlFor="printerActive" className="text-sm font-semibold text-gray-700">Active (printer is available for use)</label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowPrinterModal(false); setEditingPrinter(null); }}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                  Cancel
                </button>
                <button type="submit" disabled={printerSaving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition disabled:opacity-50 shadow-lg">
                  {printerSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editingPrinter ? 'Update Printer' : 'Add Printer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
