import { useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiX } from 'react-icons/fi';

export default function ProductForm({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    product_name: product?.product_name || '',
    category_id: product?.category_id || '',
    price: product?.price || '',
    stock_quantity: product?.stock_quantity ?? product?.available_stock ?? 0,
    barcode: product?.barcode || '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await api.post('/products/categories', { category_name: newCategory });
      setForm({ ...form, category_id: res.data.category_id });
      setNewCategory('');
      setShowNewCategory(false);
      toast.success('Category added');
      onSave(); // refresh categories in parent
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add category');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (product) {
        await api.put(`/products/${product.product_id}`, form);
        toast.success('Product updated');
      } else {
        await api.post('/products', form);
        toast.success('Product created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{product ? 'Edit Product' : 'Add Product'}</h2>
          <button className="btn-icon" onClick={onClose}><FiX /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name *</label>
            <input name="product_name" value={form.product_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Category</label>
            <div className="input-with-action">
              <select name="category_id" value={form.category_id} onChange={handleChange}>
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" onClick={() => setShowNewCategory(!showNewCategory)}>
                + New
              </button>
            </div>
            {showNewCategory && (
              <div className="input-with-action" style={{ marginTop: '0.5rem' }}>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category name"
                />
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddCategory}>Add</button>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price (Rs.) *</label>
              <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Stock Quantity</label>
              <input name="stock_quantity" type="number" min="0" value={form.stock_quantity} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Barcode</label>
            <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Optional" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : product ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
