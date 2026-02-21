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
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';

interface User {
  user_id: number;
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
    tax_rate: 0, currency_symbol: 'Rs.',
    low_stock_threshold: 10, default_payment_method: 'cash', auto_print_receipt: false,
    barcode_prefix: '', invoice_prefix: 'INV-', date_format: 'DD/MM/YYYY', timezone: 'Asia/Karachi',
    business_hours_open: '09:00', business_hours_close: '21:00',
    allow_negative_stock: false, discount_requires_approval: false, max_cashier_discount: 50,
    session_timeout_minutes: 480,
    receipt_show_store_name: true, receipt_show_address: true, receipt_show_phone: true, receipt_show_tax: true,
    receipt_paper_width: '80mm',
    printer_type: 'none', printer_ip: '', printer_port: 9100, printer_name: '', printer_paper_width: 80
  });

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role_id: 3 });

  // Password
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new_password: false, confirm: false });

  // System info
  const [systemInfo, setSystemInfo] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Printer test (legacy)
  const [printerTesting, setPrinterTesting] = useState(false);
  const [printerTestResult, setPrinterTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Multi-printer management
  interface PrinterEntry {
    printer_id: number;
    name: string;
    type: 'network' | 'usb';
    ip_address: string | null;
    port: number;
    printer_share_name: string | null;
    paper_width: number;
    purpose: 'receipt' | 'invoice' | 'quotation';
    is_active: number;
  }
  const [printers, setPrinters] = useState<PrinterEntry[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterEntry | null>(null);
  const [printerForm, setPrinterForm] = useState({ name: '', type: 'network' as 'network' | 'usb', ip_address: '', port: 9100, printer_share_name: '', paper_width: 80, purpose: 'receipt' as 'receipt' | 'invoice' | 'quotation', is_active: true });
  const [printerSaving, setPrinterSaving] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<number | null>(null);
  const [printerTestResults, setPrinterTestResults] = useState<Record<number, { success: boolean; message: string }>>({});

  useEffect(() => {
    fetchSettings();
    if (currentUser?.role_name === 'Admin') {
      fetchUsers();
      fetchPrinters();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'system' && currentUser?.role_name === 'Admin' && !systemInfo) {
      fetchSystemInfo();
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
      setPrinterForm({ name: printer.name, type: printer.type, ip_address: printer.ip_address || '', port: printer.port || 9100, printer_share_name: printer.printer_share_name || '', paper_width: printer.paper_width || 80, purpose: printer.purpose, is_active: printer.is_active === 1 });
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
        const payload: any = { name: userForm.name, email: userForm.email, role_id: userForm.role_id };
        if (userForm.password) payload.password = userForm.password;
        await api.put(`/users/${editingUser.user_id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', userForm);
        toast.success('User created');
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role_id: 3 });
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
    if (user) {
      setEditingUser(user);
      setUserForm({ name: user.name, email: user.email, password: '', role_id: user.role_id });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role_id: 3 });
    }
    setShowUserModal(true);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleTestPrinter = async () => {
    setPrinterTesting(true);
    setPrinterTestResult(null);
    try {
      const res = await api.post('/settings/test-printer', {
        printer_type: settings.printer_type,
        printer_ip: settings.printer_ip,
        printer_port: settings.printer_port || 9100,
        printer_name: settings.printer_name,
      });
      setPrinterTestResult({ success: true, message: res.data.message });
    } catch (err: any) {
      setPrinterTestResult({ success: false, message: err.response?.data?.message || 'Test failed' });
    } finally {
      setPrinterTesting(false);
    }
  };

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

  const tabs = [
    { id: 'store', name: 'Store Info', icon: Building2 },
    { id: 'receipt', name: 'Receipt & Invoice', icon: Receipt },
    { id: 'pos', name: 'POS Settings', icon: ShoppingCart },
    { id: 'users', name: 'Users', icon: Users, adminOnly: true },
    { id: 'printer', name: 'Printer', icon: Printer, adminOnly: true },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'system', name: 'System', icon: Server, adminOnly: true },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">Store Information</h2>
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">Receipt & Invoice Settings</h2>

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
              <h2 className="text-xl font-bold text-gray-800 mb-4">POS Configuration</h2>

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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Printer Management</h2>
                  <p className="text-sm text-gray-500 mt-1">Add multiple printers and assign each to a specific purpose (Receipt, Invoice, Quotation)</p>
                </div>
                <button onClick={() => openPrinterModal()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition">
                  <Plus size={18} /> Add Printer
                </button>
              </div>

              {/* Purpose legend */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { purpose: 'receipt', label: 'Receipt Printer', desc: 'POS sales receipts — prints directly on thermal without popup', color: 'emerald', icon: Receipt },
                  { purpose: 'invoice', label: 'Invoice Printer', desc: 'Customer invoices — prints directly on thermal without popup', color: 'blue', icon: FileText },
                  { purpose: 'quotation', label: 'Quotation Printer', desc: 'Price quotations — prints directly on thermal without popup', color: 'purple', icon: Tag },
                ].map(item => {
                  const Icon = item.icon;
                  const hasPrinter = printers.some(p => p.purpose === item.purpose && p.is_active);
                  return (
                    <div key={item.purpose} className={`p-4 rounded-xl border-2 ${hasPrinter ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={16} className={hasPrinter ? 'text-emerald-600' : 'text-gray-400'} />
                        <span className="font-semibold text-sm text-gray-700">{item.label}</span>
                        {hasPrinter ? <CheckCircle size={14} className="text-emerald-500 ml-auto" /> : <XCircle size={14} className="text-gray-300 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                      <p className={`text-xs font-semibold mt-1 ${hasPrinter ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {hasPrinter ? '✓ Configured' : 'Not configured'}
                      </p>
                    </div>
                  );
                })}
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
                    const purposeColors: Record<string, string> = { receipt: 'bg-emerald-100 text-emerald-700', invoice: 'bg-blue-100 text-blue-700', quotation: 'bg-purple-100 text-purple-700' };
                    const typeColors: Record<string, string> = { network: 'bg-sky-100 text-sky-700', usb: 'bg-orange-100 text-orange-700' };
                    return (
                      <div key={printer.printer_id} className={`p-4 rounded-xl border-2 flex items-start gap-4 ${printer.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${printer.type === 'network' ? 'bg-sky-100' : 'bg-orange-100'}`}>
                          {printer.type === 'network' ? <Wifi size={20} className="text-sky-600" /> : <Usb size={20} className="text-orange-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800">{printer.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${purposeColors[printer.purpose]}`}>{printer.purpose.toUpperCase()}</span>
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
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
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
                <h2 className="text-xl font-bold text-gray-800">User Management</h2>
                <button onClick={() => openUserModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold shadow-sm">
                  <Plus size={18} /> Add User
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {['Admin', 'Manager', 'Cashier'].map(role => {
                  const count = users.filter(u => u.role === role).length;
                  const colors: Record<string, string> = {
                    Admin: 'bg-purple-100 text-purple-700',
                    Manager: 'bg-blue-100 text-blue-700',
                    Cashier: 'bg-gray-100 text-gray-700'
                  };
                  return (
                    <div key={role} className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[role]}`}>{role}</span>
                      <p className="text-2xl font-bold text-gray-800 mt-2">{count}</p>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
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
                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700'
                              : user.role === 'Manager' ? 'bg-blue-100 text-blue-700'
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
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
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
                <h2 className="text-xl font-bold text-gray-800 mb-2">Change Password</h2>
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

              {/* Session Settings (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">Session & Security Settings</h2>
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
                <h2 className="text-xl font-bold text-gray-800 mb-2">System Configuration</h2>
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
                <h2 className="text-xl font-bold text-gray-800 mb-4">System Information</h2>
                {systemInfo ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-blue-600" />
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
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart size={18} className="text-purple-600" />
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
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">AByte POS</h3>
                  <p className="text-gray-600 mb-1">Enterprise Point of Sale System</p>
                  <p className="text-sm text-gray-500">Version 1.0.0</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); }}
                className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <input type="text" value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input type="password" value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required={!editingUser} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                <select value={userForm.role_id}
                  onChange={e => setUserForm({ ...userForm, role_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                  <option value={3}>Cashier</option>
                  <option value={2}>Manager</option>
                  <option value={1}>Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); }}
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

      {/* Add/Edit Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'receipt', label: 'Receipt', desc: 'POS sales', color: 'emerald' },
                    { value: 'invoice', label: 'Invoice', desc: 'Customer bills', color: 'blue' },
                    { value: 'quotation', label: 'Quotation', desc: 'Price quotes', color: 'purple' },
                  ].map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setPrinterForm({ ...printerForm, purpose: p.value as any })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${printerForm.purpose === p.value
                        ? p.color === 'emerald' ? 'border-emerald-500 bg-emerald-50' : p.color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:bg-gray-50'}`}>
                      <p className="font-semibold text-sm text-gray-800">{p.label}</p>
                      <p className="text-xs text-gray-500">{p.desc}</p>
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
