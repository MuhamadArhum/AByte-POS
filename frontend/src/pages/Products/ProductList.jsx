import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';
import ProductForm from './ProductForm';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (stockFilter) params.stock = stockFilter;

      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, stockFilter]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted');
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSave = () => {
    setShowForm(false);
    setEditProduct(null);
    loadProducts();
    loadCategories();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>
          <FiPlus /> Add Product
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
          ))}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="">All Stock</option>
          <option value="low">Low Stock (&lt;10)</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Barcode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="6" className="text-center">No products found</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.product_id}>
                  <td>{p.product_name}</td>
                  <td>{p.category_name || '-'}</td>
                  <td>Rs. {Number(p.price).toLocaleString()}</td>
                  <td>
                    <span className={`stock-badge ${p.available_stock === 0 ? 'out' : p.available_stock < 10 ? 'low' : 'ok'}`}>
                      {p.available_stock ?? p.stock_quantity}
                    </span>
                  </td>
                  <td>{p.barcode || '-'}</td>
                  <td>
                    <button className="btn-icon" onClick={() => { setEditProduct(p); setShowForm(true); }}>
                      <FiEdit2 />
                    </button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p.product_id, p.product_name)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          product={editProduct}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
}
