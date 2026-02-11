import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../utils/api';

const StockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/purchase-orders/stock-alerts');
      setAlerts(res.data.data || []);
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
        <AlertTriangle className="text-red-600" size={32} />
        <h1 className="text-3xl font-bold text-gray-800">Stock Alerts</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Product</th>
              <th className="text-left p-4">Alert Type</th>
              <th className="text-right p-4">Current Stock</th>
              <th className="text-right p-4">Threshold</th>
              <th className="text-left p-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert: any) => (
              <tr key={alert.alert_id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{alert.product_name}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    alert.alert_type === 'out_of_stock' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {alert.alert_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 text-right">{alert.current_stock}</td>
                <td className="p-4 text-right">{alert.threshold_value}</td>
                <td className="p-4">{new Date(alert.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockAlerts;
