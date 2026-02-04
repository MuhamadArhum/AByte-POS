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
        <div className="relative h-32 bg-gray-50 rounded-lg mb-3 flex items-center justify-center text-emerald-600 text-2xl font-bold border border-gray-100">
          {product.product_name.charAt(0)}
          {product.stock_quantity <= 10 && product.stock_quantity > 0 && (
            <span className="absolute top-2 right-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold border border-orange-200">
              Low Stock
            </span>
          )}
          {product.stock_quantity === 0 && (
            <span className="absolute top-2 right-2 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold border border-red-200">
              Out of Stock
            </span>
          )}
        </div>
        <h3 className="font-semibold text-gray-800 line-clamp-2">{product.product_name}</h3>
        <p className={`text-sm mb-2 ${product.stock_quantity === 0 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
          Stock: {product.stock_quantity}
        </p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-lg font-bold text-emerald-600">${product.price.toFixed(2)}</span>
        <button 
          className={`p-2 rounded-full transition-colors shadow-sm ${
            product.stock_quantity === 0 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (product.stock_quantity > 0) {
              onAddToCart(product);
            }
          }}
          disabled={product.stock_quantity === 0}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
