import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, AlertTriangle, Edit, Trash2, Barcode } from 'lucide-react';
import api from '../utils/api';
import AddProductModal from '../components/AddProductModal';
import BarcodeModal from '../components/BarcodeModal';
import Pagination from '../components/Pagination';

interface InventoryItem {
  inventory_id?: number; // Optional as products endpoint might not return it directly, but we use product_id
  product_id: number;
  available_stock: number;
  last_updated?: string;
  product_name: string;
  price: string | number;
  category_name: string | null;
  barcode?: string;
  stock_quantity?: number; // Product endpoint uses this or available_stock
}

const Inventory = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<InventoryItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Stats State
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    totalValue: 0
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Paginated Data
      const res = await api.get('/products', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm
        }
      });
      
      if (res.data.pagination) {
        setProducts(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        // Fallback for non-paginated response
        setProducts(res.data);
      }

      // Fetch Stats (Separate call or derived? For now, let's keep it simple and maybe fetch all for stats is too heavy)
      // We'll just set stats based on pagination meta if available, or we might need a stats endpoint.
      // For now, let's just fetch full stats once or use a separate simplified call if performance allows.
      // Actually, let's try to get stats from a separate lightweight call or just show "Visible" stats?
      // No, "Total Products" should be real total.
      setStats(prev => ({
        ...prev,
        totalProducts: res.data.pagination ? res.data.pagination.total : res.data.length
      }));

    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${productId}`);
      fetchInventory();
    } catch (error: any) {
      console.error("Failed to delete product", error);
      alert(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to page 1 on search
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-gray-600">Track stock, manage products, and suppliers</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchInventory} 
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Products</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalProducts}</p>
        </div>
        {/* Note: Low Stock and Total Value are harder to calculate with pagination without backend support. 
            I'll leave them as placeholder or calculated from current page for now, 
            or I should add a stats endpoint. 
            For now, I'll remove the specific calculation or keep it simple. */}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          {/* Filter button could go here */}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.product_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        {product.product_name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                        <div className="text-sm text-gray-500">{product.barcode || 'No Barcode'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {product.category_name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        (product.available_stock || product.stock_quantity || 0) < 10 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {product.available_stock ?? product.stock_quantity} units
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex gap-3">
                      <button className="text-blue-600 hover:text-blue-800" title="Edit">
                        <Edit size={18} />
                      </button>
                      <button 
                        className="text-purple-600 hover:text-purple-800" 
                        title="Generate Barcode"
                        onClick={() => setBarcodeProduct(product)}
                      >
                        <Barcode size={18} />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-800" 
                        title="Delete"
                        onClick={() => handleDelete(product.product_id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
        />
      </div>

      {barcodeProduct && (
        <BarcodeModal
          isOpen={!!barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
          productName={barcodeProduct.product_name}
          barcode={barcodeProduct.barcode || ''}
        />
      )}
    </div>
  );
};

export default Inventory;
