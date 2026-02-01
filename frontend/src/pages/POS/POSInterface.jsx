/**
 * ==========================================================================
 * POSInterface.jsx - Point of Sale Billing Interface
 * ==========================================================================
 *
 * This is the main POS (Point of Sale) screen used by cashiers to process
 * customer transactions. The layout is split into two panels:
 *
 *   LEFT PANEL  - A searchable product grid. The cashier can search products
 *                 by name or barcode, then click a product card to add it
 *                 to the cart. Out-of-stock items are visually dimmed.
 *
 *   RIGHT PANEL - The cart / current sale. Shows all items added, with
 *                 +/- buttons to adjust quantities and a trash icon to
 *                 remove items. Below the item list is the summary section
 *                 with subtotal, discount controls (percentage or flat),
 *                 grand total, and a checkout button.
 *
 * Flow:
 *   1. Cashier searches/browses products and clicks to add them to cart.
 *   2. Cashier adjusts quantities, selects a customer, and optionally
 *      applies a discount.
 *   3. Cashier clicks "Checkout" which POSTs the sale to the backend.
 *   4. On success, an InvoiceModal is shown with the sale receipt.
 *   5. The cart resets and product stock counts are refreshed.
 *
 * Dependencies:
 *   - api service (axios instance) for HTTP requests to the backend
 *   - react-toastify for user-facing success/warning/error notifications
 *   - react-icons/fi for Feather icons (search, plus, minus, trash, close)
 *   - InvoiceModal component for displaying the post-checkout invoice
 * ==========================================================================
 */

import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiX } from 'react-icons/fi';
import InvoiceModal from './InvoiceModal';

export default function POSInterface() {
  // ---------------------------------------------------------------------------
  // State Variables
  // ---------------------------------------------------------------------------

  /** All products fetched from the backend (filtered by search term if any) */
  const [products, setProducts] = useState([]);

  /** The current value of the product search input (name or barcode) */
  const [search, setSearch] = useState('');

  /**
   * The shopping cart array. Each item has the shape:
   * {
   *   product_id:   number  - unique product identifier
   *   product_name: string  - display name
   *   unit_price:   number  - price per single unit
   *   quantity:     number  - how many units the cashier wants to sell
   *   max_stock:    number  - maximum available stock (used to cap quantity)
   * }
   */
  const [cart, setCart] = useState([]);

  /**
   * The type of discount being applied.
   * - 'percentage' : discount is a % of the subtotal (0-100)
   * - 'flat'       : discount is a fixed currency amount (0 - subtotal)
   */
  const [discountType, setDiscountType] = useState('percentage');

  /** The raw numeric value entered for the discount (before calculation) */
  const [discountValue, setDiscountValue] = useState(0);

  /** List of all customers fetched from the backend, used in the customer dropdown */
  const [customers, setCustomers] = useState([]);

  /**
   * The currently selected customer ID for this sale.
   * Defaults to 1 which is typically the "Walk-in Customer" or default customer.
   */
  const [selectedCustomer, setSelectedCustomer] = useState(1);

  /** Flag to indicate a checkout API call is in progress (disables the button) */
  const [processing, setProcessing] = useState(false);

  /**
   * Holds the invoice/sale data returned by the backend after a successful
   * checkout. When non-null, the InvoiceModal is displayed. Set back to
   * null when the modal is closed.
   */
  const [invoice, setInvoice] = useState(null);

  /** Ref to the search input element, used to set autoFocus */
  const searchRef = useRef();

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /**
   * Initial data load on component mount.
   * Fetches the full product list and the customer list once when the
   * POS screen first renders.
   */
  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  /**
   * Debounced product search effect.
   * Whenever the `search` state changes (i.e., the cashier types in the
   * search box), this effect waits 300ms before firing the API call.
   * This prevents hammering the backend with a request on every keystroke.
   * The cleanup function clears the pending timer if `search` changes again
   * before the 300ms elapses.
   */
  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Data Fetching Functions
  // ---------------------------------------------------------------------------

  /**
   * loadProducts
   * Fetches products from the backend API. If a search term is present,
   * it is sent as a query parameter so the backend can filter by name
   * or barcode. The result replaces the current `products` state.
   */
  const loadProducts = async () => {
    try {
      // Only include the search param if the user has typed something
      const params = search ? { search } : {};
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      toast.error('Failed to load products');
    }
  };

  /**
   * loadCustomers
   * Fetches the full list of customers from the backend to populate the
   * customer dropdown selector. Errors are silently ignored because the
   * POS can still function with the default customer.
   */
  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      // Silent failure - customer selection is optional; default customer
      // (ID 1) will be used if the list fails to load.
    }
  };

  // ---------------------------------------------------------------------------
  // Cart Management Functions
  // ---------------------------------------------------------------------------

  /**
   * addToCart
   * Adds a product to the cart or increments its quantity if already present.
   *
   * Logic:
   * - Determines available stock using `available_stock` (preferred) or
   *   `stock_quantity` as a fallback (the `??` nullish coalescing operator
   *   handles cases where available_stock might not be returned by the API).
   * - If the product is already in the cart, checks whether incrementing
   *   the quantity would exceed stock. If so, shows a warning.
   * - If the product is not in the cart, checks stock > 0 before adding.
   *
   * @param {Object} product - The product object from the products array
   */
  const addToCart = (product) => {
    // Use available_stock if present, otherwise fall back to stock_quantity
    const stock = product.available_stock ?? product.stock_quantity;

    // Check if this product is already in the cart
    const existing = cart.find((item) => item.product_id === product.product_id);

    if (existing) {
      // Product already in cart - try to increment quantity by 1
      if (existing.quantity >= stock) {
        toast.warning('Not enough stock');
        return;
      }
      // Map over cart items and increment the matching product's quantity
      setCart(cart.map((item) =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // New product - add to cart with quantity of 1
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

  /**
   * updateQuantity
   * Adjusts the quantity of a cart item by `delta` (+1 or -1).
   *
   * Guards:
   * - Prevents quantity from going below 1 (use removeFromCart to delete).
   * - Prevents quantity from exceeding max_stock.
   *
   * @param {number} productId - The product_id of the cart item to update
   * @param {number} delta     - The change in quantity (+1 to increase, -1 to decrease)
   */
  const updateQuantity = (productId, delta) => {
    setCart(cart.map((item) => {
      if (item.product_id !== productId) return item;
      const newQty = item.quantity + delta;
      // Don't allow quantity to drop to zero or below
      if (newQty <= 0) return item;
      // Don't allow quantity to exceed available stock
      if (newQty > item.max_stock) {
        toast.warning('Not enough stock');
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  /**
   * removeFromCart
   * Completely removes a product from the cart by filtering it out.
   *
   * @param {number} productId - The product_id of the item to remove
   */
  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  // ---------------------------------------------------------------------------
  // Calculated Values (derived from state on every render)
  // ---------------------------------------------------------------------------

  /**
   * subtotal
   * The total price of all items in the cart before any discount.
   * Calculated by summing (unit_price * quantity) for every cart item.
   */
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  /**
   * discountAmount
   * The actual currency amount to subtract from the subtotal.
   *
   * For percentage discount:
   *   - Clamps the percentage between 0 and 100
   *   - Calculates (subtotal * percentage / 100)
   *
   * For flat discount:
   *   - Clamps the value so it cannot exceed the subtotal
   *     (you can't discount more than the total)
   *
   * The `parseFloat(...) || 0` handles empty/invalid input gracefully,
   * defaulting to 0 discount.
   */
  const discountAmount = discountType === 'percentage'
    ? (subtotal * Math.min(parseFloat(discountValue) || 0, 100)) / 100
    : Math.min(parseFloat(discountValue) || 0, subtotal);

  /**
   * grandTotal
   * The final amount the customer owes: subtotal minus the discount.
   */
  const grandTotal = subtotal - discountAmount;

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  /**
   * handleCheckout
   * Processes the sale by sending the cart data to the backend.
   *
   * Steps:
   * 1. Validates that the cart is not empty.
   * 2. Sets `processing` to true to disable the checkout button and show
   *    a "Processing..." label (prevents double-clicks).
   * 3. POSTs the sale payload to /sales with:
   *    - items: array of { product_id, quantity, unit_price }
   *    - discount: the calculated discount amount in currency
   *    - customer_id: the selected customer
   * 4. On success:
   *    - Stores the returned sale object in `invoice` to trigger the modal.
   *    - Resets the cart, discount, and customer selection.
   *    - Reloads products to get updated stock counts.
   *    - Shows a success toast.
   * 5. On failure: shows an error toast with the backend message or a fallback.
   * 6. Always resets `processing` to false in the `finally` block.
   */
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.post('/sales', {
        // Strip cart items down to only the fields the backend needs
        items: cart.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
        discount: discountAmount,
        customer_id: selectedCustomer,
      });

      // Store the sale data to display in the invoice modal
      setInvoice(res.data.sale);

      // Reset the POS for the next transaction
      setCart([]);
      setDiscountValue(0);
      setSelectedCustomer(1);

      // Refresh product list to reflect updated stock levels
      loadProducts();

      toast.success('Sale completed!');
    } catch (err) {
      // Use the backend error message if available, otherwise show generic message
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      // Always re-enable the checkout button
      setProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // JSX Rendering
  // ---------------------------------------------------------------------------

  return (
    <div className="pos-layout">

      {/* ===================================================================
          LEFT PANEL - Product Search & Grid
          ===================================================================
          Contains a search bar at the top and a grid of clickable product
          cards below. Clicking a card adds that product to the cart.
      */}
      <div className="pos-products">

        {/* Search bar with icon and text input */}
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

        {/* Product grid - each card shows name, price, and stock level */}
        <div className="product-grid">
          {products.map((p) => {
            // Determine available stock (same logic as addToCart)
            const stock = p.available_stock ?? p.stock_quantity;
            return (
              <div
                key={p.product_id}
                /* Apply 'out-of-stock' class when stock is zero for visual dimming */
                className={`product-card ${stock <= 0 ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div className="product-card-name">{p.product_name}</div>
                <div className="product-card-price">Rs. {Number(p.price).toLocaleString()}</div>
                {/* Highlight stock count in a different color when below 10 units */}
                <div className={`product-card-stock ${stock < 10 ? 'low' : ''}`}>
                  Stock: {stock}
                </div>
              </div>
            );
          })}

          {/* Empty state when no products match the search */}
          {products.length === 0 && (
            <div className="no-results">No products found</div>
          )}
        </div>
      </div>

      {/* ===================================================================
          RIGHT PANEL - Cart / Current Sale
          ===================================================================
          Displays the cart header with customer selector, the list of cart
          items with quantity controls, and the summary section with discount
          controls, totals, and the checkout button.
      */}
      <div className="pos-cart">

        {/* --- Cart Header: Title and Customer Dropdown --- */}
        <div className="cart-header">
          <h2>Current Sale</h2>
          {/* Customer selector dropdown - populated from the customers API */}
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

        {/* --- Cart Items List --- */}
        <div className="cart-items">
          {cart.length === 0 ? (
            /* Empty cart placeholder */
            <div className="cart-empty">No items in cart</div>
          ) : (
            /* Render each cart item with name, unit price, quantity controls,
               line total, and a remove button */
            cart.map((item) => (
              <div key={item.product_id} className="cart-item">
                {/* Product name and per-unit price */}
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.product_name}</span>
                  <span className="cart-item-price">Rs. {item.unit_price.toLocaleString()} each</span>
                </div>

                {/* Quantity adjustment: minus button, current qty, plus button */}
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, -1)}>
                    <FiMinus />
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, 1)}>
                    <FiPlus />
                  </button>
                </div>

                {/* Line total for this item (unit_price * quantity) */}
                <div className="cart-item-total">
                  Rs. {(item.unit_price * item.quantity).toLocaleString()}
                </div>

                {/* Remove item from cart entirely */}
                <button className="btn-icon danger" onClick={() => removeFromCart(item.product_id)}>
                  <FiTrash2 />
                </button>
              </div>
            ))
          )}
        </div>

        {/* --- Cart Summary: Subtotal, Discount, Grand Total, Checkout --- */}
        <div className="cart-summary">

          {/* Subtotal row - sum of all line totals before discount */}
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>

          {/* Discount controls section */}
          <div className="discount-section">
            <div className="discount-controls">
              {/* Toggle between percentage and flat discount */}
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="percentage">% Discount</option>
                <option value="flat">Flat Discount</option>
              </select>
              {/* Discount value input - max is 100 for percentage, subtotal for flat */}
              <input
                type="number"
                min="0"
                max={discountType === 'percentage' ? 100 : subtotal}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Only show the discount row when a discount is actually applied */}
            {discountAmount > 0 && (
              <div className="summary-row discount">
                <span>Discount:</span>
                <span>- Rs. {discountAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Grand total row - subtotal minus discount */}
          <div className="summary-row grand-total">
            <span>Grand Total:</span>
            <span>Rs. {grandTotal.toLocaleString()}</span>
          </div>

          {/* Checkout button - disabled when cart is empty or processing */}
          <button
            className="btn btn-primary btn-checkout"
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
          >
            {processing ? 'Processing...' : `Checkout - Rs. ${grandTotal.toLocaleString()}`}
          </button>
        </div>
      </div>

      {/* ===================================================================
          Invoice Modal (conditional render)
          ===================================================================
          Shown only after a successful checkout. Displays the sale receipt.
          Closing the modal sets `invoice` back to null, hiding the modal.
      */}
      {invoice && (
        <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />
      )}
    </div>
  );
}
