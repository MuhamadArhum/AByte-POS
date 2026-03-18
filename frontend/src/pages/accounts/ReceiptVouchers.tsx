import { useState, useEffect, useRef } from 'react';
import { Receipt, Plus, Trash2, Download, Search, ChevronDown, X } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { localToday } from '../../utils/dateUtils';

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
        className="w-full flex items-center justify-between px-2 py-1.5 border border-gray-200 rounded text-sm bg-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : 'Select Account…'}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) select(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full"
                placeholder="Search or code…" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-gray-400">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${idx === hi ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
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

// ── CRV Modal ─────────────────────────────────────────────────────────────────
type SavedLine = { voucher_id: number; voucher_number: string; account_name: string; narration: string; amount: number };

const CRVModal = ({ isOpen, onClose, onRefresh }: { isOpen: boolean; onClose: () => void; onRefresh: () => void }) => {
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
      api.get('/accounting/accounts', { params: { limit: 500 } })
        .then(r => setAccounts(r.data.data || []))
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
      const res = await api.post('/accounting/receipt-vouchers', {
        voucher_date:   date,
        received_from:  entry.narration || '—',
        receipt_type:   'customer',
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
      await api.delete(`/accounting/receipt-vouchers/${voucher_id}`);
      setSavedLines(prev => prev.filter(l => l.voucher_id !== voucher_id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleDone = () => { onRefresh(); onClose(); };
  const total = savedLines.reduce((s, l) => s + l.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-1">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[85vw] h-[calc(100vh-8px)] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Receipt size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Cash Receipt Voucher <span className="text-emerald-600">(CRV)</span></h2>
              <p className="text-xs text-gray-500">Fill each row and press Enter on Amount to save</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Date:</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <button onClick={handleDone} className="text-gray-400 hover:text-gray-600 transition">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Lines Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2.5 text-left font-semibold w-32 rounded-tl-lg">Voucher #</th>
                <th className="px-3 py-2.5 text-left font-semibold">Account Title</th>
                <th className="px-3 py-2.5 text-left font-semibold">Narration</th>
                <th className="px-3 py-2.5 text-right font-semibold w-40">Amount</th>
                <th className="px-3 py-2.5 text-center font-semibold w-12 rounded-tr-lg">Del</th>
              </tr>
            </thead>
            <tbody>
              {/* Already-saved lines */}
              {savedLines.map((line, i) => (
                <tr key={line.voucher_id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-emerald-600">{line.voucher_number}</td>
                  <td className="px-3 py-2.5 text-gray-800 font-medium">{line.account_name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{line.narration || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                    {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => deleteLine(line.voucher_id)}
                      className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Active input row */}
              <tr className="border-b-2 border-emerald-300 bg-emerald-50/40">
                <td className="px-3 py-2 text-center">
                  {saving
                    ? <span className="inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    : <span className="text-xs text-gray-400 font-mono">{String(savedLines.length + 1).padStart(2, '0')}</span>
                  }
                </td>
                <td className="px-2 py-2 min-w-[200px]">
                  <AccountSelector
                    value={entry.account_id}
                    onChange={id => setEntry(v => ({ ...v, account_id: id }))}
                    onAfterSelect={() => narrationRef.current?.focus()}
                    accounts={accounts}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    ref={narrationRef}
                    type="text" value={entry.narration}
                    onChange={e => setEntry(v => ({ ...v, narration: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') amountRef.current?.focus(); }}
                    placeholder="Line narration…"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-emerald-500 bg-white outline-none" />
                </td>
                <td className="px-2 py-2">
                  <input
                    ref={amountRef}
                    type="number" step="0.01" min="0"
                    value={entry.amount}
                    onChange={e => setEntry(v => ({ ...v, amount: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEntry(); }}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-emerald-200 bg-emerald-50 rounded text-sm text-right font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </td>
                <td />
              </tr>

              {/* Total row */}
              {savedLines.length > 0 && (
                <tr className="bg-emerald-600 text-white font-bold">
                  <td colSpan={4} className="px-3 py-3 text-right text-sm tracking-wide rounded-bl-lg">TOTAL</td>
                  <td className="px-3 py-3 text-right rounded-br-lg">
                    {total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {savedLines.length > 0
                ? <span className="text-emerald-600 font-semibold">{savedLines.length} voucher{savedLines.length !== 1 ? 's' : ''} saved ✓</span>
                : 'Select account, enter narration and amount, then press Enter'}
            </p>
            <button onClick={handleDone}
              className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main List Page ────────────────────────────────────────────────────────────
const ReceiptVouchers = () => {
  const toast = useToast();
  const [vouchers, setVouchers]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters]     = useState({ from_date: '', to_date: '' });

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/receipt-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to fetch Cash Receipt Vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVouchers(); }, [pagination.page, filters]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this Cash Receipt Voucher?')) return;
    try {
      await api.delete(`/accounting/receipt-vouchers/${id}`);
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
      `"${v.description || v.received_from || ''}"`,
      Number(v.amount).toFixed(2)
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `crv-${localToday()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Receipt size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Cash Receipt Voucher <span className="text-emerald-600">(CRV)</span>
            </h1>
            <p className="text-sm text-gray-500">Track all incoming payments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-40">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-md">
            <Plus size={17} /> New CRV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filter</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From</span>
            <input type="date" value={filters.from_date}
              onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">To</span>
            <input type="date" value={filters.to_date}
              onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          {(filters.from_date || filters.to_date) && (
            <button onClick={() => setFilters({ from_date: '', to_date: '' })}
              className="text-xs text-emerald-600 hover:text-emerald-800 transition">Clear</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{pagination.total} voucher{pagination.total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-7 w-7 rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt size={44} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No Cash Receipt Vouchers found</p>
            <p className="text-sm mt-1">Click <strong>New CRV</strong> to create entries</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Voucher #</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Account</th>
                    <th className="px-4 py-3 text-left font-semibold">Narration</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-center font-semibold w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v.voucher_id}
                      className={`border-b border-gray-50 hover:bg-emerald-50/30 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-600">{v.voucher_number}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {new Date(v.voucher_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{v.account_name}</td>
                      <td className="px-4 py-3 text-gray-500">{v.description || v.received_from || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {Number(v.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(v.voucher_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-600 text-white">
                    <td colSpan={4} className="px-4 py-3 text-right font-bold text-sm">Total (this page)</td>
                    <td className="px-4 py-3 text-right font-bold text-base whitespace-nowrap">
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

      <CRVModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onRefresh={fetchVouchers}
      />
    </div>
  );
};

export default ReceiptVouchers;
