import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiX } from 'react-icons/fi';
import InvoiceModal from './InvoiceModal';

export default function POSInterface() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const searchRef = useRef();

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  const loadProducts = async () => {
    try {
      const params = search ? { search } : {};
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      toast.error('Failed to load products');
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addToCart = (product) => {
    const stock = product.available_stock ?? product.stock_quantity;
    const existing = cart.find((item) => item.product_id === product.product_id);

    if (existing) {
      if (existing.quantity >= stock) {
        toast.warning('Not enough stock');
        return;
      }
      setCart(cart.map((item) =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (stock <= 0) {
        toast.warning('Product out of stock');
        return;
      }
      setCart([...cart, {
        product_id: product.product_id,
        product_name: product.product_name,
        unit_price: parseFloat(product.price),
        quantity: 1,
        max_stock: stock,
      }]);
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map((item) => {
      if (item.product_id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.max_stock) {
        toast.warning('Not enough stock');
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const discountAmount = discountType === 'percentage'
    ? (subtotal * Math.min(parseFloat(discountValue) || 0, 100)) / 100
    : Math.min(parseFloat(discountValue) || 0, subtotal);

  const grandTotal = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.post('/sales', {
        items: cart.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
        discount: discountAmount,
        customer_id: selectedCustomer,
      });

      setInvoice(res.data.sale);
      setCart([]);
      setDiscountValue(0);
      setSelectedCustomer(1);
      loadProducts();
      toast.success('Sale completed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="pos-layout">
      {/* Left Panel - Product Search */}
      <div className="pos-products">
        <div className="pos-search">
          <FiSearch />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="product-grid">
          {products.map((p) => {
            const stock = p.available_stock ?? p.stock_quantity;
            return (
              <div
                key={p.product_id}
                className={`product-card ${stock <= 0 ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div className="product-card-name">{p.product_name}</div>
                <div className="product-card-price">Rs. {Number(p.price).toLocaleString()}</div>
                <div className={`product-card-stock ${stock < 10 ? 'low' : ''}`}>
                  Stock: {stock}
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="no-results">No products found</div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="pos-cart">
        <div className="cart-header">
          <h2>Current Sale</h2>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="customer-select"
          >
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
            ))}
          </select>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">No items in cart</div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="cart-item">
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.product_name}</span>
                  <span className="cart-item-price">Rs. {item.unit_price.toLocaleString()} each</span>
                </div>
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, -1)}>
                    <FiMinus />
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, 1)}>
                    <FiPlus />
                  </button>
                </div>
                <div className="cart-item-total">
                  Rs. {(item.unit_price * item.quantity).toLocaleString()}
                </div>
                <button className="btn-icon danger" onClick={() => removeFromCart(item.product_id)}>
                  <FiTrash2 />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="discount-section">
            <div className="discount-controls">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="percentage">% Discount</option>
                <option value="flat">Flat Discount</option>
              </select>
              <input
                type="number"
                min="0"
                max={discountType === 'percentage' ? 100 : subtotal}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
              />
            </div>
            {discountAmount > 0 && (
              <div className="summary-row discount">
                <span>Discount:</span>
                <span>- Rs. {discountAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="summary-row grand-total">
            <span>Grand Total:</span>
            <span>Rs. {grandTotal.toLocaleString()}</span>
          </div>

          <button
            className="btn btn-primary btn-checkout"
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
          >
            {processing ? 'Processing...' : `Checkout - Rs. ${grandTotal.toLocaleString()}`}
          </button>
        </div>
      </div>

      {invoice && (
        <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />
      )}
    </div>
  );
}
