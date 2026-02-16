import { useState, useEffect } from 'react';
import { Star, Settings, Search, Trophy, Users, X, Plus, Minus } from 'lucide-react';
import api from '../utils/api';

const LoyaltyProgram = () => {
  const [config, setConfig] = useState({ points_per_amount: 1, amount_per_point: 100, min_redeem_points: 100, is_active: 0 });
  const [stats, setStats] = useState({ total_points_circulation: 0, active_members: 0, total_redeemed: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Customer lookup
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustCustomerId, setAdjustCustomerId] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, lbRes] = await Promise.all([
        api.get('/loyalty/config'), api.get('/loyalty/stats'), api.get('/loyalty/leaderboard')
      ]);
      setConfig(configRes.data);
      setStats(statsRes.data);
      setLeaderboard(lbRes.data.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/loyalty/config', config);
      fetchAll();
    } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const searchCustomer = async () => {
    if (!customerSearch.trim()) return;
    try {
      const res = await api.get('/customers', { params: { search: customerSearch, limit: 10 } });
      setSearchResults(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const selectCustomer = async (id: number) => {
    try {
      const res = await api.get(`/loyalty/customer/${id}`);
      setCustomerData(res.data);
      setSearchResults([]);
    } catch (err) { console.error(err); }
  };

  const handleAdjust = async () => {
    if (!adjustCustomerId || !adjustPoints) return alert('Fill all fields');
    try {
      await api.post('/loyalty/adjust', { customer_id: parseInt(adjustCustomerId), points: parseInt(adjustPoints), description: adjustDesc });
      setAdjustModal(false); fetchAll();
      if (customerData && customerData.customer_id === parseInt(adjustCustomerId)) selectCustomer(parseInt(adjustCustomerId));
    } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="p-8"><div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-600"></div></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><Star className="text-yellow-500" size={32} /> Loyalty Program</h1>
          <p className="text-gray-500 mt-1">Manage customer rewards and loyalty points</p>
        </div>
        <button onClick={() => { setAdjustModal(true); setAdjustCustomerId(''); setAdjustPoints(''); setAdjustDesc(''); }} className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2.5 rounded-xl hover:bg-yellow-700 transition-colors"><Plus size={20} /> Adjust Points</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-yellow-50 rounded-xl"><Star size={24} className="text-yellow-600" /></div>
          <div><p className="text-2xl font-bold text-yellow-600">{stats.total_points_circulation.toLocaleString()}</p><p className="text-sm text-gray-500">Points in Circulation</p></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-blue-50 rounded-xl"><Users size={24} className="text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-blue-600">{stats.active_members}</p><p className="text-sm text-gray-500">Active Members</p></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-green-50 rounded-xl"><Trophy size={24} className="text-green-600" /></div>
          <div><p className="text-2xl font-bold text-green-600">{stats.total_redeemed.toLocaleString()}</p><p className="text-sm text-gray-500">Total Points Redeemed</p></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Settings size={20} /> Configuration</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Enable Loyalty</span>
              <button onClick={() => setConfig({ ...config, is_active: config.is_active ? 0 : 1 })}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Points Earned Per Transaction</label>
              <input type="number" value={config.points_per_amount} onChange={(e) => setConfig({ ...config, points_per_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" min="0" step="0.1" />
              <p className="text-xs text-gray-400 mt-1">Points awarded per qualifying amount</p>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount Per Point ($)</label>
              <input type="number" value={config.amount_per_point} onChange={(e) => setConfig({ ...config, amount_per_point: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" min="1" />
              <p className="text-xs text-gray-400 mt-1">Spend this much to earn points</p>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Min Points to Redeem</label>
              <input type="number" value={config.min_redeem_points} onChange={(e) => setConfig({ ...config, min_redeem_points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" min="1" />
            </div>
            <button onClick={saveConfig} disabled={saving} className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Configuration'}</button>
          </div>
        </div>

        {/* Customer Lookup */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Search size={20} /> Customer Lookup</h2>
          <div className="flex gap-2 mb-4">
            <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchCustomer()} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none" placeholder="Search customer..." />
            <button onClick={searchCustomer} className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"><Search size={18} /></button>
          </div>
          {searchResults.length > 0 && (
            <div className="border rounded-lg mb-4 max-h-32 overflow-y-auto">{searchResults.map((c: any) => (
              <button key={c.customer_id} onClick={() => selectCustomer(c.customer_id)} className="w-full text-left px-3 py-2 hover:bg-yellow-50 text-sm border-b last:border-b-0">
                <span className="font-medium">{c.customer_name}</span>
                <span className="text-gray-400 ml-2">{c.phone_number || ''}</span>
              </button>
            ))}</div>
          )}
          {customerData && (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-yellow-700">{customerData.customer_name}</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{(customerData.loyalty_points || 0).toLocaleString()}</p>
                <p className="text-xs text-yellow-600">Points Balance</p>
              </div>
              {customerData.transactions && customerData.transactions.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">{customerData.transactions.map((t: any) => (
                  <div key={t.transaction_id} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded-lg">
                    <div><span className={`font-medium ${t.type === 'earn' ? 'text-green-600' : t.type === 'redeem' ? 'text-red-600' : 'text-blue-600'}`}>{t.type.toUpperCase()}</span>
                    <span className="text-gray-400 ml-2">{new Date(t.created_at).toLocaleDateString()}</span></div>
                    <span className={`font-bold ${t.points > 0 ? 'text-green-600' : 'text-red-600'}`}>{t.points > 0 ? '+' : ''}{t.points}</span>
                  </div>
                ))}</div>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Trophy size={20} /> Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No loyalty members yet</p>
          ) : (
            <div className="space-y-2">{leaderboard.map((c, idx) => (
              <div key={c.customer_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                }`}>#{idx + 1}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{c.customer_name}</p><p className="text-xs text-gray-400">Earned: {Number(c.total_earned).toLocaleString()}</p></div>
                <div className="text-right"><p className="font-bold text-yellow-600">{Number(c.loyalty_points).toLocaleString()}</p><p className="text-xs text-gray-400">pts</p></div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Adjust Points</h2>
              <button onClick={() => setAdjustModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label><input type="number" value={adjustCustomerId} onChange={(e) => setAdjustCustomerId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Enter customer ID" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Points (+ or -)</label><input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. 50 or -20" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><input type="text" value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Reason for adjustment" /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setAdjustModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Adjust Points</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyProgram;
