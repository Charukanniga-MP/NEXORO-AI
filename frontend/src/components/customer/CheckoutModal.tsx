import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  CreditCard, 
  QrCode, 
  Building2, 
  Banknote, 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { api, CartData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartData | null;
  onOrderSuccess: (orderData: any, aiCallData: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  onOrderSuccess
}) => {
  const { customer, setCartCount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shipping Form State
  const [shippingAddress, setShippingAddress] = useState(customer?.address_line1 || '12 Anna Salai, T. Nagar');
  const [city, setCity] = useState(customer?.city || 'Chennai');
  const [state, setState] = useState(customer?.state || 'Tamil Nadu');
  const [pincode, setPincode] = useState(customer?.pincode || '600017');
  const [preferredLanguage, setPreferredLanguage] = useState(customer?.preferred_language || 'en');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'DEBIT_CARD' | 'NET_BANKING' | 'CASH_ON_DELIVERY'>('UPI');
  const [upiId, setUpiId] = useState('customer@okaxis');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  if (!isOpen) return null;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress || !pincode) {
      setError('Please provide a complete shipping address and PIN code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Checkout Cart into official Order (generates ORD-2026-...)
      const checkoutRes = await api.checkoutCart({
        shipping_address: shippingAddress,
        city,
        state,
        pincode,
        payment_method: paymentMethod,
        preferred_language: preferredLanguage,
        delivery_notes: deliveryNotes || undefined
      });

      const { order, ai_call } = checkoutRes.data;
      setCartCount(0);

      // 2. If online payment, execute verification step
      if (paymentMethod !== 'CASH_ON_DELIVERY') {
        const verifyRes = await api.verifyPayment({
          order_id: order.id,
          payment_method: paymentMethod,
          gateway_payment_id: `pay_kh_${Date.now()}`
        });

        onOrderSuccess(order, verifyRes.data.ai_call);
      } else {
        onOrderSuccess(order, ai_call);
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const finalAmount = cart?.final_amount || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Secure Checkout</h3>
              <p className="text-[11px] text-blue-100">
                Encrypted Transaction • Automated Multilingual Voice Confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handlePlaceOrder} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Section 1: Delivery Address */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>1. Delivery & Contact Details</span>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Street Address / House No. *</label>
              <input
                type="text"
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Building name, flat number, street"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">PIN Code *</label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: AI Voice Calling Preference */}
          <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-950 font-bold text-xs">
                <PhoneCall className="w-4 h-4 text-blue-600 animate-pulse" />
                <span>2. AI Voice Order Confirmation Call</span>
              </div>
              <span className="bg-blue-200/70 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                AUTOMATIC POST-ORDER
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Our AI Assistant will call your registered phone immediately after order placement to confirm items, quantities, and delivery schedule.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <Globe className="w-4 h-4 text-blue-600 shrink-0" />
              <label className="text-slate-700 font-semibold shrink-0">Call Language:</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English (Indian Accent - Neerja)</option>
                <option value="ta">Tamil (தமிழ் - Pallavi)</option>
                <option value="te">Telugu (తెలుగు - Shruti)</option>
                <option value="ml">Malayalam (മലയാളം - Sobhana)</option>
                <option value="hi">Hindi (हिन्दी - Swara)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Payment Options (India Focus) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>3. Select Payment Method</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <p className="font-bold text-xs">UPI</p>
                <p className="text-[10px] text-slate-400">GPay, PhonePe</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('DEBIT_CARD')}
                className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  paymentMethod === 'DEBIT_CARD'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                <p className="font-bold text-xs">Cards</p>
                <p className="text-[10px] text-slate-400">Debit / Credit</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('NET_BANKING')}
                className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  paymentMethod === 'NET_BANKING'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-5 h-5 mx-auto mb-1 text-sky-600" />
                <p className="font-bold text-xs">Net Banking</p>
                <p className="text-[10px] text-slate-400">All Indian Banks</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                <p className="font-bold text-xs">Cash on Delivery</p>
                <p className="text-[10px] text-slate-400">Pay at Doorstep</p>
              </button>
            </div>

            {/* Payment sub-details */}
            {paymentMethod === 'UPI' && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 shrink-0">
                  <QrCode className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Enter UPI ID / VPA</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="mobile@upi / username@okhdfcbank"
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'DEBIT_CARD' && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <input
                  type="text"
                  placeholder="Card Number (4532 •••• •••• 8821)"
                  defaultValue="4532 9912 4432 8821"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    defaultValue="08/28"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-center"
                  />
                  <input
                    type="password"
                    placeholder="CVV"
                    defaultValue="382"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-center"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  PCI-DSS Compliant • Raw card data is never stored on our servers.
                </p>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <p className="text-[11px] text-slate-500">Payable Amount:</p>
              <p className="text-xl font-black text-slate-900">₹{finalAmount.toFixed(2)}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-50 transition-all text-xs"
            >
              {loading ? 'Processing Order...' : `Pay ₹${finalAmount.toFixed(2)} & Confirm Order`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

