import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Save, Check, Loader2, ChevronDown, ChevronRight,
  Users, Copy, Search, AlertCircle, X,
  LayoutDashboard, ShoppingCart, Package, UserCheck, Calculator, Settings,
} from 'lucide-react';
import api from '../../utils/api';

// ─── Comprehensive module tree ────────────────────────────────────────────────
const MODULE_TREE = [
  {
    section: 'Dashboard',
    Icon: LayoutDashboard,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
    keys: [
      { key: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    section: 'Sales',
    Icon: ShoppingCart,
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 border-emerald-200',
    textColor: 'text-emerald-700',
    keys: [
      { key: 'sales.pos',         label: 'POS Terminal' },
      { key: 'sales.orders',      label: 'Orders' },
      { key: 'sales.register',    label: 'Cash Register' },
      { key: 'sales.customers',   label: 'Customers' },
      { key: 'sales.returns',     label: 'Returns' },
      { key: 'sales.quotations',  label: 'Quotations' },
      { key: 'sales.credit',      label: 'Credit Sales' },
      { key: 'sales.pricerules',  label: 'Price Rules' },
      { key: 'sales.targets',     label: 'Sales Targets' },
      { key: 'sales.deliveries',  label: 'Deliveries' },
      { key: 'sales.reports',     label: 'Sales Reports' },
      { key: 'restaurant.tables', label: 'Tables (Restaurant)' },
    ],
  },
  {
    section: 'Inventory',
    Icon: Package,
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
    keys: [
      { key: 'inventory.products',    label: 'Products' },
      { key: 'inventory.categories',  label: 'Categories' },
      { key: 'inventory.bundles',     label: 'Deals & Bundles' },
      { key: 'inventory.purchases',   label: 'Purchases' },
      { key: 'inventory.suppliers',   label: 'Suppliers' },
      { key: 'inventory.adjustments', label: 'Stock Adjustments / Issuance' },
      { key: 'inventory.transfers',   label: 'Stock Transfers' },
      { key: 'inventory.alerts',      label: 'Stock Alerts' },
      { key: 'inventory.variants',    label: 'Product Variants' },
      { key: 'inventory.stockcount',  label: 'Stock Count' },
      { key: 'inventory.reports',     label: 'Inventory Reports' },
    ],
  },
  {
    section: 'HR',
    Icon: UserCheck,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700',
    keys: [
      { key: 'hr.staff',             label: 'Employee List' },
      { key: 'hr.attendance',        label: 'Attendance' },
      { key: 'hr.daily-attendance',  label: 'Daily Attendance' },
      { key: 'hr.ledger',            label: 'Employee Ledger' },
      { key: 'hr.salary-sheet',      label: 'Salary Sheet & Slips' },
      { key: 'hr.payroll',           label: 'Payroll Processing' },
      { key: 'hr.increments',        label: 'Salary Increments' },
      { key: 'hr.loans',             label: 'Loans' },
      { key: 'hr.advances',          label: 'Advance Payments' },
      { key: 'hr.leaves',            label: 'Leave Management' },
      { key: 'hr.holidays',          label: 'Holidays' },
      { key: 'hr.departments',       label: 'Departments' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.appraisals',        label: 'Appraisals' },
      { key: 'hr.exit',              label: 'Exit Management' },
      { key: 'hr.reports',           label: 'HR Reports' },
    ],
  },
  {
    section: 'Accounts',
    Icon: Calculator,
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50 border-teal-200',
    textColor: 'text-teal-700',
    keys: [
      { key: 'accounts.chart',              label: 'Chart of Accounts' },
      { key: 'accounts.journal',            label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers',   label: 'Payment Vouchers (CPV)' },
      { key: 'accounts.receipt-vouchers',   label: 'Receipt Vouchers (CRV)' },
      { key: 'accounts.ledger',             label: 'Account Ledger' },
      { key: 'accounts.trial-balance',      label: 'Trial Balance' },
      { key: 'accounts.trial-balance-6col', label: 'Trial Balance (6 Col)' },
      { key: 'accounts.profit-loss',        label: 'Profit & Loss' },
      { key: 'accounts.balance-sheet',      label: 'Balance Sheet' },
      { key: 'accounts.bank-accounts',      label: 'Bank Accounts' },
      { key: 'accounts.analytics',          label: 'Analytics' },
      { key: 'accounts.reports',            label: 'Accounts Reports' },
    ],
  },
  {
    section: 'System',
    Icon: Settings,
    color: 'bg-slate-500',
    lightColor: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-700',
    keys: [
      { key: 'system.stores',    label: 'Branch / Store Config' },
      { key: 'system.audit',     label: 'Audit Log' },
      { key: 'system.backup',    label: 'Backup' },
      { key: 'system.settings',  label: 'Settings & Email' },
      { key: 'system.ai_widget', label: 'AI Assistant' },
    ],
  },
];

const ALL_KEYS = MODULE_TREE.flatMap(s => s.keys.map(k => k.key));
const TOTAL    = ALL_KEYS.length;

// ─── Component ────────────────────────────────────────────────────────────────
const AccessControl = () => {
  const [roles, setRoles]               = useState<string[]>([]);
  const [allPerms, setAllPerms]         = useState<Record<string, Set<string>>>({});
  const [savedPerms, setSavedPerms]     = useState<Record<string, Set<string>>>({});
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({});
  const [search, setSearch]             = useState('');
  const [copyFrom, setCopyFrom]         = useState('');

  // Current role's permission set (live, editable)
  const permissions: Set<string> = allPerms[selectedRole] || new Set();

  const setPermissions = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setAllPerms(prev => ({
      ...prev,
      [selectedRole]: updater(prev[selectedRole] || new Set()),
    }));
    setSaved(false);
  }, [selectedRole]);

  // ── Load roles + all permissions in parallel ──────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/users/roles'), api.get('/permissions')])
      .then(([rolesRes, permsRes]) => {
        const nonAdmin: string[] = (rolesRes.data.data || [])
          .map((r: any) => r.role_name)
          .filter((n: string) => n !== 'Admin');
        setRoles(nonAdmin);
        if (nonAdmin.length > 0) setSelectedRole(nonAdmin[0]);

        const data = permsRes.data as Record<string, string[]>;
        const mapped: Record<string, Set<string>> = {};
        for (const [role, keys] of Object.entries(data)) {
          mapped[role] = new Set(keys);
        }
        setAllPerms(mapped);
        setSavedPerms(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Unsaved detection ─────────────────────────────────────────────────────
  const isDirty = useCallback((role: string) => {
    const curr = allPerms[role]  || new Set<string>();
    const orig = savedPerms[role] || new Set<string>();
    if (curr.size !== orig.size) return true;
    for (const k of curr) if (!orig.has(k)) return true;
    return false;
  }, [allPerms, savedPerms]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggle = (key: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSection = (keys: string[]) => {
    const allOn = keys.every(k => permissions.has(k));
    setPermissions(prev => {
      const next = new Set(prev);
      allOn ? keys.forEach(k => next.delete(k)) : keys.forEach(k => next.add(k));
      return next;
    });
  };

  const selectAll = () => setPermissions(() => new Set(ALL_KEYS));
  const clearAll  = () => setPermissions(() => new Set());

  const handleCopyFrom = (fromRole: string) => {
    if (!fromRole || fromRole === selectedRole) return;
    const src = allPerms[fromRole] || new Set<string>();
    setAllPerms(prev => ({ ...prev, [selectedRole]: new Set(src) }));
    setSaved(false);
    setCopyFrom('');
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/${selectedRole}`, { permissions: Array.from(permissions) });
      setSavedPerms(prev => ({ ...prev, [selectedRole]: new Set(permissions) }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered tree (search) ────────────────────────────────────────────────
  const filteredTree = useMemo(() => {
    if (!search.trim()) return MODULE_TREE;
    const q = search.toLowerCase();
    return MODULE_TREE
      .map(s => ({ ...s, keys: s.keys.filter(k => k.label.toLowerCase().includes(q) || k.key.includes(q)) }))
      .filter(s => s.keys.length > 0);
  }, [search]);

  // ── Permission stats for a role ───────────────────────────────────────────
  const roleStats = useCallback((role: string) => {
    const cnt = (allPerms[role] || new Set()).size;
    return { count: cnt, pct: Math.round((cnt / TOTAL) * 100) };
  }, [allPerms]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Loading access control...</p>
        </div>
      </div>
    );
  }

  const currentCount = permissions.size;
  const currentPct   = Math.round((currentCount / TOTAL) * 100);
  const dirty        = isDirty(selectedRole);

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-violet-700 p-2.5 rounded-xl shadow-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">Access Control</h1>
              <p className="text-sm text-gray-500">Configure module permissions per role — Admin always has full access</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedRole && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl">
                <span className="text-xs font-semibold text-violet-600">{selectedRole}</span>
                <span className="text-xs text-gray-400">{currentCount}/{TOTAL}</span>
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${currentPct}%` }} />
                </div>
              </div>
            )}
            {dirty && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                <AlertCircle size={13} /> Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !selectedRole || !dirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                saved
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-violet-600 hover:bg-violet-700 text-white'
              }`}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
              {saved ? 'Saved!' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">

        {/* ── Left: Role sidebar ──────────────────────────────────────────── */}
        <div className="w-60 shrink-0 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">
            <Users size={13} /> Roles
          </div>

          {roles.length === 0 ? (
            <p className="text-xs text-gray-400 px-1">No non-Admin roles found.</p>
          ) : (
            roles.map(role => {
              const { count, pct } = roleStats(role);
              const active  = selectedRole === role;
              const hasDirt = isDirty(role);
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all group ${
                    active
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-violet-300 hover:bg-violet-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{role}</span>
                    {hasDirt && (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-amber-300' : 'bg-amber-500'}`} title="Unsaved changes" />
                    )}
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1 ${active ? 'bg-violet-400' : 'bg-gray-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${active ? 'bg-white' : 'bg-violet-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs ${active ? 'text-violet-200' : 'text-gray-400'}`}>
                    {count} / {TOTAL} permissions ({pct}%)
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* ── Right: Permission editor ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search permissions..."
                className="w-full pl-8 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Copy from role */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Copy size={14} className="text-gray-400 shrink-0" />
              <select
                value={copyFrom}
                onChange={e => { setCopyFrom(e.target.value); handleCopyFrom(e.target.value); }}
                className="text-sm text-gray-600 bg-transparent outline-none cursor-pointer"
              >
                <option value="">Copy from role...</option>
                {roles.filter(r => r !== selectedRole).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Select All / Clear All */}
            <button
              onClick={selectAll}
              className="text-xs px-3 py-2 bg-violet-50 text-violet-700 rounded-xl border border-violet-200 hover:bg-violet-100 font-semibold transition-all"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-3 py-2 bg-gray-100 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-200 font-semibold transition-all"
            >
              Clear All
            </button>
          </div>

          {/* Sections */}
          {filteredTree.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No modules match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTree.map(({ section, Icon, color, lightColor, textColor, keys }) => {
                const keyList  = keys.map(k => k.key);
                const enabled  = keyList.filter(k => permissions.has(k)).length;
                const allOn    = enabled === keyList.length;
                const someOn   = enabled > 0 && !allOn;
                const isCollapsed = collapsed[section];

                return (
                  <div key={section} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                    {/* Section header */}
                    <div className={`flex items-center px-4 py-3 border-b border-gray-100 ${allOn ? lightColor : 'bg-gray-50'}`}>
                      <button
                        onClick={() => setCollapsed(p => ({ ...p, [section]: !p[section] }))}
                        className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                      >
                        {isCollapsed
                          ? <ChevronRight size={15} className="text-gray-400 shrink-0" />
                          : <ChevronDown size={15} className="text-gray-400 shrink-0" />
                        }
                        <div className={`p-1.5 rounded-lg ${color} shrink-0`}>
                          <Icon size={13} className="text-white" />
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{section}</span>
                        <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          allOn  ? `${lightColor} ${textColor} border` :
                          someOn ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {enabled}/{keyList.length}
                        </span>
                      </button>

                      <button
                        onClick={() => toggleSection(keyList)}
                        className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                          allOn
                            ? `${lightColor} ${textColor} border hover:opacity-80`
                            : someOn
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {allOn ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Permission checkboxes */}
                    {!isCollapsed && (
                      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {keys.map(({ key, label }) => {
                          const on = permissions.has(key);
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-all text-sm border ${
                                on
                                  ? `${lightColor} ${textColor} font-semibold`
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle(key)}
                                className="w-4 h-4 accent-violet-600 rounded shrink-0"
                              />
                              <span className="leading-tight text-xs">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom save bar */}
          {dirty && (
            <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-white border-2 border-violet-200 rounded-2xl px-5 py-3 shadow-xl shadow-violet-100">
              <AlertCircle size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-gray-700">Unsaved changes for <span className="text-violet-700">{selectedRole}</span></span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-all"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
