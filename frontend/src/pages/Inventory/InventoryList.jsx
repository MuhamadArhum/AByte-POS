import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiAlertTriangle } from 'react-icons/fi';

export default function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editStock, setEditStock] = useState(0);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory');
      setInventory(res.data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (productId) => {
    try {
      await api.put(`/inventory/${productId}`, { available_stock: parseInt(editStock) });
      toast.success('Stock updated');
      setEditingId(null);
      loadInventory();
    } catch (err) {
      toast.error('Failed to update stock');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory Management</h1>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Available Stock</th>
              <th>Stock Value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center">Loading...</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan="7" className="text-center">No inventory data</td></tr>
            ) : (
              inventory.map((item) => (
                <tr key={item.product_id}>
                  <td>{item.product_name}</td>
                  <td>{item.category_name || '-'}</td>
                  <td>Rs. {Number(item.price).toLocaleString()}</td>
                  <td>
                    {editingId === item.product_id ? (
                      <input
                        type="number"
                        min="0"
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="inline-input"
                      />
                    ) : (
                      item.available_stock
                    )}
                  </td>
                  <td>Rs. {(Number(item.price) * item.available_stock).toLocaleString()}</td>
                  <td>
                    {item.available_stock === 0 ? (
                      <span className="stock-badge out"><FiAlertTriangle /> Out of Stock</span>
                    ) : item.available_stock < 10 ? (
                      <span className="stock-badge low"><FiAlertTriangle /> Low Stock</span>
                    ) : (
                      <span className="stock-badge ok">In Stock</span>
                    )}
                  </td>
                  <td>
                    {editingId === item.product_id ? (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(item.product_id)}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { setEditingId(item.product_id); setEditStock(item.available_stock); }}
                      >
                        Adjust
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
