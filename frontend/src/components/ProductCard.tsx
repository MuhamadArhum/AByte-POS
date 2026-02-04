import React from 'react';
import { Product } from '../context/CartContext';
import { Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div 
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between h-full"
      onClick={() => onAddToCart(product)}
    >
      <div>
        <div className="h-32 bg-gray-50 rounded-lg mb-3 flex items-center justify-center text-emerald-600 text-2xl font-bold border border-gray-100">
          {product.product_name.charAt(0)}
        </div>
        <h3 className="font-semibold text-gray-800 line-clamp-2">{product.product_name}</h3>
        <p className="text-sm text-gray-500 mb-2">Stock: {product.stock_quantity}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-lg font-bold text-emerald-600">${product.price.toFixed(2)}</span>
        <button 
          className="bg-emerald-50 text-emerald-600 p-2 rounded-full hover:bg-emerald-100 transition-colors shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
