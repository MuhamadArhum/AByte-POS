import { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import api from '../utils/api';

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      setStores(res.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Store className="text-emerald-600" size={32} />
        <h1 className="text-3xl font-bold text-gray-800">Store Management</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Store Name</th>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Manager</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store: any) => (
              <tr key={store.store_id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-semibold">{store.store_name}</td>
                <td className="p-4">{store.store_code}</td>
                <td className="p-4">{store.manager_name || '-'}</td>
                <td className="p-4">{store.phone || '-'}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${store.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Stores;
