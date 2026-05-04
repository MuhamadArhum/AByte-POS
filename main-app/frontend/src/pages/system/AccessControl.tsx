import { useState, useEffect, useCallback } from 'react';
import { Shield, Save, Check, Loader2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import api from '../../utils/api';

// ─── Module tree for checkboxes ──────────────────────────────────────────────
const MODULE_TREE = [
  {
    section: 'Dashboard', keys: [
      { key: 'dashboard', label: 'Dashboard' },
    ]
  },
  {
    section: 'Sales', keys: [
      { key: 'sales.pos',         label: 'POS & Orders' },
      { key: 'sales.deliveries',  label: 'Deliveries' },
      { key: 'sales.register',    label: 'Cash Register' },
      { key: 'sales.returns',     label: 'Returns' },
      { key: 'sales.quotations',  label: 'Quotations' },
      { key: 'sales.credit',      label: 'Credit Sales' },
      { key: 'sales.customers',   label: 'Customers' },
      { key: 'sales.pricerules',  label: 'Price Rules' },
      { key: 'sales.targets',     label: 'Sales Targets' },
      { key: 'sales.reports',     label: 'Sales Reports' },
      { key: 'restaurant.tables', label: 'Tables' },
    ]
  },
  {
    section: 'Inventory', keys: [
      { key: 'inventory.products',     label: 'Products & Categories' },
      { key: 'inventory.bundles',      label: 'Deals & Bundles' },
      { key: 'inventory.purchases',    label: 'Purchases & Suppliers' },
      { key: 'inventory.suppliers',    label: 'Suppliers' },
      { key: 'inventory.adjustments',  label: 'Stock Adjustments / Issuance' },
      { key: 'inventory.reports',      label: 'Inventory Reports' },
    ]
  },
  {
    section: 'HR', keys: [
      { key: 'hr.staff',             label: 'Employee List' },
      { key: 'hr.attendance',        label: 'Attendance' },
      { key: 'hr.daily-attendance',  label: 'Daily Attendance' },
      { key: 'hr.ledger',            label: 'Employee Ledger' },
      { key: 'hr.salary-sheet',      label: 'Salary Sheet & Slips' },
      { key: 'hr.payroll',           label: 'Payroll Processing' },
      { key: 'hr.increments',        label: 'Salary Increments' },
      { key: 'hr.loans',             label: 'Loans' },
      { key: 'hr.leaves',            label: 'Leave Management' },
      { key: 'hr.holidays',          label: 'Holidays' },
      { key: 'hr.reports',           label: 'HR Reports' },
      { key: 'hr.departments',       label: 'Departments' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.appraisals',        label: 'Appraisals' },
      { key: 'hr.exit',              label: 'Exit Management' },
    ]
  },
  {
    section: 'Accounts', keys: [
      { key: 'accounts.chart',              label: 'Chart of Accounts' },
      { key: 'accounts.journal',            label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers',   label: 'Payment Vouchers (CPV)' },
      { key: 'accounts.receipt-vouchers',   label: 'Receipt Vouchers (CRV)' },
      { key: 'accounts.ledger',             label: 'Account Ledger' },
      { key: 'accounts.trial-balance',      label: 'Trial Balance' },
      { key: 'accounts.profit-loss',        label: 'Profit & Loss' },
      { key: 'accounts.balance-sheet',      label: 'Balance Sheet' },
      { key: 'accounts.bank-accounts',      label: 'Bank Accounts' },
      { key: 'accounts.analytics',          label: 'Analytics' },
      { key: 'accounts.reports',            label: 'Accounts Reports' },
    ]
  },
  {
    section: 'System', keys: [
      { key: 'system.stores',   label: 'Branch / Store Config' },
      { key: 'system.audit',    label: 'Audit Log' },
      { key: 'system.backup',   label: 'Backup' },
      { key: 'system.settings', label: 'Settings & Email' },
    ]
  },
];

const AccessControl = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Load all roles
  useEffect(() => {
    api.get('/users/roles').then(res => {
      const nonAdmin = (res.data.data || [])
        .map((r: any) => r.role_name)
        .filter((n: string) => n !== 'Admin');
      setRoles(nonAdmin);
      if (nonAdmin.length > 0) setSelectedRole(nonAdmin[0]);
    }).catch(() => {});
  }, []);

  // Load permissions for selected role
  const loadPermissions = useCallback(async () => {
    if (!selectedRole) return;
    setLoading(true);
    try {
      const res = await api.get(`/permissions/${selectedRole}`);
      setPermissions(new Set(res.data.permissions || []));
      setSaved(false);
    } catch {
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const toggle = (key: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const toggleSection = (_: string, keys: string[]) => {
    const allOn = keys.every(k => permissions.has(k));
    setPermissions(prev => {
      const next = new Set(prev);
      if (allOn) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/${selectedRole}`, { permissions: Array.from(permissions) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const selectAll = () => {
    const all = MODULE_TREE.flatMap(s => s.keys.map(k => k.key));
    setPermissions(new Set(all));
    setSaved(false);
  };
  const clearAll = () => { setPermissions(new Set()); setSaved(false); };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-2.5 rounded-xl shadow-lg">
              <Shield size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">Access Control</h1>
              <p className="text-sm text-gray-500">Configure module permissions per role</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !selectedRole}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              saved
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Permissions'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-[240px_1fr] gap-6">

        {/* Left: Role selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3 flex items-center gap-1.5">
            <Users size={13} /> Roles
          </h3>
          {roles.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                selectedRole === role
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-violet-300 hover:bg-violet-50'
              }`}
            >
              {role}
            </button>
          ))}
          {roles.length === 0 && (
            <p className="text-xs text-gray-400 px-1">No non-Admin roles found</p>
          )}
        </div>

        {/* Right: Permission checkboxes */}
        <div>
          {selectedRole && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">
                  Permissions for <span className="text-violet-700">{selectedRole}</span>
                </h3>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 hover:bg-violet-100 font-medium">
                    Select All
                  </button>
                  <button onClick={clearAll} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-200 font-medium">
                    Clear All
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  {MODULE_TREE.map(({ section, keys }) => {
                    const keyList = keys.map(k => k.key);
                    const allOn = keyList.every(k => permissions.has(k));
                    const someOn = keyList.some(k => permissions.has(k));
                    const isCollapsed = collapsedSections[section];

                    return (
                      <div key={section} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Section header */}
                        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <button
                            onClick={() => setCollapsedSections(p => ({ ...p, [section]: !p[section] }))}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {isCollapsed ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                            <span className="font-bold text-gray-700 text-sm">{section}</span>
                            <span className="text-xs text-gray-400 ml-1">
                              ({keyList.filter(k => permissions.has(k)).length}/{keyList.length})
                            </span>
                          </button>
                          <button
                            onClick={() => toggleSection(section, keyList)}
                            className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              allOn
                                ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                : someOn
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {allOn ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {/* Module checkboxes */}
                        {!isCollapsed && (
                          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {keys.map(({ key, label }) => (
                              <label
                                key={key}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                                  permissions.has(key)
                                    ? 'bg-violet-50 border border-violet-200 text-violet-800'
                                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={permissions.has(key)}
                                  onChange={() => toggle(key)}
                                  className="w-4 h-4 accent-violet-600 rounded"
                                />
                                <span className="font-medium leading-tight">{label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
