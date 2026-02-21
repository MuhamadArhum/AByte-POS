import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Search, DollarSign, Eye, Ban, ArrowUp, X, Gift, Printer } from 'lucide-react';
import { printReport, buildTable, buildStatsCards } from '../../utils/reportPrinter';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';

interface GiftCard {
  card_id: number;
  card_number: string;
  current_balance: number;
  initial_balance: number;
  status: 'active' | 'depleted' | 'expired' | 'disabled';
  customer_id: number | null;
  customer_name: string | null;
  expiry_date: string | null;
  created_at: string;
}

interface GiftCardDetail extends GiftCard {
  transactions: Transaction[];
}

interface Transaction {
  transaction_id: number;
  type: string;
  amount: number;
  balance_after: number;
  processed_by: string;
  created_at: string;
}

interface Stats {
  active_count: number;
  total_balance: number;
  total_issued: number;
  redeemed_this_month: number;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700' },
  depleted: { label: 'Depleted', bg: 'bg-gray-100', text: 'text-gray-600' },
  expired: { label: 'Expired', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  disabled: { label: 'Disabled', bg: 'bg-red-100', text: 'text-red-700' },
};

const GiftCards = () => {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState<Stats>({ active_count: 0, total_balance: 0, total_issued: 0, redeemed_this_month: 0 });

  // Modal states
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCheckBalanceModal, setShowCheckBalanceModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Issue card form
  const [issueAmount, setIssueAmount] = useState('');
  const [issueCustomerId, setIssueCustomerId] = useState('');
  const [issueExpiryDate, setIssueExpiryDate] = useState('');
  const [issuedCard, setIssuedCard] = useState<{ card_id: number; card_number: string; balance: number } | null>(null);

  // Check balance form
  const [checkCardNumber, setCheckCardNumber] = useState('');
  const [checkedCard, setCheckedCard] = useState<{ card_id: number; card_number: string; current_balance: number; status: string; expiry_date: string | null } | null>(null);

  // Load funds
  const [loadCard, setLoadCard] = useState<GiftCard | null>(null);
  const [loadAmount, setLoadAmount] = useState('');

  // Detail view
  const [detailCard, setDetailCard] = useState<GiftCardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/gift-cards', { params });
      setCards(res.data.data || []);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/gift-cards/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Issue card
  const openIssueModal = () => {
    setIssueAmount('');
    setIssueCustomerId('');
    setIssueExpiryDate('');
    setIssuedCard(null);
    setShowIssueModal(true);
  };

  const handleIssueCard = async () => {
    if (!issueAmount || parseFloat(issueAmount) <= 0) return alert('Enter a valid amount');
    try {
      const payload: Record<string, any> = { initial_balance: parseFloat(issueAmount) };
      if (issueCustomerId) payload.customer_id = parseInt(issueCustomerId);
      if (issueExpiryDate) payload.expiry_date = issueExpiryDate;
      const res = await api.post('/gift-cards', payload);
      setIssuedCard(res.data);
      fetchCards();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to issue gift card');
    }
  };

  // Check balance
  const openCheckBalanceModal = () => {
    setCheckCardNumber('');
    setCheckedCard(null);
    setShowCheckBalanceModal(true);
  };

  const handleCheckBalance = async () => {
    if (!checkCardNumber.trim()) return alert('Enter a card number');
    try {
      const res = await api.post('/gift-cards/check-balance', { card_number: checkCardNumber.trim() });
      setCheckedCard(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Card not found');
    }
  };

  // Load funds
  const openLoadModal = (card: GiftCard) => {
    setLoadCard(card);
    setLoadAmount('');
    setShowLoadModal(true);
  };

  const handleLoadFunds = async () => {
    if (!loadCard || !loadAmount || parseFloat(loadAmount) <= 0) return alert('Enter a valid amount');
    try {
      await api.post(`/gift-cards/${loadCard.card_id}/load`, { amount: parseFloat(loadAmount) });
      setShowLoadModal(false);
      setLoadCard(null);
      fetchCards();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load funds');
    }
  };

  // View detail
  const openDetailModal = async (card: GiftCard) => {
    setShowDetailModal(true);
    setDetailLoading(true);
    setDetailCard(null);
    try {
      const res = await api.get(`/gift-cards/${card.card_id}`);
      setDetailCard(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load card details');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Disable card
  const handleDisable = async (card: GiftCard) => {
    if (!window.confirm(`Disable gift card ${card.card_number}? This action cannot be undone.`)) return;
    try {
      await api.put(`/gift-cards/${card.card_id}/disable`);
      fetchCards();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disable card');
    }
  };

  const handlePrint = () => {
    let content = buildStatsCards([
      { label: 'Active Cards', value: String(stats.active_count) },
      { label: 'Total Balance', value: `$${Number(stats.total_balance).toFixed(2)}` },
      { label: 'Total Issued', value: String(stats.total_issued) },
      { label: 'Redeemed This Month', value: `$${Number(stats.redeemed_this_month).toFixed(2)}` },
    ]);
    const rows = cards.map(c => [
      c.card_number, `$${Number(c.current_balance).toFixed(2)}`, `$${Number(c.initial_balance).toFixed(2)}`,
      c.status, c.customer_name || '-', c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No expiry'
    ]);
    content += buildTable(['Card Number', 'Balance', 'Initial', 'Status', 'Customer', 'Expiry'], rows, { alignRight: [1, 2] });
    printReport({ title: 'Gift Cards Report', content });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Gift className="text-purple-600" size={32} /> Gift Cards
          </h1>
          <p className="text-gray-500 mt-1">Issue, manage, and track gift cards</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors" disabled={cards.length === 0}>
            <Printer size={20} /> Print
          </button>
          <button onClick={openCheckBalanceModal} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <Search size={20} /> Check Balance
          </button>
          <button onClick={openIssueModal} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 transition-colors">
            <Plus size={20} /> Issue Card
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-xl"><CreditCard size={24} className="text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.active_count}</p>
              <p className="text-sm text-gray-500">Active Cards</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl"><DollarSign size={24} className="text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-green-600">${Number(stats.total_balance).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Total Balance in Circulation</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl"><Gift size={24} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.total_issued}</p>
              <p className="text-sm text-gray-500">Total Issued</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><ArrowUp size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">${Number(stats.redeemed_this_month).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Redeemed This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by card number or customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="depleted">Depleted</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card Number</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Initial Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cards.map((card) => {
                  const badge = STATUS_BADGES[card.status] || STATUS_BADGES.active;
                  return (
                    <tr key={card.card_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">{card.card_number}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">${Number(card.current_balance).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">${Number(card.initial_balance).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{card.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(card.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openDetailModal(card)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {card.status === 'active' && (
                            <button
                              onClick={() => openLoadModal(card)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Load Funds"
                            >
                              <ArrowUp size={16} />
                            </button>
                          )}
                          {card.status === 'active' && (
                            <button
                              onClick={() => handleDisable(card)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Disable Card"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {cards.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <Gift size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>No gift cards found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          itemsPerPage={limit}
        />
      </div>

      {/* Issue Card Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Issue Gift Card</h2>
              <button onClick={() => setShowIssueModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {issuedCard ? (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <Gift size={40} className="mx-auto mb-2 text-green-600" />
                    <p className="text-sm text-green-600 font-medium">Gift Card Issued Successfully!</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Card Number</p>
                    <p className="text-2xl font-mono font-bold text-purple-700">{issuedCard.card_number}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Balance</p>
                    <p className="text-xl font-bold text-green-600">${Number(issuedCard.balance).toFixed(2)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance *</label>
                    <input
                      type="number"
                      value={issueAmount}
                      onChange={(e) => setIssueAmount(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID (Optional)</label>
                    <input
                      type="number"
                      value={issueCustomerId}
                      onChange={(e) => setIssueCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="1"
                      placeholder="Leave empty for anonymous"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={issueExpiryDate}
                      onChange={(e) => setIssueExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowIssueModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">
                {issuedCard ? 'Close' : 'Cancel'}
              </button>
              {!issuedCard && (
                <button onClick={handleIssueCard} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Issue Card
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Check Balance Modal */}
      {showCheckBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Check Balance</h2>
              <button onClick={() => setShowCheckBalanceModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={checkCardNumber}
                    onChange={(e) => setCheckCardNumber(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                    placeholder="Enter card number"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCheckBalance(); }}
                  />
                  <button onClick={handleCheckBalance} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <Search size={18} />
                  </button>
                </div>
              </div>
              {checkedCard && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-50 p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-purple-700">${Number(checkedCard.current_balance).toFixed(2)}</p>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Card Number</span>
                      <span className="font-mono font-medium">{checkedCard.card_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_BADGES[checkedCard.status] || STATUS_BADGES.active).bg} ${(STATUS_BADGES[checkedCard.status] || STATUS_BADGES.active).text}`}>
                        {(STATUS_BADGES[checkedCard.status] || STATUS_BADGES.active).label}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expiry Date</span>
                      <span>{checkedCard.expiry_date ? new Date(checkedCard.expiry_date).toLocaleDateString() : 'No expiry'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowCheckBalanceModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Funds Modal */}
      {showLoadModal && loadCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">Load Funds</h2>
                <p className="text-sm text-gray-500 font-mono">{loadCard.card_number}</p>
              </div>
              <button onClick={() => { setShowLoadModal(false); setLoadCard(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <p className="text-sm text-purple-600">Current Balance</p>
                <p className="text-2xl font-bold text-purple-700">${Number(loadCard.current_balance).toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Load</label>
                <input
                  type="number"
                  value={loadAmount}
                  onChange={(e) => setLoadAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowLoadModal(false); setLoadCard(null); }} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleLoadFunds} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Load Funds</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Gift Card Details</h2>
              <button onClick={() => { setShowDetailModal(false); setDetailCard(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
              </div>
            ) : detailCard ? (
              <div className="p-6 space-y-6">
                {/* Card info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Card Number</p>
                    <p className="text-2xl font-mono font-bold text-purple-700">{detailCard.card_number}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Current Balance</p>
                    <p className="text-xl font-bold text-green-600">${Number(detailCard.current_balance).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Initial Balance</p>
                    <p className="text-xl font-bold text-gray-700">${Number(detailCard.initial_balance).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_BADGES[detailCard.status] || STATUS_BADGES.active).bg} ${(STATUS_BADGES[detailCard.status] || STATUS_BADGES.active).text}`}>
                      {(STATUS_BADGES[detailCard.status] || STATUS_BADGES.active).label}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Customer</p>
                    <p className="text-sm font-medium text-gray-700">{detailCard.customer_name || 'Anonymous'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Expiry Date</p>
                    <p className="text-sm font-medium text-gray-700">{detailCard.expiry_date ? new Date(detailCard.expiry_date).toLocaleDateString() : 'No expiry'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-700">{new Date(detailCard.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Transaction history */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Transaction History</h3>
                  {detailCard.transactions && detailCard.transactions.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance After</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detailCard.transactions.map((txn) => (
                            <tr key={txn.transaction_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs text-gray-500">{new Date(txn.created_at).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  txn.type === 'load' ? 'bg-green-100 text-green-700' :
                                  txn.type === 'redeem' ? 'bg-orange-100 text-orange-700' :
                                  txn.type === 'issue' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${
                                txn.type === 'redeem' ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {txn.type === 'redeem' ? '-' : '+'}${Number(txn.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-700">${Number(txn.balance_after).toFixed(2)}</td>
                              <td className="px-4 py-3 text-gray-600">{txn.processed_by}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 border border-gray-200 rounded-xl">
                      <CreditCard size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>No transactions yet</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowDetailModal(false); setDetailCard(null); }} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftCards;
