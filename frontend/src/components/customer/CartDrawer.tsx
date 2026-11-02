import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  Check, 
  Truck, 
  ShieldCheck 
} from 'lucide-react';
import { api, CartData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartData | null;
  onUpdateCart: (cart: CartData) => void;
  onOpenCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateCart,
  onOpenCheckout
}) => {
  const { setCartCount } = useAuth();
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpdateQuantity = async (productId: string, newQty: number) => {
    try {
      setLoading(true);
      const res = await api.updateCartItem(productId, newQty);
      onUpdateCart(res.data);
      setCartCount(res.data.items_count);
    } catch (e) {
      console.error("Failed to update cart item", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      setLoading(true);
      const res = await api.removeFromCart(productId);
      onUpdateCart(res.data);
      setCartCount(res.data.items_count);
    } catch (e) {
      console.error("Failed to remove cart item", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponError('');
    try {
      const res = await api.applyCoupon(couponInput.trim().toUpperCase());
      onUpdateCart(res.data);
      setCouponInput('');
    } catch (err: any) {
      setCouponError(err.response?.data?.detail || 'Invalid coupon code. Try WELCOME10 or KHAIRA50');
    }
  };

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const deliveryCharge = cart?.delivery_charge || 0;
  const discount = cart?.discount || 0;
  const finalAmount = cart?.final_amount || 0;
  const freeShippingThreshold = 499;
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Your Shopping Cart</h3>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-black px-2 py-0.5 rounded-full">
              {cart?.items_count || 0} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Meter */}
        <div className="bg-blue-50/80 px-4 py-2.5 border-b border-blue-100 text-xs">
          {amountToFreeShipping > 0 ? (
            <div>
              <p className="text-blue-900 font-medium">
                Add <span className="font-bold text-blue-700">₹{amountToFreeShipping.toFixed(0)}</span> more to qualify for <span className="font-bold">FREE Express Delivery</span>!
              </p>
              <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-emerald-700 font-bold flex items-center space-x-1">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Congratulations! Your order qualifies for FREE Express Delivery.</span>
            </p>
          )}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-bold text-slate-700 text-sm">Your cart is empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Explore our catalog of certified products across all 16 categories!
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product_id} className="pt-3 flex space-x-3 items-center">
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                  <p className="text-xs font-extrabold text-blue-700 mt-1">₹{item.price.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-end space-y-1.5 shrink-0">
                  <button
                    onClick={() => handleRemoveItem(item.product_id)}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center space-x-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                      className="p-1 hover:bg-white rounded-md text-slate-600 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold px-1.5 text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                      className="p-1 hover:bg-white rounded-md text-slate-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Calculations */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Coupon Code Section */}
            <div>
              <form onSubmit={handleApplyCoupon} className="flex space-x-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Coupon: WELCOME10, KHAIRA50"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium uppercase placeholder:normal-case focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Apply
                </button>
              </form>
              <div className="mt-1.5 flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-500 font-bold">Festive Offer:</span>
                <button
                  type="button"
                  onClick={() => setCouponInput('DIWALI2026')}
                  className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-black cursor-pointer flex items-center space-x-1 transition-colors"
                >
                  <span>🪔</span>
                  <span>DIWALI2026 (25% OFF)</span>
                </button>
              </div>
              {couponError && <p className="text-[11px] text-rose-600 mt-1">{couponError}</p>}
              {cart?.coupon_code && (
                <div className="mt-1 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                  <span>Coupon <strong>{cart.coupon_code}</strong> Applied!</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Charges</span>
                <span className="font-semibold text-slate-900">
                  {deliveryCharge === 0 ? <span className="text-emerald-600 uppercase font-bold">Free</span> : `₹${deliveryCharge.toFixed(2)}`}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Promotional Discount</span>
                  <span className="font-bold">-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-blue-700 text-base">₹{finalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Trust badge */}
            <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Secure Checkout • Post-Order AI Voice Confirmation</span>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={() => {
                onClose();
                onOpenCheckout();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

