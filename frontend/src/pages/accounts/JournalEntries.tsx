import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Send, Trash2, ChevronDown, Search, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

// Searchable account selector with balance display
const AccountSelector = ({
  value, onChange, accounts, onAfterSelect
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: any[];
  onAfterSelect?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = accounts.find(a => String(a.account_id) === String(value));

  const filtered = accounts.filter(a =>
    !search || a.account_name.toLowerCase().includes(search.toLowerCase()) || a.account_code.includes(search)
  );

  // Reset highlight when search changes
  useEffect(() => { setHighlighted(0); }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectAccount = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
    setHighlighted(0);
    // Move focus to next field after React flushes state
    setTimeout(() => onAfterSelect?.(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) selectAccount(String(filtered[highlighted]?.account_id ?? filtered[0].account_id));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 border border-gray-200 rounded text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left">
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'Select Account...'}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {selected && (
        <p className="text-xs text-gray-500 mt-0.5 px-1">
          Balance: <span className="font-semibold text-gray-700">{Number(selected.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
        </p>
      )}
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
              <Search size={13} className="text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-sm outline-none w-full"
                placeholder="Search or type to filter, Enter to select..."
              />
            </div>
          </div>
          <ul ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No accounts found</li>}
            {filtered.map((a, idx) => (
              <li key={a.account_id}>
                <button type="button"
                  onClick={() => selectAccount(String(a.account_id))}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${idx === highlighted ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                  <div>
                    <span className="text-xs text-gray-400 font-mono">{a.account_code}</span>
                    <span className="ml-2 text-sm text-gray-800">{a.account_name}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{Number(a.current_balance || 0).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

type JvLine = { dr_cr: 'Dr' | 'Cr'; account_id: string; narration: string; debit: string; credit: string };
const emptyLine = (): JvLine => ({ dr_cr: 'Dr', account_id: '', narration: '', debit: '', credit: '' });

const JournalEntryModal = ({ isOpen, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [entryDate, setEntryDate] = useState(localToday());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JvLine[]>([emptyLine(), emptyLine()]);
  const narrationRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/accounts', { params: { tree: 1 } })
        .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
        .catch(() => {});
    }
  }, [isOpen]);

  const updateLine = (i: number, patch: Partial<JvLine>) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const handleDrCr = (i: number, val: 'Dr' | 'Cr') => {
    setLines(prev => {
      // Calculate imbalance from all OTHER lines (exclude current line)
      const others = prev.filter((_, idx) => idx !== i);
      const otherDr = others.reduce((s, l) => s + Number(l.debit || 0), 0);
      const otherCr = others.reduce((s, l) => s + Number(l.credit || 0), 0);
      const remaining = parseFloat(Math.abs(otherDr - otherCr).toFixed(2));

      return prev.map((l, idx) => {
        if (idx !== i) return l;
        // Auto-fill with remaining imbalance if it exists, otherwise keep existing amount
        const existingAmt = l.debit || l.credit || '';
        const autoAmt = remaining > 0 ? String(remaining) : existingAmt;
        return { ...l, dr_cr: val, debit: val === 'Dr' ? autoAmt : '', credit: val === 'Cr' ? autoAmt : '' };
      });
    });
  };

  const handleAmountChange = (i: number, val: string) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      return l.dr_cr === 'Dr' ? { ...l, debit: val, credit: '' } : { ...l, credit: val, debit: '' };
    }));
  };

  const totals = lines.reduce((acc, l) => ({
    debit: acc.debit + Number(l.debit || 0),
    credit: acc.credit + Number(l.credit || 0)
  }), { debit: 0, credit: 0 });

  const isBalanced = lines.length >= 2 && Math.abs(totals.debit - totals.credit) < 0.01 && totals.debit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) { toast.error('Debits must equal credits and total must be > 0'); return; }

    setLoading(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: entryDate,
        description,
        lines: lines
          .filter(l => l.account_id)
          .map(l => ({ account_id: l.account_id, description: l.narration, debit: Number(l.debit || 0), credit: Number(l.credit || 0) }))
      });
      toast.success('Journal entry created');
      onSuccess();
      onClose();
      setLines([emptyLine(), emptyLine()]);
      setDescription('');
      setEntryDate(localToday());
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-1">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[85vw] h-screen flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Journal Voucher</h2>
              <p className="text-xs text-gray-500">Double-entry bookkeeping</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Date:</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" required />
            </div>
          </div>
        </div>

        {/* Narration / Description */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 shrink-0">Voucher Narration:</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              placeholder="General narration for this journal voucher..." />
          </div>
        </div>

        {/* Lines Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form id="jv-form" onSubmit={handleSubmit}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold w-16 rounded-tl-lg">#</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-20">Dr / Cr</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Account Title</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Narration</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-32">Debit</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-32">Credit</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-12 rounded-tr-lg">Del</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {/* # */}
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>

                    {/* Dr / Cr toggle */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex rounded overflow-hidden border border-gray-200 w-16 mx-auto">
                        <button type="button"
                          onClick={() => handleDrCr(i, 'Dr')}
                          className={`flex-1 py-1 text-xs font-bold transition ${line.dr_cr === 'Dr' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-blue-50'}`}>
                          Dr
                        </button>
                        <button type="button"
                          onClick={() => handleDrCr(i, 'Cr')}
                          className={`flex-1 py-1 text-xs font-bold transition ${line.dr_cr === 'Cr' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-orange-50'}`}>
                          Cr
                        </button>
                      </div>
                    </td>

                    {/* Account Title */}
                    <td className="px-2 py-2 min-w-0">
                      <AccountSelector
                        value={line.account_id}
                        onChange={id => updateLine(i, { account_id: id })}
                        onAfterSelect={() => narrationRefs.current[i]?.focus()}
                        accounts={accounts}
                      />
                    </td>

                    {/* Narration */}
                    <td className="px-2 py-2">
                      <input
                        ref={el => { narrationRefs.current[i] = el; }}
                        type="text" value={line.narration}
                        onChange={e => updateLine(i, { narration: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                        placeholder="Line narration..." />
                    </td>

                    {/* Debit */}
                    <td className="px-2 py-2">
                      <input type="number" step="0.01" min="0"
                        value={line.dr_cr === 'Dr' ? (line.debit || '') : ''}
                        onChange={e => handleAmountChange(i, e.target.value)}
                        disabled={line.dr_cr === 'Cr'}
                        className={`w-full px-2 py-1.5 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 ${line.dr_cr === 'Dr' ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700' : 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        placeholder="0.00" />
                    </td>

                    {/* Credit */}
                    <td className="px-2 py-2">
                      <input type="number" step="0.01" min="0"
                        value={line.dr_cr === 'Cr' ? (line.credit || '') : ''}
                        onChange={e => handleAmountChange(i, e.target.value)}
                        disabled={line.dr_cr === 'Dr'}
                        className={`w-full px-2 py-1.5 border rounded text-sm text-right focus:ring-2 focus:ring-orange-400 ${line.dr_cr === 'Cr' ? 'border-orange-200 bg-orange-50 font-semibold text-orange-700' : 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        placeholder="0.00" />
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={lines.length <= 2}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-20 disabled:cursor-not-allowed">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="bg-gray-800 text-white font-bold">
                  <td colSpan={4} className="px-3 py-3 text-right text-sm tracking-wide rounded-bl-lg">TOTAL</td>
                  <td className={`px-2 py-3 text-right text-sm ${isBalanced ? 'text-emerald-300' : 'text-red-300'}`}>
                    {totals.debit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-2 py-3 text-right text-sm ${isBalanced ? 'text-emerald-300' : 'text-red-300'}`}>
                    {totals.credit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="rounded-br-lg px-2 py-3 text-center">
                    {isBalanced
                      ? <span className="text-emerald-300 text-xs">✓</span>
                      : <span className="text-red-300 text-xs">✗</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
                className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-medium transition">
                <Plus size={15} /> Add Line
              </button>
              {!isBalanced && totals.debit > 0 && (
                <span className="text-red-600 text-xs font-medium">
                  ⚠ Difference: {Math.abs(totals.debit - totals.credit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-100 transition">
                Cancel
              </button>
              <button type="submit" form="jv-form" disabled={loading || !isBalanced}
                className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow">
                {loading ? 'Saving...' : 'Save Journal Voucher'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// ── Password-protected JV Delete Modal ───────────────────────────────────────
const JvDeleteModal = ({ entry, onClose, onDeleted }: { entry: any; onClose: () => void; onDeleted: () => void }) => {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [correctPw, setCorrectPw] = useState('');
  const [pwLoaded, setPwLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/settings').then(res => {
      setCorrectPw(res.data.jv_delete_password || '');
      setPwLoaded(true);
    }).catch(() => setPwLoaded(true));
  }, []);

  const handleDelete = async () => {
    if (!pwLoaded) return;
    if (correctPw && password !== correctPw) {
      setError('Incorrect password');
      setPassword('');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/accounting/journal-entries/${entry.entry_id}`);
      toast.success(`${entry.entry_number} deleted successfully`);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {/* Icon + Title */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center mb-3">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Delete Journal Voucher</h2>
          <p className="text-sm text-gray-500 mt-1 text-center">
            This action <span className="font-semibold text-red-600">cannot be undone</span>.
            {entry.status === 'posted' && ' Account balances will be reversed.'}
          </p>
        </div>

        {/* Entry details */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Voucher #</span>
            <span className="font-mono font-bold text-gray-800">{entry.entry_number}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-700">{new Date(entry.entry_date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Amount</span>
            <span className="font-semibold text-gray-800">{Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${entry.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {entry.status}
            </span>
          </div>
        </div>

        {/* Password field — only if password is set */}
        {pwLoaded && correctPw && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Lock size={13} className="inline mr-1" />
              Enter Password to Confirm
            </label>
            <div className="relative">
              <input
                autoFocus
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleDelete(); }}
                placeholder="Enter password..."
                className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition"
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting || !pwLoaded || (!!correctPw && !password)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Trash2 size={15} />
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Journal Entries List ─────────────────────────────────────────────────
const JournalEntries = () => {
  const toast = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState(localMonthStart);
  const [toDate, setToDate] = useState(localToday);

  useEffect(() => { fetchEntries(); }, [pagination.page, statusFilter, fromDate, toDate]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get('/accounting/journal-entries', { params });
      setEntries(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (entry: any) => {
    if (!window.confirm(`Post journal entry ${entry.entry_number}? This will update account balances.`)) return;
    try {
      await api.post(`/accounting/journal-entries/${entry.entry_id}/post`);
      toast.success('Entry posted successfully');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to post');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-700',
      posted: 'bg-green-100 text-green-700',
      reversed: 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${map[status]}`}>{status}</span>;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileText className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Journal Voucher</h1>
            <p className="text-gray-600 text-sm mt-1">Record accounting transactions</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg">
          <Plus size={20} /> New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <DateRangeFilter standalone={false} dateFrom={fromDate} dateTo={toDate} onFromChange={setFromDate} onToChange={setToDate} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Entry #</th>
              <th className="text-left p-4 font-semibold text-gray-700">Date</th>
              <th className="text-left p-4 font-semibold text-gray-700">Description</th>
              <th className="text-right p-4 font-semibold text-gray-700">Debit</th>
              <th className="text-right p-4 font-semibold text-gray-700">Credit</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : entries.length > 0 ? (
              entries.map((entry: any) => (
                <tr key={entry.entry_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-mono font-semibold text-gray-800">{entry.entry_number}</td>
                  <td className="p-4 text-gray-600">{new Date(entry.entry_date).toLocaleDateString()}</td>
                  <td className="p-4 text-gray-600">{entry.description || '-'}</td>
                  <td className="p-4 text-right font-medium">{Number(entry.total_debit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-right font-medium">{Number(entry.total_credit).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-center">{statusBadge(entry.status)}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {entry.status === 'draft' && (
                        <button onClick={() => handlePost(entry)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Post Entry">
                          <Send size={16} />
                        </button>
                      )}
                      {/* Delete available for ALL statuses — password protected */}
                      <button onClick={() => setDeleteEntry(entry)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No entries found</td></tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setPagination(p => ({ ...p, page }))}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onItemsPerPageChange={(limit) => setPagination(p => ({ ...p, limit, page: 1 }))}
        />
      </div>

      <JournalEntryModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchEntries} />

      {deleteEntry && (
        <JvDeleteModal
          entry={deleteEntry}
          onClose={() => setDeleteEntry(null)}
          onDeleted={fetchEntries}
        />
      )}
    </div>
  );
};

const JournalEntriesWithGate = () => <ReportPasswordGate><JournalEntries /></ReportPasswordGate>;
export default JournalEntriesWithGate;
