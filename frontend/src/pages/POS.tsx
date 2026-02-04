import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Trash2, Minus, Plus, Save, Clock, RefreshCw, Archive, Barcode, Scan, FileText } from 'lucide-react';
import { useCart, Product } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import CheckoutModal from '../components/CheckoutModal';
import api from '../utils/api';

const POS = () => {
  const { 
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    subtotal, total, 
    taxRate, setTaxRate, 
    additionalRate, setAdditionalRate,
    taxAmount, additionalAmount 
  } = useCart();
  const { user } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [selectedPendingSale, setSelectedPendingSale] = useState<any>(null);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        const mappedProducts = res.data.map((p: any) => ({
          ...p,
          price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
          stock_quantity: p.available_stock || 0
        }));
        setProducts(mappedProducts);
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const fetchPendingSales = async () => {
    try {
      const res = await api.get('/sales/pending');
      setPendingSales(res.data);
    } catch (error) {
      console.error("Failed to fetch pending sales", error);
    }
  };

  useEffect(() => {
    if (isPendingModalOpen) {
      fetchPendingSales();
    }
  }, [isPendingModalOpen]);

  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price
        })),
        discount: 0,
        total_amount: total,
        payment_method: 'cash',
        amount_paid: 0,
        user_id: user?.user_id,
        status: 'pending',
        tax_percent: taxRate,
        additional_charges_percent: additionalRate
      };

      await api.post('/sales', payload);
      clearCart();
      alert('Order placed on hold (Pending)');
    } catch (error) {
      console.error('Failed to hold order', error);
      alert('Failed to hold order');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchName = searchName ? p.product_name.toLowerCase().includes(searchName.toLowerCase()) : true;
    const matchBarcode = searchBarcode ? (p.barcode && p.barcode.includes(searchBarcode)) : true;
    // Assuming 'searchCode' might match product_id or another code field. Using product_id for now as "Item Code"
    const matchCode = searchCode ? p.product_id.toString().includes(searchCode) : true;
    
    return matchName && matchBarcode && matchCode;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header / Search */}
        <div className="p-4 bg-white border-b border-gray-100 shadow-sm z-10 space-y-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">POS</h1>
            <div className="flex-1"></div>
            <button 
              onClick={() => setIsPendingModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors font-medium border border-orange-200"
            >
              <Clock size={20} />
              Pending Orders
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Scan Barcode"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
              />
            </div>
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Item Code"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search Name"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.product_id} product={product} onAddToCart={addToCart} />
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                  No products found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart Sidebar */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-20">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={24} className="text-emerald-600" />
            Current Sale
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearCart}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear Cart"
            >
              <Trash2 size={20} />
            </button>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {cart.length} items
            </span>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-sm">Scan barcode or select products</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="bg-gray-50 p-3 rounded-xl flex items-center justify-between group">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{item.product_name}</h4>
                  <p className="text-sm text-gray-500">${item.price.toFixed(2)} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
                    <button 
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product_id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals Section */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-3">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          
          {/* Tax & Charges Inputs */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>Tax (%)</span>
              <input 
                type="number" 
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-12 px-1 py-0.5 border rounded text-center bg-white"
              />
            </div>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>Add. Charges (%)</span>
              <input 
                type="number" 
                value={additionalRate}
                onChange={(e) => setAdditionalRate(Number(e.target.value))}
                className="w-12 px-1 py-0.5 border rounded text-center bg-white"
              />
            </div>
            <span>${additionalAmount.toFixed(2)}</span>
          </div>

          <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
            <span className="text-lg font-bold text-gray-800">Total</span>
            <span className="text-2xl font-bold text-emerald-600">${total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Archive size={20} />
              Hold Order
            </button>
            <button
              onClick={() => {
                setSelectedPendingSale(null);
                setIsCheckoutOpen(true);
              }}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={20} />
              Pay Now
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
        }}
        onSuccess={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
          fetchPendingSales(); // Refresh pending list if needed
        }}
        pendingSale={selectedPendingSale}
      />

      {/* Pending Sales Modal */}
      {isPendingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clock size={24} className="text-orange-500" />
                Pending Orders
              </h2>
              <button onClick={() => setIsPendingModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {pendingSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Archive size={48} className="mb-4 opacity-20" />
                  <p>No pending orders found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingSales.map(sale => (
                    <div key={sale.sale_id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800">Order #{sale.sale_id}</p>
                          <p className="text-xs text-gray-500">{new Date(sale.sale_date).toLocaleString()}</p>
                        </div>
                        <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-medium capitalize">
                          {sale.status}
                        </span>
                      </div>
                      
                      <div className="py-2 border-t border-b border-gray-100 my-2 space-y-1">
                        <p className="text-sm flex justify-between">
                          <span className="text-gray-500">Total:</span>
                          <span className="font-bold">${parseFloat(sale.total_amount).toFixed(2)}</span>
                        </p>
                        <p className="text-sm flex justify-between">
                          <span className="text-gray-500">Customer:</span>
                          <span>{sale.customer_name || 'Walk-in'}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedPendingSale(sale);
                          setIsPendingModalOpen(false);
                          setIsCheckoutOpen(true);
                        }}
                        className="w-full mt-2 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                      >
                        Pay & Complete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;

// Simple X icon component for local use if needed, but imported from lucide-react above
function X({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
