import React, { useState } from 'react';
import { Lock, Mail, User, Phone, ArrowRight, ShieldCheck, Sparkles, Headphones, UserCheck, ShieldAlert, ShoppingBag, UserPlus, LogIn, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

interface AuthViewProps {
  initialRole?: 'CUSTOMER' | 'AGENT' | 'ADMIN';
}

export const AuthView: React.FC<AuthViewProps> = ({ initialRole }) => {
  const { login, register, customerPortalRegister, customerPortalLogin, setPortalMode, portalMode } = useAuth();
  const [roleMode, setRoleMode] = useState<'CUSTOMER' | 'AGENT' | 'ADMIN'>(
    initialRole || (portalMode === 'admin' ? 'ADMIN' : 'CUSTOMER')
  );
  
  // Customer sub-tab: 'login' vs 'register'
  const [customerSubMode, setCustomerSubMode] = useState<'login' | 'register'>('login');

  // Customer Registration fields (Name, Gmail, 10-digit Mobile Number, Password)
  const [custRegName, setCustRegName] = useState<string>('');
  const [custRegEmail, setCustRegEmail] = useState<string>('');
  const [custRegPhone, setCustRegPhone] = useState<string>('');
  const [custRegPassword, setCustRegPassword] = useState<string>('');

  // Customer Sign-in fields (10-digit Phone or Email, Password)
  const [custLoginIdent, setCustLoginIdent] = useState<string>('9876543210');
  const [custLoginPassword, setCustLoginPassword] = useState<string>('customer');

  // Staff credentials (AI Agent & Admin)
  const [email, setEmail] = useState<string>(initialRole === 'ADMIN' || portalMode === 'admin' ? 'admin' : 'agent');
  const [password, setPassword] = useState<string>(initialRole === 'ADMIN' || portalMode === 'admin' ? 'Admin@123' : 'Agent@123');
  const [isStaffRegister, setIsStaffRegister] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [staffPhone, setStaffPhone] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const handleRoleChange = (newRole: 'CUSTOMER' | 'AGENT' | 'ADMIN') => {
    setRoleMode(newRole);
    setError('');
    setSuccessMsg('');
    setIsStaffRegister(false);
    if (newRole === 'CUSTOMER') {
      setCustomerSubMode('login');
      setCustLoginIdent('9876543210');
      setCustLoginPassword('customer');
    } else if (newRole === 'AGENT') {
      setEmail('agent');
      setPassword('Agent@123');
    } else {
      setEmail('admin');
      setPassword('Admin@123');
    }
  };

  const handleCustomerPhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
    setCustRegPhone(digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (roleMode === 'CUSTOMER') {
        if (customerSubMode === 'register') {
          // 1. Validation for New Customer Registration
          if (!custRegName.trim()) {
            setError('Please enter your full name.');
            setLoading(false);
            return;
          }
          if (!custRegEmail.trim() || !custRegEmail.includes('@')) {
            setError('Please enter a valid Gmail or email address.');
            setLoading(false);
            return;
          }
          const cleanPhone = custRegPhone.replace(/\D/g, '');
          if (cleanPhone.length !== 10) {
            setError('Mobile number must be exactly 10 digits (e.g. 9876543210).');
            setLoading(false);
            return;
          }
          if (!custRegPassword.trim()) {
            setError('Please create a password for your customer account.');
            setLoading(false);
            return;
          }

          const res = await customerPortalRegister({
            name: custRegName.trim(),
            email: custRegEmail.trim(),
            phone: cleanPhone,
            password: custRegPassword.trim()
          });

          if (!res.success) {
            setError(res.message || 'Registration failed. This mobile number or email might already be registered.');
          } else {
            setSuccessMsg('Account created successfully! Entering Customer Dashboard...');
          }
        } else {
          // 2. Customer Sign-in
          if (!custLoginIdent.trim()) {
            setError('Please enter your 10-digit mobile number or Gmail/email address.');
            setLoading(false);
            return;
          }
          if (!custLoginPassword.trim()) {
            setError('Please enter your password.');
            setLoading(false);
            return;
          }

          const res = await customerPortalLogin(custLoginIdent.trim(), custLoginPassword.trim());
          if (!res.success) {
            setError(res.message || 'Invalid 10-digit mobile number/email or password.');
          }
        }
      } else {
        // Staff Login (AI Agent or Company Admin)
        if (isStaffRegister) {
          const ok = await register({
            email: email.trim().toLowerCase(),
            password,
            full_name: fullName || (roleMode === 'ADMIN' ? 'Enterprise Administrator' : 'Sarah Chen (AI Voice Specialist)'),
            phone: staffPhone || undefined,
            department: roleMode === 'ADMIN' ? 'Management & IT' : 'Customer Voice Reception',
            role: roleMode
          });
          if (!ok) {
            setError('Staff registration failed. Email may already be registered.');
          }
        } else {
          const ok = await login(email.trim(), password);
          if (!ok) {
            setError(`Invalid credentials for ${roleMode === 'AGENT' ? 'AI Agent' : 'Admin'}. Please verify email and password.`);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please check your credentials or network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Company Header Branding */}
        <div className="flex justify-center mb-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs inline-flex items-center justify-center">
            <img
              src="/kaira-logo.png"
              alt="KAIRA Technologies"
              className="h-12 w-auto max-w-[220px] object-contain drop-shadow-xs"
            />
          </div>
        </div>

        <div className="flex justify-center mb-2">
          <NexoraAvatar size="md" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          NEXORA AI
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Intelligent Multilingual AI Receptionist & Enterprise Communication Platform
        </p>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-6 shadow-sm border border-slate-200/90 rounded-2xl sm:px-8">
          {/* Three Separate Role Navigation Tabs */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Select Portal / Experience
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleRoleChange('CUSTOMER')}
                className={`py-2 px-1.5 rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                  roleMode === 'CUSTOMER'
                    ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span className="text-[11px] truncate">Customer</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('AGENT')}
                className={`py-2 px-1.5 rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                  roleMode === 'AGENT'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Headphones className="w-4 h-4" />
                <span className="text-[11px] truncate">AI Agent</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('ADMIN')}
                className={`py-2 px-1.5 rounded-lg flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                  roleMode === 'ADMIN'
                    ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[11px] truncate">Admin</span>
              </button>
            </div>
          </div>

          {/* Mode Subtitle Description */}
          <div className="mb-4 p-2.5 rounded-xl text-xs flex items-center justify-between border bg-slate-50 border-slate-200/70">
            <div>
              <p className="font-bold text-slate-800">
                {roleMode === 'CUSTOMER' && 'Customer Self-Service Voice Portal'}
                {roleMode === 'AGENT' && 'AI Agent Telephony & Receptionist Console'}
                {roleMode === 'ADMIN' && 'Company Owner & Executive Dashboard'}
              </p>
              <p className="text-[11px] text-slate-500">
                {roleMode === 'CUSTOMER' && 'Speak live with AI, track orders, book demo appointments'}
                {roleMode === 'AGENT' && 'Handle real-time incoming call requests, transcripts & handoffs'}
                {roleMode === 'ADMIN' && 'Manage KPIs, RAG knowledge base, inventory & SIP settings'}
              </p>
            </div>
          </div>

          {/* Customer Sub-Mode Pill: Sign In vs Create Account */}
          {roleMode === 'CUSTOMER' && (
            <div className="mb-4 grid grid-cols-2 gap-1 p-1 bg-blue-50/70 border border-blue-100 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  setCustomerSubMode('login');
                  setError('');
                }}
                className={`py-1.5 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  customerSubMode === 'login'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Customer Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerSubMode('register');
                  setError('');
                }}
                className={`py-1.5 rounded-lg font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  customerSubMode === 'register'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create New Account</span>
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* 1A. CUSTOMER: NEW REGISTRATION */}
            {roleMode === 'CUSTOMER' && customerSubMode === 'register' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ananya Sharma"
                      value={custRegName}
                      onChange={(e) => setCustRegName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gmail / Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. ananya.sharma@gmail.com"
                      value={custRegEmail}
                      onChange={(e) => setCustRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Mobile Number (10 Digits) <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[10px] font-mono ${custRegPhone.length === 10 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      {custRegPhone.length}/10 digits
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="e.g. 9840123456"
                      value={custRegPhone}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-mono tracking-wider"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Strictly 10 digits required without country code</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Create Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="Create a secure password"
                      value={custRegPassword}
                      onChange={(e) => setCustRegPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 1B. CUSTOMER: SIGN IN */}
            {roleMode === 'CUSTOMER' && customerSubMode === 'login' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    10-Digit Mobile Number or Gmail / Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210 or john.miller@example.com"
                      value={custLoginIdent}
                      onChange={(e) => setCustLoginIdent(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Use your registered 10-digit phone number or email</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={custLoginPassword}
                      onChange={(e) => setCustLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 2. AI AGENT & ADMIN FORM */}
            {roleMode !== 'CUSTOMER' && (
              <>
                {isStaffRegister && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Staff Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder={roleMode === 'ADMIN' ? 'Alex Mercer' : 'Sarah Chen'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {roleMode === 'ADMIN' ? 'Administrator Username or Email' : 'AI Agent Extension Username or Email'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder={roleMode === 'ADMIN' ? 'admin or admin@nexora.ai' : 'agent or agent@nexora.ai'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder={roleMode === 'ADMIN' ? 'admin' : 'agent'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-3 font-semibold py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 text-white ${
                roleMode === 'CUSTOMER'
                  ? 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700'
                  : roleMode === 'AGENT'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
                  : 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900'
              }`}
            >
              <span>
                {loading
                  ? 'Authenticating...'
                  : roleMode === 'CUSTOMER'
                  ? customerSubMode === 'register'
                    ? 'Create Customer Account & Enter'
                    : 'Sign In to Customer Dashboard'
                  : isStaffRegister
                  ? 'Create Staff Account'
                  : `Sign In to ${roleMode === 'AGENT' ? 'Agent Console' : 'Admin Dashboard'}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Auto-Fill Demo Accounts & Switchers */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col items-center space-y-2">
            <button
              type="button"
              onClick={() => {
                if (roleMode === 'CUSTOMER') {
                  setCustomerSubMode('login');
                  setCustLoginIdent('9876543210');
                  setCustLoginPassword('customer');
                } else if (roleMode === 'AGENT') {
                  setEmail('agent');
                  setPassword('Agent@123');
                } else {
                  setEmail('admin');
                  setPassword('Admin@123');
                }
                setError('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>
                Auto-fill verified demo {roleMode.toLowerCase()} credentials ({roleMode === 'CUSTOMER' ? '9876543210 / customer' : roleMode === 'AGENT' ? 'agent / Agent@123' : 'admin / Admin@123'})
              </span>
            </button>

            {roleMode === 'CUSTOMER' ? (
              <button
                type="button"
                onClick={() => {
                  setCustomerSubMode(customerSubMode === 'register' ? 'login' : 'register');
                  setError('');
                }}
                className="text-[11px] text-slate-500 hover:text-blue-700 font-medium cursor-pointer"
              >
                {customerSubMode === 'register'
                  ? 'Already have a customer account? Sign In'
                  : "New customer? Create a new account"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsStaffRegister(!isStaffRegister);
                  setError('');
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {isStaffRegister ? 'Already registered? Sign in instead' : "Need a new account? Register now"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPortalMode('customer')}
              className="w-full mt-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
              <span>Explore Public E-Commerce Store</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
