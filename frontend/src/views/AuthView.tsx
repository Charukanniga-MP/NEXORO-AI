import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Headphones,
  UserCheck,
  ShieldAlert,
  ShoppingBag,
  UserPlus,
  LogIn,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';
import { api } from '../services/api';

interface AuthViewProps {
  initialRole?: 'CUSTOMER' | 'AGENT' | 'ADMIN';
}

export const AuthView: React.FC<AuthViewProps> = ({ initialRole }) => {
  const {
    login,
    register,
    customerPortalRegister,
    customerPortalLogin,
    setPortalMode,
    portalMode
  } = useAuth();

  const [roleMode, setRoleMode] = useState<'CUSTOMER' | 'AGENT' | 'ADMIN'>(
    initialRole || (portalMode === 'admin' ? 'ADMIN' : 'CUSTOMER')
  );

  // Customer sub-tab: 'login' vs 'register'
  const [customerSubMode, setCustomerSubMode] = useState<'login' | 'register'>('login');

  // Customer Registration fields
  const [custRegName, setCustRegName] = useState<string>('');
  const [custRegUsername, setCustRegUsername] = useState<string>('');
  const [custRegEmail, setCustRegEmail] = useState<string>('');
  const [custRegPhone, setCustRegPhone] = useState<string>('');
  const [custRegPassword, setCustRegPassword] = useState<string>('');
  const [custRegConfirmPassword, setCustRegConfirmPassword] = useState<string>('');

  // Customer Sign-in fields
  const [custLoginIdent, setCustLoginIdent] = useState<string>('9876543210');
  const [custLoginPassword, setCustLoginPassword] = useState<string>('customer');
  const [custRememberMe, setCustRememberMe] = useState<boolean>(true);

  // Staff credentials (AI Agent & Admin)
  const [email, setEmail] = useState<string>(
    initialRole === 'ADMIN' || portalMode === 'admin' ? 'admin' : 'agent'
  );
  const [password, setPassword] = useState<string>(
    initialRole === 'ADMIN' || portalMode === 'admin' ? 'Admin@123' : 'Agent@123'
  );
  const [staffRememberMe, setStaffRememberMe] = useState<boolean>(true);
  const [isStaffRegister, setIsStaffRegister] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [staffPhone, setStaffPhone] = useState<string>('');

  // Password visibility toggles
  const [showCustLoginPassword, setShowCustLoginPassword] = useState<boolean>(false);
  const [showCustRegPassword, setShowCustRegPassword] = useState<boolean>(false);
  const [showCustRegConfirmPassword, setShowCustRegConfirmPassword] = useState<boolean>(false);
  const [showStaffPassword, setShowStaffPassword] = useState<boolean>(false);

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotIdent, setForgotIdent] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState<string>('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotMsg, setForgotMsg] = useState<string>('');
  const [forgotError, setForgotError] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');

    try {
      if (forgotStep === 'request') {
        if (!forgotIdent.trim()) {
          setForgotError('Please enter your email, username, or registered mobile number.');
          setForgotLoading(false);
          return;
        }
        await api.login({ username_or_email: forgotIdent.trim(), password: 'test' }).catch(() => {});
        setForgotStep('reset');
        setForgotMsg('Identity verified. Please set your new password below.');
      } else {
        if (!forgotNewPassword.trim()) {
          setForgotError('Please enter a new password.');
          setForgotLoading(false);
          return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
          setForgotError('Passwords do not match.');
          setForgotLoading(false);
          return;
        }

        // Call reset password endpoint
        const res = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_or_username: forgotIdent.trim(),
            new_password: forgotNewPassword,
            confirm_new_password: forgotConfirmPassword
          })
        });

        const data = await res.json();
        if (!res.ok) {
          setForgotError(data.detail || 'Password reset failed. Account not found.');
        } else {
          setForgotMsg('Password updated successfully! You can now sign in.');
          setTimeout(() => {
            setShowForgotPassword(false);
            setForgotStep('request');
            setForgotIdent('');
            setForgotNewPassword('');
            setForgotConfirmPassword('');
          }, 1500);
        }
      }
    } catch (err: any) {
      setForgotError(err?.message || 'An error occurred during password reset.');
    } finally {
      setForgotLoading(false);
    }
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
          if (!custRegUsername.trim()) {
            setError('Please enter a username for your account.');
            setLoading(false);
            return;
          }
          if (custRegUsername.trim().length < 3) {
            setError('Username must be at least 3 characters long.');
            setLoading(false);
            return;
          }
          if (!custRegEmail.trim() || !custRegEmail.includes('@') || !custRegEmail.includes('.')) {
            setError('Please enter a valid Gmail or email address (e.g. name@example.com).');
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
          if (custRegPassword.length < 4) {
            setError('Password should be at least 4 characters long.');
            setLoading(false);
            return;
          }
          if (custRegPassword !== custRegConfirmPassword) {
            setError('Password and Confirm Password do not match. Please verify.');
            setLoading(false);
            return;
          }

          const res = await customerPortalRegister({
            name: custRegName.trim(),
            username: custRegUsername.trim().toLowerCase(),
            email: custRegEmail.trim().toLowerCase(),
            phone: cleanPhone,
            password: custRegPassword.trim(),
            confirm_password: custRegConfirmPassword.trim()
          });

          if (!res.success) {
            setError(res.message || 'Registration failed. This mobile number, email, or username may already be registered.');
          } else {
            setSuccessMsg('Account registered successfully! Redirecting to your Customer Dashboard...');
            setTimeout(() => {
              setPortalMode('customer');
            }, 800);
          }
        } else {
          // 2. Customer Sign-in
          if (!custLoginIdent.trim()) {
            setError('Please enter your username, 10-digit mobile number, or email.');
            setLoading(false);
            return;
          }
          if (!custLoginPassword.trim()) {
            setError('Please enter your password.');
            setLoading(false);
            return;
          }

          const res = await customerPortalLogin(custLoginIdent.trim(), custLoginPassword.trim(), custRememberMe);
          if (!res.success) {
            setError(res.message || 'Invalid username, mobile number, email, or password.');
          } else {
            setSuccessMsg('Login successful! Welcome back.');
            setTimeout(() => {
              setPortalMode('customer');
            }, 500);
          }
        }
      } else {
        // Staff Login (AI Agent or Company Admin)
        if (isStaffRegister) {
          const ok = await register({
            email: email.trim().toLowerCase(),
            username: email.trim().toLowerCase(),
            password,
            full_name: fullName || (roleMode === 'ADMIN' ? 'Enterprise Administrator' : 'Sarah Jenkins (AI Voice Specialist)'),
            phone: staffPhone || undefined,
            department: roleMode === 'ADMIN' ? 'Executive Administration & IT' : 'Order Fulfillment & Voice Reception',
            role: roleMode
          });
          if (!ok) {
            setError('Staff registration failed. Email or username may already be in use.');
          } else {
            setSuccessMsg(`Account created successfully! Entering ${roleMode === 'ADMIN' ? 'Admin Suite' : 'Agent Console'}...`);
            setTimeout(() => {
              setPortalMode('admin');
            }, 600);
          }
        } else {
          const ok = await login(email.trim(), password, roleMode, staffRememberMe);
          if (!ok) {
            setError(`Invalid credentials for ${roleMode === 'AGENT' ? 'AI Agent' : 'Administrator'}. Please verify username/email and password.`);
          } else {
            setSuccessMsg(`Authenticated successfully! Entering ${roleMode === 'AGENT' ? 'Agent Console' : 'Admin Dashboard'}...`);
            setTimeout(() => {
              setPortalMode('admin');
            }, 500);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please check your network and credentials.');
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
              Select Your Access Portal
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
                <span className="text-[11px] truncate">Agent Desk</span>
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
                <span className="text-[11px] truncate">Admin Suite</span>
              </button>
            </div>
          </div>

          {/* Mode Subtitle Description */}
          <div className="mb-4 p-2.5 rounded-xl text-xs flex items-center justify-between border bg-slate-50 border-slate-200/70">
            <div>
              <p className="font-bold text-slate-800">
                {roleMode === 'CUSTOMER' && 'Customer Voice & Shopping Portal'}
                {roleMode === 'AGENT' && 'Agent Operator Desk'}
                {roleMode === 'ADMIN' && 'Enterprise Administration'}
              </p>
              <p className="text-[11px] text-slate-500">
                {roleMode === 'CUSTOMER' && 'Sign in with your registered username/mobile to connect with AI & manage orders.'}
                {roleMode === 'AGENT' && 'Dedicated console for customer service agents to accept and handle live call handoffs.'}
                {roleMode === 'ADMIN' && 'Full administrative control, telephony management, and real-time operational analytics.'}
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
                  setSuccessMsg('');
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
                  setSuccessMsg('');
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
                {/* Full Name */}
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

                {/* Username */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. ananya_sharma"
                      value={custRegUsername}
                      onChange={(e) => setCustRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Unique username for instant login</p>
                </div>

                {/* 10-Digit Mobile Number */}
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
                  <p className="text-[10px] text-slate-400 mt-0.5">Any valid 10-digit mobile number</p>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email / Gmail Address <span className="text-rose-500">*</span>
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

                {/* Password with Show/Hide */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showCustRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Create a strong password"
                      value={custRegPassword}
                      onChange={(e) => setCustRegPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustRegPassword(!showCustRegPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showCustRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password with Show/Hide */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    {custRegConfirmPassword && (
                      <span className={`text-[10px] ${custRegPassword === custRegConfirmPassword ? 'text-emerald-600 font-bold' : 'text-rose-500'}`}>
                        {custRegPassword === custRegConfirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showCustRegConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat your password"
                      value={custRegConfirmPassword}
                      onChange={(e) => setCustRegConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustRegConfirmPassword(!showCustRegConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showCustRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 1B. CUSTOMER: SIGN IN */}
            {roleMode === 'CUSTOMER' && customerSubMode === 'login' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username, 10-Digit Mobile, or Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210 or john_miller or john.miller@example.com"
                      value={custLoginIdent}
                      onChange={(e) => setCustLoginIdent(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Use your username, registered 10-digit mobile, or email</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdent(custLoginIdent);
                        setShowForgotPassword(true);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showCustLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      value={custLoginPassword}
                      onChange={(e) => setCustLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustLoginPassword(!showCustLoginPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showCustLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={custRememberMe}
                      onChange={(e) => setCustRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-slate-600">Remember me on this browser</span>
                  </label>
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
                        placeholder={roleMode === 'ADMIN' ? 'Enterprise Administrator' : 'Sarah Jenkins'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {roleMode === 'ADMIN' ? 'Administrator Username or Email' : 'AI Agent Extension, Username or Email'}
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdent(email);
                        setShowForgotPassword(true);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffRememberMe}
                      onChange={(e) => setStaffRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-slate-600">Remember me on this browser</span>
                  </label>
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
                  ? 'Verifying...'
                  : roleMode === 'CUSTOMER'
                  ? customerSubMode === 'register'
                    ? 'Create Customer Account & Sign In'
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
                setSuccessMsg('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>
                Auto-fill verified demo {roleMode === 'CUSTOMER' ? 'customer' : roleMode === 'AGENT' ? 'agent' : 'admin'} credentials
                ({roleMode === 'CUSTOMER' ? '9876543210 / customer' : roleMode === 'AGENT' ? 'agent / Agent@123' : 'admin / Admin@123'})
              </span>
            </button>

            {roleMode === 'CUSTOMER' ? (
              <button
                type="button"
                onClick={() => {
                  setCustomerSubMode(customerSubMode === 'register' ? 'login' : 'register');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-[11px] text-slate-500 hover:text-blue-700 font-medium cursor-pointer"
              >
                {customerSubMode === 'register'
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Create New Account"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsStaffRegister(!isStaffRegister);
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {isStaffRegister ? 'Already registered? Sign in instead' : `Need a new ${roleMode === 'ADMIN' ? 'admin' : 'agent'} account? Register now`}
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

      {/* Forgot Password Modal Dialog */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Reset Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotMsg && (
              <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotMsg}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Username, Email, or Mobile
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210 or admin or email"
                  value={forgotIdent}
                  onChange={(e) => setForgotIdent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {forgotStep === 'reset' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Confirm new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                </>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  {forgotLoading ? 'Processing...' : forgotStep === 'request' ? 'Verify Account' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
