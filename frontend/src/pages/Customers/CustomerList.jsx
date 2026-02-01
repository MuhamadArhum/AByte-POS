import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiX } from 'react-icons/fi';

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', phone_number: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const params = search ? { search } : {};
      const res = await api.get('/customers', { params });
      setCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load customers');
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customers', form);
      toast.success('Customer added');
      setShowForm(false);
      setForm({ customer_name: '', phone_number: '' });
      loadCustomers();
    } catch (err) {
      toast.error('Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const viewCustomer = async (id) => {
    try {
      const res = await api.get(`/customers/${id}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <FiPlus /> Add Customer
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.customer_id}>
                <td>{c.customer_name}</td>
                <td>{c.phone_number || '-'}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => viewCustomer(c.customer_id)}>
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Customer</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer Name *</label>
                <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedCustomer.customer_name} - Purchase History</h2>
              <button className="btn-icon" onClick={() => setSelectedCustomer(null)}><FiX /></button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Cashier</th></tr>
                </thead>
                <tbody>
                  {selectedCustomer.purchases?.length === 0 ? (
                    <tr><td colSpan="3" className="text-center">No purchases</td></tr>
                  ) : (
                    selectedCustomer.purchases?.map((p) => (
                      <tr key={p.sale_id}>
                        <td>{new Date(p.sale_date).toLocaleString()}</td>
                        <td>Rs. {Number(p.net_amount).toLocaleString()}</td>
                        <td>{p.cashier_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
