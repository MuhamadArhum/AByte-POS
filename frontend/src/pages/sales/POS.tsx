import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, Minus, Plus, Archive, Barcode, Scan, FileText, User, UserPlus, BarChart, X, Lock, DollarSign, Loader2, ShoppingBag, Keyboard, Percent, Calculator, Tag, Phone, Mail, Building2 } from 'lucide-react';
import Pagination from '../../components/Pagination';
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

  // Product pagination
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalItems, setProductTotalItems] = useState(0);
  const [productLimit, setProductLimit] = useState(20);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedPendingSale, setSelectedPendingSale] = useState<any>(null);

  // Edit pending order state
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingTokenNo, setEditingTokenNo] = useState<string | null>(null);

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

  // Hold order token display
  const [holdToken, setHoldToken] = useState<string | null>(null);

  // Check register on mount
  useEffect(() => {
    checkRegister();
  }, []);

  // Handle pending sale from Orders page navigation
  useEffect(() => {
    if (location.state?.pendingSale) {
      setSelectedPendingSale(location.state.pendingSale);
      setIsCheckoutOpen(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.editOrder) {
      loadEditOrder(location.state.editOrder);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadEditOrder = async (sale: any) => {
    try {
      const res = await api.get(`/sales/${sale.sale_id}`);
      const saleData = res.data;
      clearCart();
      // Add items to cart one by one, then update quantity
      const items: any[] = saleData.items || [];
      for (const item of items) {
        const product = {
          product_id: item.product_id,
          product_name: item.product_name,
          price: parseFloat(item.unit_price),
          stock_quantity: 999,
          barcode: null,
          has_variants: false,
        } as any;
        addToCart(product);
        // quantity > 1: will be set via updateQuantity below
      }
      // After adding all items, update quantities (requires a small delay for state to settle)
      setTimeout(() => {
        for (const item of items) {
          const qty = parseInt(item.quantity);
          if (qty > 1) {
            updateQuantity(item.product_id, qty);
          }
        }
      }, 100);
      // Set customer if available
      if (saleData.customer_id && saleData.customer_id !== 1) {
        const custRes = await api.get(`/customers/${saleData.customer_id}`).catch(() => null);
        if (custRes?.data) setSelectedCustomer(custRes.data);
      }
      // Set tax/additional rates from sale
      if (saleData.tax_percent !== undefined) setTaxRate(parseFloat(saleData.tax_percent) || 0);
      if (saleData.additional_charges_percent !== undefined) setAdditionalRate(parseFloat(saleData.additional_charges_percent) || 0);
      setEditingSaleId(sale.sale_id);
      setEditingTokenNo(sale.token_no || null);
    } catch (err) {
      console.error('Failed to load edit order', err);
      alert('Failed to load order for editing');
    }
  };

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

  const handleForceReset = async () => {
    if (!confirm('Force-close any stuck open register? This is for Admin use only when a register is stuck.')) return;
    try {
      const res = await api.post('/register/force-reset');
      alert(res.data.message);
      checkRegister();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to force-reset register');
    }
  };

  // Fetch products with server-side pagination, search, and category filter
  const fetchProducts = useCallback(async (page = 1, search = '', category = 'All') => {
    if (!register) return;
    setLoading(true);
    try {
      const params: any = { page, limit: productLimit };
      if (search) params.search = search;
      if (category !== 'All') params.category = category;
      const res = await api.get('/products', { params });
      const rows = res.data.data || res.data;
      const mappedProducts = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
        stock_quantity: p.available_stock || p.stock_quantity || 0
      }));
      setProducts(mappedProducts);
      if (res.data.pagination) {
        setProductTotalPages(res.data.pagination.totalPages || 1);
        setProductTotalItems(res.data.pagination.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  }, [register, productLimit]);

  // Initial load: categories + customers + products
  useEffect(() => {
    if (!register) return;
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
    fetchProducts(1, '', 'All');
  }, [register]);

  // Re-fetch when page, category, or search changes (debounce search)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!register) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setProductPage(1);
      fetchProducts(1, searchName, selectedCategory);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchName, selectedCategory]);

  useEffect(() => {
    if (!register) return;
    fetchProducts(productPage, searchName, selectedCategory);
  }, [productPage]);

  // Barcode Auto-Add: search server-side for exact barcode match
  useEffect(() => {
    if (!searchBarcode) return;
    const findByBarcode = async () => {
      try {
        const res = await api.get('/products', { params: { search: searchBarcode, limit: 5 } });
        const rows: any[] = res.data.data || res.data;
        const match = rows.find((p: any) => p.barcode === searchBarcode);
        if (match) {
          const mapped = {
            ...match,
            price: typeof match.price === 'string' ? parseFloat(match.price) : match.price,
            stock_quantity: match.available_stock || match.stock_quantity || 0
          };
          if (mapped.stock_quantity > 0) {
            handleAddProduct(mapped);
          } else {
            alert('Product Out of Stock!');
          }
        }
      } catch (err) {
        console.error('Barcode search failed', err);
      } finally {
        setSearchBarcode('');
      }
    };
    findByBarcode();
  }, [searchBarcode]);

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
    return customers.filter((c: any) =>
      c.customer_name.toLowerCase().includes(q) ||
      (c.phone_number && c.phone_number.includes(customerSearch))
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const handleSaveEdit = async () => {
    if (!editingSaleId || cart.length === 0) return;
    try {
      await api.put(`/sales/${editingSaleId}/items`, {
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        total_amount: total,
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
        customer_id: selectedCustomer?.customer_id || 1,
      });
      clearCart();
      setEditingSaleId(null);
      setEditingTokenNo(null);
      const walkin = customers.find(c => c.customer_id === 1);
      setSelectedCustomer(walkin || null);
      alert('Order updated successfully');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save order');
    }
  };

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
        customer_id: selectedCustomer?.customer_id || 1,
        discount: 0,
        total_amount: total,
        payment_method: 'cash',
        amount_paid: 0,
        user_id: user?.user_id,
        status: 'pending',
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
      };

      const res = await api.post('/sales', payload);
      clearCart();
      const token = res.data?.token_no || null;
      setHoldToken(token);
      setTimeout(() => setHoldToken(null), 5000);
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

  // Client-side code search filter only (search/category handled server-side)
  const filteredProducts = searchCode
    ? products.filter(p => p.product_id.toString().includes(searchCode))
    : products;

  const expectedCash = register ? (
    parseFloat(register.opening_balance || 0) +
    parseFloat(register.cash_sales_total || 0) +
    parseFloat(register.total_cash_in || 0) -
    parseFloat(register.total_cash_out || 0)
  ) : 0;

  // Register loading screen
  if (registerLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 to-teal-50">
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
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center border border-emerald-100">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <DollarSign size={40} className="text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Open Register</h2>
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

          {(user?.role_name === 'Admin' || user?.role_name === 'Manager') && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Admin / Manager Tools</p>
              <button
                onClick={handleForceReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium text-sm transition-colors"
              >
                <Lock size={15} />
                Force Reset Stuck Register
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">Use this if a register is stuck as "open" after a crash</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
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
                <h1 className="text-xl font-semibold text-gray-900">Point of Sale</h1>
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-200"
            >
              <FileText size={20} />
              Orders
              <span className="text-xs bg-emerald-200 px-1.5 py-0.5 rounded">F5</span>
            </button>
            <button
              onClick={() => setIsDailyReportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-200"
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
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex flex-wrap gap-2 shadow-sm">
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
            <>
              <div className="grid grid-cols-4 gap-3">
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
              {/* Pagination */}
              <Pagination
                currentPage={productPage}
                totalPages={productTotalPages}
                onPageChange={setProductPage}
                totalItems={productTotalItems}
                itemsPerPage={productLimit}
                onItemsPerPageChange={(limit) => { setProductLimit(limit); setProductPage(1); }}
              />
            </>
          )}
        </div>
      </div>

      {/* ═══ Right Side: Cart Sidebar ═══ */}
      <div className="w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col h-full shadow-2xl">

        {/* ── Cart Header ── */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                {editingSaleId ? (
                  <span className="text-amber-400">
                    Editing Token #{editingTokenNo || editingSaleId}
                  </span>
                ) : 'Current Sale'}
              </h2>
              <p className="text-gray-400 text-xs">{cart.length === 0 ? 'No items' : `${cart.length} item${cart.length > 1 ? 's' : ''} · Rs. ${subtotal.toFixed(2)}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={() => { clearCart(); setEditingSaleId(null); setEditingTokenNo(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors"
                title="Clear Cart"
              >
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Editing Banner ── */}
        {editingSaleId && (
          <div className="bg-blue-600/20 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              <p className="text-blue-300 text-xs font-semibold">
                Editing Order {editingTokenNo ? `Token ${editingTokenNo}` : `#${editingSaleId}`} — Save or Complete below
              </p>
            </div>
            <button
              onClick={() => { clearCart(); setEditingSaleId(null); setEditingTokenNo(null); }}
              className="text-blue-400 hover:text-blue-200 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Customer Panel ── */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} />
              Customer
            </span>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus size={13} />
              Add New
            </button>
          </div>

          {/* Customer Search */}
          <div className="relative mb-2" ref={customerSearchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
              onFocus={() => { if (customerSearch.trim()) setShowCustomerDropdown(true); }}
            />
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-auto z-30">
                {filteredCustomers.map(c => (
                  <button
                    key={c.customer_id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
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

          {/* Selected Customer Card */}
          {selectedCustomer && (
            <div className={`rounded-xl overflow-hidden border ${selectedCustomer.customer_id === 1 ? 'border-gray-200 bg-gray-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${selectedCustomer.customer_id === 1 ? 'bg-gray-200 text-gray-600' : 'bg-emerald-500 text-white'}`}>
                    {selectedCustomer.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{selectedCustomer.customer_name}</p>
                    {selectedCustomer.company && (
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 size={10} />{selectedCustomer.company}</p>
                    )}
                    {selectedCustomer.customer_id !== 1 && selectedCustomer.phone_number && (
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{selectedCustomer.phone_number}</p>
                    )}
                  </div>
                </div>
                {selectedCustomer.customer_id !== 1 && (
                  <button
                    onClick={() => { const w = customers.find(c => c.customer_id === 1); setSelectedCustomer(w || null); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Reset to Walk-in"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {selectedCustomer.customer_id !== 1 && (selectedCustomer.email || selectedCustomer.tax_id) && (
                <div className="px-3 pb-2.5 flex flex-wrap gap-2">
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-1 bg-white/70 px-2 py-1 rounded text-xs text-gray-600">
                      <Mail size={10} className="text-emerald-500" />{selectedCustomer.email}
                    </div>
                  )}
                  {selectedCustomer.tax_id && (
                    <div className="flex items-center gap-1 bg-white/70 px-2 py-1 rounded text-xs text-gray-600">
                      <Tag size={10} className="text-orange-500" />Tax: {selectedCustomer.tax_id}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cart Items ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingCart size={36} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-base">Cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Scan a barcode or tap a product</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.product_id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden">
                {/* Item top row */}
                <div className="flex items-start gap-3 px-3 pt-3 pb-2">
                  {/* Serial number */}
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  {/* Name + variant */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm leading-tight truncate">{item.product_name}</h4>
                    {item.variant_name && (
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">{item.variant_name}</p>
                    )}
                  </div>
                  {/* Line total */}
                  <div className="text-right shrink-0">
                    <p className="font-black text-emerald-600 text-base">Rs. {(item.price * item.quantity).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">@ Rs. {item.price.toFixed(2)}</p>
                  </div>
                </div>

                {/* Item bottom row: qty controls + delete */}
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:text-gray-800 transition-colors font-bold"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleCartQtyChange(item.product_id, e.target.value)}
                      onBlur={(e) => handleCartQtyBlur(item.product_id, e.target.value)}
                      className="w-11 text-center text-sm font-black text-gray-800 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="1"
                    />
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:text-gray-800 transition-colors font-bold"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">× Rs. {item.price.toFixed(2)}</p>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Totals + Actions ── */}
        <div className="bg-white border-t-2 border-gray-200 flex-shrink-0">

          {/* Tax / Charges */}
          <div className="px-4 pt-3 pb-2 space-y-2 border-b border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-bold text-gray-700">Rs. {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Percent size={13} />
                <span>Tax</span>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-12 px-1.5 py-1 border border-gray-200 rounded-lg text-center text-xs font-bold bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  step="0.1"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
              <span className="font-semibold text-gray-600 text-sm">Rs. {taxAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Tag size={13} />
                <span>Charges</span>
                <input
                  type="number"
                  value={additionalRate}
                  onChange={(e) => setAdditionalRate(Number(e.target.value))}
                  className="w-12 px-1.5 py-1 border border-gray-200 rounded-lg text-center text-xs font-bold bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  step="0.1"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
              <span className="font-semibold text-gray-600 text-sm">Rs. {additionalAmount.toFixed(2)}</span>
            </div>

            {/* Bundle Discount */}
            {appliedBundles.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center justify-between text-sm font-bold text-green-700">
                  <span>🎁 Bundle Savings</span>
                  <span>- Rs. {bundleDiscount.toFixed(2)}</span>
                </div>
                {appliedBundles.map((bundle, idx) => (
                  <div key={idx} className="text-xs text-green-600 flex justify-between">
                    <span className="flex-1 truncate">{bundle.bundle_name}</span>
                    <span className="font-semibold ml-2">- Rs. {bundle.discount_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="px-4 py-3 bg-gray-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-gray-400" />
              <span className="text-gray-300 font-semibold text-sm">Grand Total</span>
            </div>
            <span className="text-2xl font-black text-emerald-400">Rs. {total.toFixed(2)}</span>
          </div>

          {/* Punch/Dispatch Token Banner */}
          {holdToken && (
            <div className="mx-3 mb-1 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Order Dispatched</p>
                <p className="text-xl font-black text-amber-700">Token: {holdToken}</p>
              </div>
              <button onClick={() => setHoldToken(null)} className="text-amber-400 hover:text-amber-600">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-3 space-y-2">
            {editingSaleId ? (
              /* Edit mode: Save Changes + Complete Order */
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Archive size={17} />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setSelectedPendingSale({ sale_id: editingSaleId, token_no: editingTokenNo, isCartEdit: true });
                    setIsCheckoutOpen(true);
                  }}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <DollarSign size={17} />
                  Complete
                  <span className="text-white/60 text-xs font-normal">F9</span>
                </button>
              </div>
            ) : (
              /* Normal mode: Punch/Dispatch + Pay Now */
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleHoldOrder}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Archive size={17} />
                  Punch/Dispatch
                  <span className="text-amber-200 text-xs font-normal">F8</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedPendingSale(null);
                    setIsCheckoutOpen(true);
                  }}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <DollarSign size={17} />
                  Pay Now
                  <span className="text-white/60 text-xs font-normal">F9</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
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
                { key: 'F8', desc: 'Punch/Dispatch order' },
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
          setEditingSaleId(null);
          setEditingTokenNo(null);
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