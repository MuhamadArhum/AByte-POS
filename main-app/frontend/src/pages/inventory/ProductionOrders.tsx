import { useState, useEffect, useCallback } from 'react';
import { Plus, Factory, Check, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';

interface Recipe {
  recipe_id: number;
  recipe_name: string;
  output_product_name: string;
  output_product_type: string;
  output_quantity: number;
  output_stock: number;
  is_active: number;
  ingredients: {
    ingredient_id: number;
    product_id: number;
    product_name: string;
    product_type: string;
    quantity: number;
    unit: string;
    available_stock: number;
  }[];
}

interface ProductionOrder {
  production_id: number;
  recipe_id: number;
  recipe_name: string;
  output_product_name: string;
  batches: number;
  output_quantity: number;
  status: string;
  notes: string;
  produced_by_name: string;
  produced_at: string;
}

const ProductionOrders = () => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // New order modal
  const [showModal, setShowModal] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [batches, setBatches] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/production-orders', { params: { page: currentPage, limit: itemsPerPage } });
      setOrders(res.data.data || []);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentPage, itemsPerPage]);

  const fetchRecipes = async () => {
    try {
      const res = await api.get('/recipes', { params: { is_active: 1 } });
      setRecipes(res.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openModal = async () => {
    await fetchRecipes();
    setSelectedRecipe(null);
    setBatches(1);
    setNotes('');
    setError('');
    setShowModal(true);
  };

  const handleRecipeSelect = (id: string) => {
    const r = recipes.find(r => r.recipe_id === Number(id)) || null;
    setSelectedRecipe(r);
    setError('');
  };

  const getNeeded = (qty: number) => Number((qty * batches).toFixed(3));
  const hasInsufficientStock = selectedRecipe?.ingredients.some(
    i => getNeeded(i.quantity) > Number(i.available_stock || 0)
  );

  const handleProduce = async () => {
    setError('');
    if (!selectedRecipe) return setError('Select a recipe');
    if (!batches || batches <= 0) return setError('Batches must be > 0');
    setSaving(true);
    try {
      await api.post('/production-orders', { recipe_id: selectedRecipe.recipe_id, batches, notes });
      setShowModal(false);
      fetchOrders();
    } catch (err: any) {
      const details = err.response?.data?.details;
      setError(err.response?.data?.message || 'Failed to create production order');
      if (details) setError(prev => prev + '\n' + details.join('\n'));
    } finally {
      setSaving(false);
    }
  };

  const typeBadge = (t: string) => {
    if (t === 'finished_good') return 'bg-emerald-100 text-emerald-700';
    if (t === 'semi_finished') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  };
  const typeLabel = (t: string) =>
    t === 'finished_good' ? 'FG' : t === 'semi_finished' ? 'SF' : 'RM';

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <Factory className="text-emerald-600" size={20} />
            Production Orders
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Convert raw materials into finished goods via recipes</p>
        </div>
        <button onClick={openModal}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 text-sm">
          <Plus size={16} /> New Production Run
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Factory size={40} className="mx-auto mb-3 opacity-30" />
            <p>No production orders yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batches</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Produced</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produced By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <>
                      <tr key={o.production_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button className="text-gray-400 hover:text-gray-600"
                            onClick={() => setExpandedId(expandedId === o.production_id ? null : o.production_id)}>
                            {expandedId === o.production_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{o.recipe_name}</td>
                        <td className="px-4 py-3 text-gray-700">{o.output_product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{o.batches}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full text-xs">
                            +{o.output_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{o.produced_by_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.produced_at).toLocaleString()}</td>
                      </tr>
                      {expandedId === o.production_id && o.notes && (
                        <tr key={`${o.production_id}-note`}>
                          <td colSpan={7} className="px-12 py-2 bg-gray-50 text-xs text-gray-500 italic">{o.notes}</td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
              totalItems={totalItems} itemsPerPage={itemsPerPage}
              onItemsPerPageChange={v => { setItemsPerPage(v); setCurrentPage(1); }} />
          </>
        )}
      </div>

      {/* New Production Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Factory size={16} className="text-emerald-600" /> New Production Run</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm whitespace-pre-line">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe *</label>
                <select onChange={e => handleRecipeSelect(e.target.value)} defaultValue=""
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Select recipe...</option>
                  {recipes.map(r => (
                    <option key={r.recipe_id} value={r.recipe_id}>
                      {r.recipe_name} → {r.output_product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batches *</label>
                  <input type="number" min="0.001" step="0.001" value={batches}
                    onChange={e => setBatches(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                {selectedRecipe && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Will Produce</label>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700">
                      {(selectedRecipe.output_quantity * batches).toFixed(3)} units of {selectedRecipe.output_product_name}
                    </div>
                  </div>
                )}
              </div>

              {selectedRecipe && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Ingredients Required</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Ingredient</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Need</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">In Stock</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedRecipe.ingredients.map(ing => {
                          const needed = getNeeded(ing.quantity);
                          const sufficient = Number(ing.available_stock || 0) >= needed;
                          return (
                            <tr key={ing.ingredient_id} className={!sufficient ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">
                                <span className={`mr-1 text-xs px-1 py-0.5 rounded ${typeBadge(ing.product_type)}`}>{typeLabel(ing.product_type)}</span>
                                {ing.product_name}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{needed} {ing.unit}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{ing.available_stock ?? 0}</td>
                              <td className="px-3 py-2 text-center">
                                {sufficient
                                  ? <Check size={13} className="text-emerald-500 mx-auto" />
                                  : <AlertTriangle size={13} className="text-red-500 mx-auto" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasInsufficientStock && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Insufficient stock for some ingredients
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleProduce} disabled={saving || !selectedRecipe}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Factory size={14} />}
                Produce
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionOrders;
