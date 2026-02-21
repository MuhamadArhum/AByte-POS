import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Pencil, Trash2, Search, X, Package, FolderOpen } from 'lucide-react';
import api from '../utils/api';

interface Category {
  category_id: number;
  category_name: string;
  description: string | null;
  is_active: number;
  product_count: number;
  created_at: string;
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formActive, setFormActive] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openModal = (cat?: Category) => {
    if (cat) {
      setEditCategory(cat);
      setFormName(cat.category_name);
      setFormDesc(cat.description || '');
      setFormActive(cat.is_active);
    } else {
      setEditCategory(null);
      setFormName('');
      setFormDesc('');
      setFormActive(1);
    }
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setFormError('Category name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editCategory) {
        await api.put(`/products/categories/${editCategory.category_id}`, {
          category_name: formName.trim(),
          description: formDesc.trim() || null,
          is_active: formActive,
        });
      } else {
        await api.post('/products/categories', { category_name: formName.trim() });
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (cat.product_count > 0) {
      alert(`Cannot delete "${cat.category_name}" - it has ${cat.product_count} products. Reassign products first.`);
      return;
    }
    if (!window.confirm(`Delete category "${cat.category_name}"?`)) return;
    try {
      await api.delete(`/products/categories/${cat.category_id}`);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const filtered = categories.filter(c =>
    !search || c.category_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalProducts = categories.reduce((sum, c) => sum + Number(c.product_count), 0);
  const activeCount = categories.filter(c => c.is_active).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Tag className="text-emerald-600" size={32} />
            Categories
          </h1>
          <p className="text-gray-500 mt-1">Organize your products into categories</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Category
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Tag size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{categories.length}</p>
              <p className="text-sm text-gray-500">Total Categories</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl"><FolderOpen size={24} className="text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl"><Package size={24} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Tag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{search ? 'No categories match your search' : 'No categories yet. Create your first category.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat) => (
            <div key={cat.category_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${cat.is_active ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                      <Tag size={20} className={cat.is_active ? 'text-emerald-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{cat.category_name}</h3>
                      {cat.description && <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    cat.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Package size={14} />
                    <span>{cat.product_count} products</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(cat)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Tag size={22} className="text-emerald-600" />
                {editCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Electronics"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>
              {editCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formActive}
                    onChange={(e) => setFormActive(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 font-medium"
                >
                  {saving ? 'Saving...' : editCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
