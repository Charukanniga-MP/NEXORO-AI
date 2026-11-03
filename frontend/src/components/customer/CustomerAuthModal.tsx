import React, { useState } from 'react';
import { X, Lock, Phone, Mail, User, MapPin, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login'
}) => {
  const { customerLogin, customerRegister } = useAuth();
  const [isRegister, setIsRegister] = useState(defaultMode === 'register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Chennai');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('600001');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isRegister) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        setLoading(false);
        return;
      }
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Mobile number must be exactly 10 digits (e.g. 9840123456).');
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError('Please enter a password.');
        setLoading(false);
        return;
      }

      try {
        const ok = await customerRegister({
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim() ? email.trim().toLowerCase() : undefined,
          password: password.trim(),
          address_line1: addressLine1.trim() || undefined,
          city,
          state,
          pincode,
          preferred_language: preferredLanguage
        });

        if (ok) {
          setRegisteredCode('Customer Registered');
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setError('Registration failed. This 10-digit mobile number or email might already be registered.');
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Registration failed. Please check your details.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } else {
      try {
        const rawIdent = (phone || email).trim();
        const digits = rawIdent.replace(/\D/g, '');
        const cleanIdent = digits.length === 10 ? digits : rawIdent;
        
        const ok = await customerLogin(cleanIdent, password);
        if (ok) {
          onClose();
        } else {
          setError('Invalid 10-digit mobile number/email or password. Please try again.');
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Login failed. Please verify credentials.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    }
    setLoading(false);
  };

  const handleDemoFill = (lang: string = 'en') => {
    if (lang === 'ta') {
      setPhone('9840123456');
      setPassword('customer');
      setName('Ananya Sharma');
      setEmail('ananya.sharma@example.com');
      setPreferredLanguage('ta');
    } else if (lang === 'te') {
      setPhone('9440187654');
      setPassword('customer');
      setName('Vikramaditya Reddy');
      setEmail('vikram.reddy@example.com');
      setPreferredLanguage('te');
    } else if (lang === 'hi') {
      setPhone('9810198765');
      setPassword('customer');
      setName('Rahul Sharma');
      setEmail('rahul.sharma@example.com');
      setPreferredLanguage('hi');
    } else {
      setPhone('9811154321');
      setPassword('customer');
      setName('Arjun Kapoor');
      setEmail('arjun.kapoor@example.com');
      setPreferredLanguage('en');
    }
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isRegister ? 'Create Customer Account' : 'Welcome to NEXORO Store'}
              </h3>
              <p className="text-[11px] text-blue-100 mt-0.5">
                {isRegister ? 'Enjoy autonomous AI voice updates in your language' : 'Sign in to access your orders and fast checkout'}
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          <button
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
            className={`flex-1 py-3 text-xs font-bold text-center cursor-pointer transition-colors ${
              !isRegister
                ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Customer Sign In
          </button>
          <button
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
            className={`flex-1 py-3 text-xs font-bold text-center cursor-pointer transition-colors ${
              isRegister
                ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            New Customer Registration
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {registeredCode && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Registration Successful! Generating your unique Customer ID...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {isRegister && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700">
                  {isRegister ? 'Mobile Number (10 Digits) *' : '10-Digit Mobile Number or Email *'}
                </label>
                {isRegister && (
                  <span className={`text-[10px] font-mono ${phone.length === 10 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                    {phone.length}/10 digits
                  </span>
                )}
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={isRegister ? 'tel' : 'text'}
                  required
                  maxLength={isRegister ? 10 : undefined}
                  pattern={isRegister ? '[0-9]{10}' : undefined}
                  placeholder={isRegister ? 'e.g. 9840123456' : 'Enter 10-digit mobile or email'}
                  value={phone}
                  onChange={(e) => {
                    if (isRegister) {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    } else {
                      setPhone(e.target.value);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Street, Building, Flat / House No."
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Preferred Language for AI Order Confirmation Calls *</span>
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="en">English (Indian English Voice)</option>
                    <option value="ta">Tamil (தமிழ் - Pallavi Voice)</option>
                    <option value="te">Telugu (తెలుగు - Shruti Voice)</option>
                    <option value="ml">Malayalam (മലയാളം - Sobhana Voice)</option>
                    <option value="hi">Hindi (हिन्दी - Swara Voice)</option>
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : isRegister ? 'Register & Generate Customer ID' : 'Sign In to Store'}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick 1-Click Demo Accounts (Password: customer)
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleDemoFill('ta')}
                className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-slate-700 text-left font-medium transition-colors cursor-pointer"
              >
                🇮🇳 Tamil: 9840123456
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('te')}
                className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-slate-700 text-left font-medium transition-colors cursor-pointer"
              >
                🇮🇳 Telugu: 9440187654
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('hi')}
                className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-slate-700 text-left font-medium transition-colors cursor-pointer"
              >
                🇮🇳 Hindi: 9810198765
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('en')}
                className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-slate-700 text-left font-medium transition-colors cursor-pointer"
              >
                🇬🇧 English: 9811154321
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
