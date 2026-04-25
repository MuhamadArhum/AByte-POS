import { useState, useEffect, useRef } from 'react';
import { ArrowUpCircle, Plus, Trash2, Download, Search, ChevronDown, X } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';

// ── Searchable Account Selector ───────────────────────────────────────────────
const AccountSelector = ({
  value, onChange, accounts, onAfterSelect,
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: any[];
  onAfterSelect?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => String(a.account_id) === String(value));
  const filtered = accounts.filter(a =>
    !search ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_code.includes(search)
  );

  useEffect(() => { setHi(0); }, [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (id: string) => {
    onChange(id); setOpen(false); setSearch(''); setHi(0);
    setTimeout(() => onAfterSelect?.(), 0);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400 text-left transition">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'Select Account…'}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) select(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
                placeholder="Search by name or code…" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${idx === hi ? 'bg-rose-50 text-rose-700' : 'hover:bg-gray-50'}`}>
                    <span className="font-mono text-xs text-gray-400 shrink-0">{a.account_code}</span>
                    <span className="text-gray-800 truncate">{a.account_name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── CPV Modal ─────────────────────────────────────────────────────────────────
type SavedLine = { voucher_id: number; voucher_number: string; account_name: string; narration: string; amount: number };

const CPVModal = ({ isOpen, onClose, onRefresh }: { isOpen: boolean; onClose: () => void; onRefresh: () => void }) => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(localToday());
  const [savedLines, setSavedLines] = useState<SavedLine[]>([]);
  const [entry, setEntry] = useState({ account_id: '', narration: '', amount: '' });
  const [saving, setSaving] = useState(false);

  const narrationRef = useRef<HTMLInputElement>(null);
  const amountRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/accounts', { params: { tree: 1 } })
        .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
        .catch(() => {});
      setSavedLines([]);
      setEntry({ account_id: '', narration: '', amount: '' });
      setDate(localToday());
    }
  }, [isOpen]);

  const saveEntry = async () => {
    if (!date || !entry.account_id || !entry.amount) {
      toast.error('Account and Amount are required');
      return;
    }
    const amount = parseFloat(entry.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }

    setSaving(true);
    try {
      const res = await api.post('/accounting/payment-vouchers', {
        voucher_date:   date,
        payment_to:     entry.narration || '—',
        payment_type:   'expense',
        account_id:     entry.account_id,
        amount,
        payment_method: 'cash',
        description:    entry.narration,
      });
      const acct = accounts.find(a => String(a.account_id) === entry.account_id);
      setSavedLines(prev => [...prev, {
        voucher_id:     res.data.voucher_id,
        voucher_number: res.data.voucher_number,
        account_name:   acct?.account_name ?? '',
        narration:      entry.narration,
        amount,
      }]);
      setEntry({ account_id: '', narration: '', amount: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteLine = async (voucher_id: number) => {
    try {
      await api.delete(`/accounting/payment-vouchers/${voucher_id}`);
      setSavedLines(prev => prev.filter(l => l.voucher_id !== voucher_id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleDone = () => { onRefresh(); onClose(); };
  const total = savedLines.reduce((s, l) => s + l.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-rose-600 to-red-700 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <ArrowUpCircle size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  Cash Payment Voucher <span className="text-rose-200 font-normal text-base">(CPV)</span>
                </h2>
                <p className="text-rose-100 text-xs mt-0.5">Press Enter on Amount to save each line</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-rose-100 text-sm font-medium">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-1.5 bg-white/15 border border-white/30 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                style={{ colorScheme: 'dark' }} />
              <button onClick={handleDone} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition">
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Entry Form Card */}
        <div className="px-6 py-4 bg-rose-50/60 border-b border-rose-100 shrink-0">
          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3">New Entry</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Account</label>
              <AccountSelector
                value={entry.account_id}
                onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                onAfterSelect={() => narrationRef.current?.focus()}
                accounts={accounts}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Description / Payment To</label>
              <input
                ref={narrationRef}
                type="text" value={entry.narration}
                onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                placeholder="e.g. Salary, Utility Bill..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 bg-white outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Amount</label>
              <div className="flex gap-2">
                <input
                  ref={amountRef}
                  type="number" step="0.01" min="0"
                  value={entry.amount}
                  onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border border-rose-200 bg-white rounded-lg text-sm text-right font-semibold text-rose-700 focus:ring-2 focus:ring-rose-400 outline-none" />
                <button onClick={saveEntry} disabled={saving}
                  className="px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition disabled:opacity-50 flex items-center gap-1">
                  {saving
                    ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Plus size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Saved Lines Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {savedLines.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ArrowUpCircle size={36} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No entries yet — fill the form above and press <strong>Enter</strong> or click <strong>+</strong></p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-white text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold w-32">Voucher #</th>
                    <th className="px-4 py-3 text-left font-semibold">Account</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold w-36">Amount</th>
                    <th className="px-4 py-3 text-center font-semibold w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {savedLines.map((line, i) => (
                    <tr key={line.voucher_id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-rose-600">{line.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{line.account_name}</td>
                      <td className="px-4 py-3 text-gray-500">{line.narration || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-700 font-mono">
                        {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => deleteLine(line.voucher_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-rose-600 text-white font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-base">
                      {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex items-center justify-between rounded-b-2xl">
          <p className="text-sm text-gray-500">
            {savedLines.length > 0
              ? <span className="text-emerald-600 font-semibold">{savedLines.length} voucher{savedLines.length !== 1 ? 's' : ''} saved ✓</span>
              : <span className="text-gray-400">Select account → description → amount → Enter</span>}
          </p>
          <button onClick={handleDone}
            className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition shadow-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main List Page ────────────────────────────────────────────────────────────
const PaymentVouchers = () => {
  const toast = useToast();
  const [vouchers, setVouchers]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]     = useState({ from_date: localMonthStart(), to_date: localToday() });

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/payment-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to fetch Cash Payment Vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVouchers(); }, [pagination.page, filters]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this Cash Payment Voucher?')) return;
    try {
      await api.delete(`/accounting/payment-vouchers/${id}`);
      toast.success('Deleted');
      fetchVouchers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const totalAmount = vouchers.reduce((sum, v) => sum + Number(v.amount), 0);

  const exportCSV = () => {
    const header = 'Voucher #,Date,Account,Narration,Amount';
    const rows = vouchers.map(v => [
      v.voucher_number,
      new Date(v.voucher_date).toLocaleDateString(),
      `"${v.account_name || ''}"`,
      `"${v.description || v.payment_to || ''}"`,
      Number(v.amount).toFixed(2)
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `cpv-${localToday()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Page Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
              <ArrowUpCircle size={22} className="text-rose-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Cash Payment Voucher <span className="text-rose-500 font-medium">(CPV)</span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Track all outgoing payments</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button onClick={exportCSV} disabled={vouchers.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 font-medium">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition shadow-sm">
              <Plus size={16} /> New CPV
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filters</span>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">From</span>
            <input type="date" value={filters.from_date}
              onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">To</span>
            <input type="date" value={filters.to_date}
              onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 outline-none" />
          </div>
          {(filters.from_date || filters.to_date) && (
            <button onClick={() => setFilters({ from_date: '', to_date: '' })}
              className="text-xs text-rose-500 hover:text-rose-700 font-medium transition">Clear</button>
          )}
          <span className="ml-auto text-xs text-gray-400 font-medium">
            {pagination.total} voucher{pagination.total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-7 w-7 rounded-full border-2 border-rose-600 border-t-transparent" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowUpCircle size={28} className="text-rose-200" />
            </div>
            <p className="font-semibold text-gray-500">No payment vouchers found</p>
            <p className="text-sm mt-1">Click <strong className="text-rose-600">New CPV</strong> to create entries</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-white text-xs uppercase tracking-wider">
                    <th className="px-5 py-3.5 text-left font-semibold">Voucher #</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Account</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Description</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                    <th className="px-5 py-3.5 text-center font-semibold w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id}
                      className={`border-b border-gray-50 hover:bg-rose-50/30 transition ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-rose-600">{v.voucher_number}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-gray-800 font-medium">{v.account_name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{v.description || v.payment_to || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-rose-700 font-mono whitespace-nowrap">
                        {Number(v.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button onClick={() => handleDelete(v.voucher_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-rose-600 text-white">
                    <td colSpan={4} className="px-5 py-3 text-right font-bold text-xs uppercase tracking-wide">Total (this page)</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-base whitespace-nowrap">
                      {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={page => setPagination(p => ({ ...p, page }))}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
              />
            </div>
          </>
        )}
      </div>

      <CPVModal isOpen={showModal} onClose={() => setShowModal(false)} onRefresh={fetchVouchers} />
    </div>
  );
};

export default PaymentVouchers;
