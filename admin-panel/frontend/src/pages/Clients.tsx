import { useEffect, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Key } from 'lucide-react';
import api from '../api/axios';
import AddClientModal from '../components/AddClientModal';

interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; modules_enabled: string | string[];
  company_name: string; db_name: string;
}

export default function Clients() {
  const [clients, setClients]   = useState<Tenant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/tenants').then(r => setClients(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (id: number, current: number) => {
    await api.put(`/tenants/${id}`, { is_active: current ? 0 : 1 });
    load();
  };

  const getModules = (modules: string | string[]) => {
    if (!modules) return [];
    if (Array.isArray(modules)) return modules;
    try { return JSON.parse(modules); } catch { return []; }
  };

  const moduleColors: Record<string, string> = {
    sales:     'bg-blue-100 text-blue-700',
    inventory: 'bg-green-100 text-green-700',
    accounts:  'bg-purple-100 text-purple-700',
    hr:        'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Clients</h2>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Client', 'Email', 'Modules', 'Monthly', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map(c => {
                const mods = getModules(c.modules_enabled);
                const monthly = mods.reduce((sum: number, m: string) => {
                  return sum + (['accounts','hr'].includes(m) ? 2999 : 2250);
                }, 0);

                return (
                  <tr key={c.tenant_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.company_name || c.tenant_name}</div>
                      <div className="text-gray-400 text-xs">{c.tenant_code}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.admin_email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {mods.map((m: string) => (
                          <span key={m} className={`px-2 py-0.5 rounded-full text-xs font-medium ${moduleColors[m] || 'bg-gray-100 text-gray-600'}`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">Rs. {monthly.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleStatus(c.tenant_id, c.is_active)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          title={c.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {c.is_active ? <XCircle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-green-500" />}
                        </button>
                        <button
                          onClick={() => {
                            const pw = prompt('New password (min 6 chars):');
                            if (pw && pw.length >= 6) {
                              api.post(`/tenants/${c.tenant_id}/reset-password`, { new_password: pw })
                                .then(() => alert('Password reset!'))
                                .catch(e => alert(e.response?.data?.message || 'Error'));
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100" title="Reset Password"
                        >
                          <Key size={16} className="text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <AddClientModal onClose={() => { setShowModal(false); load(); }} />}
    </div>
  );
}
