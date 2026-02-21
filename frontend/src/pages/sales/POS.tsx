import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, Minus, Plus, Archive, Barcode, Scan, FileText, User, UserPlus, BarChart, X, Lock, DollarSign, Loader2, ShoppingBag, Keyboard, Percent, Calculator, Tag, Phone, Mail, Building2 } from 'lucide-react';
import { useCart, Product } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import ProductCard from '../../components/ProductCard';
import CheckoutModal from '../../components/CheckoutModal';
import AddCustomerModal from '../../components/AddCustomerModal';
import DailyReportModal from '../../components/DailyReportModal';
import RegisterCloseModal from '../../components/RegisterCloseModal';
import ProductVariantModal from '../../components/ProductVariantModal';
import api from '../../utils/api';

const POS = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    subtotal, total,
    taxRate, setTaxRate,
    additionalRate, setAdditionalRate,
    taxAmount, additionalAmount,
    appliedBundles, setAppliedBundles, bundleDiscount
  } = useCart();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchName, setSearchName] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [searchCode, setSearchCode] = useState('');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedPendingSale, setSelectedPendingSale] = useState<any>(null);

  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Register gate state
  const [register, setRegister] = useState<any>(null);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingRegister, setOpeningRegister] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Customer state
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Variant modal state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Check register on mount
  useEffect(() => {
    checkRegister();
  }, []);

  // Handle pending sale from Orders page navigation
  useEffect(() => {
    if (location.state?.pendingSale) {
      setSelectedPendingSale(location.state.pendingSale);
      setIsCheckoutOpen(true);
      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const checkRegister = async () => {
    setRegisterLoading(true);
    try {
      const res = await api.get('/register/current');
      setRegister(res.data);
    } catch (error) {
      setRegister(null);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleOpenRegister = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      alert('Please enter a valid opening balance');
      return;
    }
    setOpeningRegister(true);
    try {
      const res = await api.post('/register/open', { opening_balance: balance });
      setRegister(res.data);
      setOpeningBalance('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to open register');
    } finally {
      setOpeningRegister(false);
    }
  };

  // Fetch products and customers once register is open
  useEffect(() => {
    if (!register) return;

    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        const rows = res.data.data || res.data;
        const mappedProducts = (Array.isArray(rows) ? rows : []).map((p: any) => ({
          ...p,
          price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
          stock_quantity: p.available_stock || p.stock_quantity || 0
        }));
        setProducts(mappedProducts);
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const res = await api.get('/products/categories');
        setCategories(res.data.data || res.data);
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };

    fetchCustomers();
    fetchCategories();
    fetchProducts();
  }, [register]);

  // Barcode Auto-Add
  useEffect(() => {
    if (searchBarcode) {
      const match = products.find(p => p.barcode === searchBarcode);
      if (match) {
        if (match.stock_quantity > 0) {
          handleAddProduct(match); // Use handleAddProduct to support variants
          setSearchBarcode('');
        } else {
          alert('Product Out of Stock!');
          setSearchBarcode('');
        }
      }
    }
  }, [searchBarcode, products]);

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        const input = document.getElementById('barcode-input');
        if (input) input.focus();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const input = document.getElementById('search-name-input');
        if (input) input.focus();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        navigate('/orders');
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) handleHoldOrder();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsCheckoutOpen(true);
      }
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
        setIsDailyReportOpen(false);
        setIsCustomerModalOpen(false);
        setShowCloseModal(false);
        setShowCustomerDropdown(false);
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      const customerList = res.data.data || res.data;
      setCustomers(Array.isArray(customerList) ? customerList : []);
      // Auto-select Walk-in Customer (ID 1) if none selected
      if (!selectedCustomer) {
        const list = Array.isArray(customerList) ? customerList : [];
        const walkin = list.find((c: any) => c.customer_id === 1);
        if (walkin) setSelectedCustomer(walkin);
      }
    } catch (error) {
      console.error("Failed to fetch customers", error);
    }
  };

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bundle detection - detect applicable bundles whenever cart changes
  useEffect(() => {
    const detectBundles = async () => {
      if (cart.length === 0) {
        setAppliedBundles([]);
        return;
      }

      try {
        const cartItems = cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_price: item.price
        }));

        const response = await api.post('/bundles/detect', { cart_items: cartItems });
        setAppliedBundles(response.data.applicable_bundles || []);
      } catch (error) {
        console.error('Bundle detection error:', error);
        setAppliedBundles([]);
      }
    };

    detectBundles();
  }, [cart, setAppliedBundles]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      (c.phone_number && c.phone_number.includes(customerSearch))
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const handleHoldOrder = async () => {
    if (cart.length === 0) return;

    const note = prompt("Enter Reference / Table No / Customer Name (Optional):");
    if (note === null) return;

    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price
        })),
        customer_id: selectedCustomer?.customer_id || 1,
        discount: 0,
        total_amount: total,
        payment_method: 'cash',
        amount_paid: 0,
        user_id: user?.user_id,
        status: 'pending',
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
        note: note || ''
      };

      await api.post('/sales', payload);
      clearCart();
      alert('Order placed on hold (Pending)');
    } catch (error) {
      console.error('Failed to hold order', error);
      alert('Failed to hold order');
    }
  };

  const handleCartQtyChange = (productId: number, value: string) => {
    const qty = parseInt(value, 10);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(productId, qty);
    }
  };

  const handleCartQtyBlur = (productId: number, value: string) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 1) {
      updateQuantity(productId, 1);
    }
  };

  // Handle product click - check for variants
  const handleAddProduct = (product: Product) => {
    // @ts-ignore - has_variants exists on product after backend query
    if (product.has_variants) {
      setSelectedProduct(product);
      setIsVariantModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  // Handle variant selection from modal
  const handleVariantSelect = (variant: any) => {
    if (selectedProduct) {
      const finalPrice = selectedProduct.price + variant.price_adjustment;
      addToCart(selectedProduct, {
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        price: finalPrice,
        available_stock: variant.available_stock,
      });
    }
  };

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchName = searchName ? p.product_name.toLowerCase().includes(searchName.toLowerCase()) : true;
    const matchBarcode = searchBarcode ? (p.barcode && p.barcode.includes(searchBarcode)) : true;
    const matchCode = searchCode ? p.product_id.toString().includes(searchCode) : true;
    const matchCategory = selectedCategory === 'All'
      ? true
      : ((p as any).category_id && (p as any).category_id.toString() === selectedCategory);
    return matchName && matchBarcode && matchCode && matchCategory;
  }), [products, searchName, searchBarcode, searchCode, selectedCategory]);

  const expectedCash = register ? (
    parseFloat(register.opening_balance || 0) +
    parseFloat(register.cash_sales_total || 0) +
    parseFloat(register.total_cash_in || 0) -
    parseFloat(register.total_cash_out || 0)
  ) : 0;

  // Register loading screen
  if (registerLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Register...</p>
        </div>
      </div>
    );
  }

  // Register gate: if no open register, show open register screen
  if (!register) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center border border-emerald-100">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <DollarSign size={40} className="text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Open Register</h2>
          <p className="text-gray-600 mb-8">Enter the opening cash balance to start your shift</p>

          <div className="relative mb-6">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-2xl">$</div>
            <input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full pl-12 pr-6 py-5 border-2 border-gray-200 rounded-xl text-3xl font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleOpenRegister(); }}
            />
          </div>

          <button
            onClick={handleOpenRegister}
            disabled={openingRegister}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
          >
            {openingRegister ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Opening Register...
              </>
            ) : (
              <>
                <DollarSign size={24} />
                Open Register & Start
              </>
            )}
          </button>

          <p className="mt-6 text-sm text-gray-500">
            Logged in as <span className="font-semibold text-gray-700">{user?.name}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header / Search */}
        <div className="p-4 bg-white border-b border-gray-100 shadow-sm z-10 space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                <ShoppingBag size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Point of Sale</h1>
                <p className="text-xs text-gray-500">Cashier: {user?.name}</p>
              </div>
            </div>
            <div className="flex-1"></div>
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-200"
              title="Keyboard Shortcuts (F1)"
            >
              <Keyboard size={18} />
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium border border-indigo-200"
            >
              <FileText size={20} />
              Orders
              <span className="text-xs bg-indigo-200 px-1.5 py-0.5 rounded">F5</span>
            </button>
            <button
              onClick={() => setIsDailyReportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium border border-blue-200"
            >
              <BarChart size={20} />
              Report
            </button>
            {(user?.role_name === 'Admin' || user?.role_name === 'Manager') && (
              <button
                onClick={async () => {
                  try {
                    const res = await api.get('/register/current');
                    setRegister(res.data);
                  } catch (_) {}
                  setShowCloseModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200"
              >
                <Lock size={20} />
                Close
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="relative group">
              <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                id="barcode-input"
                type="text"
                placeholder="Scan Barcode (F2)"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Item Code"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                id="search-name-input"
                type="text"
                placeholder="Search Name (F3)"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto shadow-sm">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'All'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCategory(cat.category_id.toString())}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.category_id.toString()
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              {cat.category_name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading products...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.product_id} product={product} onAddToCart={handleAddProduct} />
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg font-medium">No products found</p>
                  <p className="text-gray-400 text-sm mt-2">Try adjusting your search filters</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart Sidebar */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
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
            <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Customer Selection & Details Panel */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <User size={16} />
              Customer
            </span>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-emerald-100"
            >
              <UserPlus size={14} />
              Add New
            </button>
          </div>

          {/* Customer Search */}
          <div className="relative mb-2" ref={customerSearchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by phone or name..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => { if (customerSearch.trim()) setShowCustomerDropdown(true); }}
            />
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-48 overflow-auto z-30">
                {filteredCustomers.map(c => (
                  <button
                    key={c.customer_id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch('');
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2 text-sm border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0">
                      {c.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-gray-800">{c.customer_name}</p>
                      {c.phone_number && <p className="text-xs text-gray-500">{c.phone_number}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Customer Card with Details */}
          {selectedCustomer && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl overflow-hidden">
              {/* Customer Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md">
                    {selectedCustomer.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{selectedCustomer.customer_name}</p>
                    {selectedCustomer.company && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Building2 size={10} />
                        {selectedCustomer.company}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const walkin = customers.find(c => c.customer_id === 1);
                    setSelectedCustomer(walkin || null);
                  }}
                  className="text-gray-400 hover:text-red-500 p-1.5 transition-colors hover:bg-red-50 rounded-lg"
                  title="Reset to Walk-in"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Customer Details Grid */}
              {selectedCustomer.customer_id !== 1 && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2 text-xs">
                  {selectedCustomer.phone_number && (
                    <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1.5 rounded-lg">
                      <Phone size={12} className="text-blue-500" />
                      <span className="text-gray-700 truncate">{selectedCustomer.phone_number}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1.5 rounded-lg">
                      <Mail size={12} className="text-purple-500" />
                      <span className="text-gray-700 truncate">{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.tax_id && (
                    <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1.5 rounded-lg col-span-2">
                      <Tag size={12} className="text-orange-500" />
                      <span className="text-gray-700">Tax ID: {selectedCustomer.tax_id}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={56} className="mb-4 opacity-20" />
              <p className="font-medium text-lg">Cart is empty</p>
              <p className="text-sm mt-1">Scan barcode or select products</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="bg-white p-3 rounded-xl flex items-center justify-between group shadow-sm border border-gray-100 hover:border-emerald-200 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 truncate">{item.product_name}</h4>
                  <p className="text-sm text-gray-500">
                    ${item.price.toFixed(2)} × {item.quantity} = 
                    <span className="font-semibold text-emerald-600 ml-1">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="flex items-center gap-1 bg-gray-50 rounded-lg border-2 border-gray-200 p-1">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleCartQtyChange(item.product_id, e.target.value)}
                      onBlur={(e) => handleCartQtyBlur(item.product_id, e.target.value)}
                      className="w-12 text-center text-sm font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="1"
                    />
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals Section */}
        <div className="p-5 bg-white border-t-2 border-gray-200 space-y-3">
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Subtotal</span>
            <span className="font-semibold">${subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Percent size={14} />
              <span>Tax</span>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-14 px-2 py-1 border-2 border-gray-200 rounded text-center bg-gray-50 font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                step="0.1"
              />
              <span className="text-gray-400">%</span>
            </div>
            <span className="font-semibold text-gray-600">${taxAmount.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Tag size={14} />
              <span>Charges</span>
              <input
                type="number"
                value={additionalRate}
                onChange={(e) => setAdditionalRate(Number(e.target.value))}
                className="w-14 px-2 py-1 border-2 border-gray-200 rounded text-center bg-gray-50 font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                step="0.1"
              />
              <span className="text-gray-400">%</span>
            </div>
            <span className="font-semibold text-gray-600">${additionalAmount.toFixed(2)}</span>
          </div>

          {/* Bundle Discount Display */}
          {appliedBundles.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm font-semibold text-green-700">
                <span>🎁 Bundle Savings</span>
                <span>-${bundleDiscount.toFixed(2)}</span>
              </div>
              {appliedBundles.map((bundle, idx) => (
                <div key={idx} className="text-xs text-green-600 flex justify-between items-start">
                  <span className="flex-1">{bundle.bundle_name}</span>
                  <span className="font-medium">-${bundle.discount_amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t-2 border-gray-200 flex justify-between items-center">
            <span className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calculator size={20} />
              Total
            </span>
            <span className="text-2xl font-bold text-emerald-600">${total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Archive size={20} />
              Hold (F8)
            </button>
            <button
              onClick={() => {
                setSelectedPendingSale(null);
                setIsCheckoutOpen(true);
              }}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <ShoppingCart size={20} />
              Pay (F9)
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Keyboard size={24} className="text-emerald-600" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'F1', desc: 'Show shortcuts' },
                { key: 'F2', desc: 'Focus barcode scanner' },
                { key: 'F3', desc: 'Focus name search' },
                { key: 'F5', desc: 'View orders' },
                { key: 'F8', desc: 'Hold order' },
                { key: 'F9', desc: 'Pay now / Checkout' },
                { key: 'ESC', desc: 'Close modals' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{desc}</span>
                  <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded-lg font-mono font-bold text-sm shadow-sm">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
        }}
        onSuccess={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
          const walkin = customers.find(c => c.customer_id === 1);
          setSelectedCustomer(walkin || null);
        }}
        pendingSale={selectedPendingSale}
        selectedCustomer={selectedCustomer}
        appliedBundles={appliedBundles}
      />

      <AddCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(newCustomer?: any) => {
          fetchCustomers();
          if (newCustomer) setSelectedCustomer(newCustomer);
        }}
      />

      <DailyReportModal
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
      />

      <RegisterCloseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onSuccess={() => {
          setShowCloseModal(false);
          setRegister(null);
        }}
        expectedCash={expectedCash}
        register={register}
      />

      {selectedProduct && (
        <ProductVariantModal
          isOpen={isVariantModalOpen}
          onClose={() => {
            setIsVariantModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSelectVariant={handleVariantSelect}
        />
      )}
    </div>
  );
};

export default POS;