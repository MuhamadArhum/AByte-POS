import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface Product {
  product_id: number;
  product_name: string;
  price: number;
  stock_quantity: number;
  barcode: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  additionalRate: number;
  setAdditionalRate: (rate: number) => void;
  taxAmount: number;
  additionalAmount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [taxRate, setTaxRate] = useState(16); // Default 16%
  const [additionalRate, setAdditionalRate] = useState(5); // Default 5%

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert(`Cannot add more. Only ${product.stock_quantity} in stock.`);
          return prev;
        }
        return prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      if (product.stock_quantity <= 0) {
        alert('Product is out of stock!');
        return prev;
      }
      
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product_id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const additionalAmount = useMemo(() => subtotal * (additionalRate / 100), [subtotal, additionalRate]);
  const total = useMemo(() => subtotal + taxAmount + additionalAmount, [subtotal, taxAmount, additionalAmount]);

  const value = useMemo(() => ({
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    subtotal,
    taxRate,
    setTaxRate,
    additionalRate,
    setAdditionalRate,
    taxAmount,
    additionalAmount,
    total 
  }), [cart, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, taxRate, additionalRate, taxAmount, additionalAmount, total]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
