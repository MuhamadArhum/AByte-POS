import { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Send, Trash2, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const JournalEntryModal = ({ isOpen, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { account_id: '', description: '', debit: '0', credit: '0' },
      { account_id: '', description: '', debit: '0', credit: '0' }
    ]
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/accounts', { params: { is_active: 1, limit: 200 } })
        .then(r => setAccounts(r.data.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account_id: '', description: '', debit: '0', credit: '0' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 2) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index)
    });
  };

  const updateLine = (index: number, field: string, value: string) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const totals = formData.lines.reduce((acc, line) => ({
    debit: acc.debit + Number(line.debit || 0),
    credit: acc.credit + Number(line.credit || 0)
  }), { debit: 0, credit: 0 });

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      toast.error('Debits must equal credits');
      return;
    }
    if (formData.lines.length < 2) {
      toast.error('At least 2 lines required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/accounting/journal-entries', formData);
      toast.success('Journal entry created');
      onSuccess();
      onClose();
      setFormData({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [
          { account_id: '', description: '', debit: '0', credit: '0' },
          { account_id: '', description: '', debit: '0', credit: '0' }
        ]
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">New Journal Entry</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entry Date *</label>
              <input type="date" value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input type="text" value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                placeholder="Entry description..." />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-700 w-1/3">Account</th>
                  <th className="text-left p-3 font-semibold text-gray-700 w-1/3">Description</th>
                  <th className="text-right p-3 font-semibold text-gray-700 w-24">Debit</th>
                  <th className="text-right p-3 font-semibold text-gray-700 w-24">Credit</th>
                  <th className="text-center p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {formData.lines.map((line, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2">
                      <select value={line.account_id} onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-violet-500" required>
                        <option value="">Select Account</option>
                        {accounts.map(a => (
                          <option key={a.account_id} value={a.account_id}>[{a.account_code}] {a.account_name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input type="text" value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-violet-500"
                        placeholder="Line description..." />
                    </td>
                    <td className="p-2">
                      <input type="number" step="0.01" min="0" value={line.debit}
                        onChange={(e) => updateLine(index, 'debit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-violet-500" />
                    </td>
                    <td className="p-2">
                      <input type="number" step="0.01" min="0" value={line.credit}
                        onChange={(e) => updateLine(index, 'credit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-violet-500" />
                    </td>
                    <td className="p-2 text-center">
                      {formData.lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(index)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="p-3 text-right">TOTAL:</td>
                  <td className={`p-3 text-right ${!isBalanced ? 'text-red-600' : 'text-green-600'}`}>
                    ${totals.debit.toFixed(2)}
                  </td>
                  <td className={`p-3 text-right ${!isBalanced ? 'text-red-600' : 'text-green-600'}`}>
                    ${totals.credit.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addLine}
            className="text-violet-600 hover:bg-violet-50 px-4 py-2 rounded-lg transition mb-4">
            + Add Line
          </button>

          {!isBalanced && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              ⚠️ Debits and Credits must be equal! Difference: ${Math.abs(totals.debit - totals.credit).toFixed(2)}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading || !isBalanced}
              className="flex-1 px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const JournalEntries = () => {
  const toast = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  const handleDelete = async (entry: any) => {
    if (!window.confirm(`Delete draft entry ${entry.entry_number}?`)) return;
    try {
      await api.delete(`/accounting/journal-entries/${entry.entry_id}`);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
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
          <FileText className="text-violet-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Journal Entries</h1>
            <p className="text-gray-600 text-sm mt-1">Record accounting transactions</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-xl hover:bg-violet-700 transition shadow-lg">
          <Plus size={20} /> New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500" placeholder="From" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500" placeholder="To" />
        </div>
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
                  <td className="p-4 text-right font-medium">${Number(entry.total_debit).toLocaleString()}</td>
                  <td className="p-4 text-right font-medium">${Number(entry.total_credit).toLocaleString()}</td>
                  <td className="p-4 text-center">{statusBadge(entry.status)}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {entry.status === 'draft' && (
                        <>
                          <button onClick={() => handlePost(entry)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Post Entry">
                            <Send size={16} />
                          </button>
                          <button onClick={() => handleDelete(entry)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No entries found</td></tr>
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>

      <JournalEntryModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchEntries} />
    </div>
  );
};

export default JournalEntries;
