import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Building,
  RefreshCw,
  Globe,
  Heart,
  Share2,
  Store,
  Wallet,
  Briefcase,
  Settings,
  Star,
  FileText,
  LogOut,
  Camera,
  Check,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Upload,
  Copy,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { CustomerProfile, api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFeature: string | null;
  onSelectFeature: (feature: string | null) => void;
  onOpenOrders: () => void;
}

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80'
];

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  activeFeature,
  onSelectFeature,
  onOpenOrders
}) => {
  const { customer, customerLogout, refreshCustomer } = useAuth();

  // Local feature states
  const [selectedAvatar, setSelectedAvatar] = useState<string>(customer?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  // Bank & UPI state
  const [upiInput, setUpiInput] = useState(customer?.upi_id || `${customer?.phone || '9840122567'}@okhdfcbank`);
  const [bankSaved, setBankSaved] = useState(false);

  // Rating State
  const [ratingStars, setRatingStars] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Supplier State
  const [supplierData, setSupplierData] = useState({ company: '', gstin: '', category: 'Electronics', city: 'Chennai' });
  const [supplierSubmitted, setSupplierSubmitted] = useState(false);

  // Settings State
  const [settingsData, setSettingsData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    address: customer?.address_line1 || 'No. 45, Anna Salai',
    city: customer?.city || 'Chennai',
    state: customer?.state || 'Tamil Nadu',
    pincode: customer?.pincode || '600001'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Share link copy
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen && !activeFeature) return null;

  // Handle photo upload from local device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save profile picture
  const handleSaveAvatar = async () => {
    if (!selectedAvatar) return;
    setAvatarUploading(true);
    try {
      await api.customerUpdateProfile({ avatar_url: selectedAvatar });
      await refreshCustomer();
      setAvatarSuccess(true);
      setTimeout(() => {
        setAvatarSuccess(false);
        onSelectFeature(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to update avatar', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveBankUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.customerUpdateProfile({ upi_id: upiInput });
      await refreshCustomer();
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update UPI', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.customerUpdateProfile({
        name: settingsData.name,
        address_line1: settingsData.address,
        city: settingsData.city,
        state: settingsData.state,
        pincode: settingsData.pincode
      });
      await refreshCustomer();
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update settings', err);
    }
  };

  const handleLanguageSelect = async (lang: string) => {
    try {
      await api.customerUpdateProfile({ preferred_language: lang });
      await refreshCustomer();
      onSelectFeature(null);
    } catch (err) {
      console.error('Failed to update language', err);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(`https://nexora.ai/store?ref=${customer?.customer_code || 'NEXORA'}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative group">
                <div className="w-12 h-12 rounded-full border-2 border-white/80 bg-white/20 overflow-hidden flex items-center justify-center text-lg font-black text-white shadow-md">
                  {customer?.avatar_url ? (
                    <img src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
                  ) : (
                    customer?.name?.charAt(0) || 'C'
                  )}
                </div>
                <button
                  onClick={() => onSelectFeature('avatar')}
                  title="Change Profile Picture"
                  className="absolute -bottom-1 -right-1 p-1 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>

              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="font-extrabold text-sm">{customer?.name || 'Customer'}</h3>
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                    {customer?.customer_code || 'CUST-2026-00019'}
                  </span>
                </div>
                <p className="text-xs text-blue-100 font-mono">{customer?.phone || '9840122567'}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Orders Button */}
          <div className="px-4 pt-3 pb-1 border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => {
                onClose();
                onOpenOrders();
              }}
              className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-900 rounded-2xl text-xs font-extrabold flex items-center justify-between cursor-pointer transition-all shadow-xs"
            >
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-600 text-white rounded-xl">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <span>My Orders & Autonomous AI Voice Calls</span>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {/* Content Sections */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-800 text-xs">
            {/* 1. MY PAYMENTS */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">My Payments</p>
              <div className="bg-slate-50/80 rounded-2xl p-1.5 border border-slate-200/60 divide-y divide-slate-100">
                <button
                  onClick={() => onSelectFeature('pay_later')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition-transform">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Nexoro Pay Later</p>
                      <p className="text-[10px] text-slate-500">₹25,000 Credit Limit • 0% Interest for 30 Days</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('bank_upi')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Building className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Bank & UPI Details</p>
                      <p className="text-[10px] text-slate-500">Primary: {customer?.upi_id || `${customer?.phone || '9840122567'}@okhdfcbank`}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('refunds')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl group-hover:scale-105 transition-transform">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Payment & Refund</p>
                      <p className="text-[10px] text-slate-500">Track 10-Second Instant UPI Refunds</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* 2. MY ACTIVITY */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">My Activity</p>
              <div className="bg-slate-50/80 rounded-2xl p-1.5 border border-slate-200/60 divide-y divide-slate-100">
                <button
                  onClick={() => onSelectFeature('languages')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-purple-100 text-purple-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Change Languages</p>
                      <p className="text-[10px] text-slate-500">
                        Current: {customer?.preferred_language === 'ta' ? 'தமிழ் (Tamil)' : customer?.preferred_language === 'hi' ? 'हिन्दी (Hindi)' : customer?.preferred_language === 'te' ? 'తెలుగు (Telugu)' : customer?.preferred_language === 'ml' ? 'മലയാളം (Malayalam)' : 'English'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('wishlist')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Wishlisted Products</p>
                      <p className="text-[10px] text-slate-500">5 Saved Festive & Electronics Products</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('shared')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Shared Products</p>
                      <p className="text-[10px] text-slate-500">Refer & Earn ₹50 Instant Cashback</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('followed')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-sky-100 text-sky-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Followed Shops</p>
                      <p className="text-[10px] text-slate-500">4 Verified Manufacturer Brand Stores</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* 3. OTHERS */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">Others</p>
              <div className="bg-slate-50/80 rounded-2xl p-1.5 border border-slate-200/60 divide-y divide-slate-100">
                <button
                  onClick={() => onSelectFeature('balance')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-teal-100 text-teal-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Nexoro Balance</p>
                      <p className="text-[10px] text-slate-500">₹{Number(customer?.wallet_balance || 500).toFixed(2)} Available Cash</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ₹500.00
                  </span>
                </button>

                <button
                  onClick={() => onSelectFeature('supplier')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-orange-100 text-orange-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Become a Supplier</p>
                      <p className="text-[10px] text-slate-500">Sell Products to 1,00,000+ Customers</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('settings')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-slate-200 text-slate-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Settings</p>
                      <p className="text-[10px] text-slate-500">Address Book & Notification Preferences</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('rate')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-yellow-100 text-yellow-700 rounded-xl group-hover:scale-105 transition-transform">
                      <Star className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Rate Nexoro</p>
                      <p className="text-[10px] text-slate-500">Help us improve your AI shopping experience</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onSelectFeature('legal')}
                  className="w-full p-2.5 hover:bg-white rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900">Legal and Policies</p>
                      <p className="text-[10px] text-slate-500">Terms of Use, 7-Day Returns & AI Privacy</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    customerLogout();
                    onClose();
                  }}
                  className="w-full p-2.5 hover:bg-rose-50 text-rose-600 rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl group-hover:scale-105 transition-transform">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Log Out</p>
                      <p className="text-[10px] text-rose-400">Sign out of customer session</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE POPUP MODAL (Handles whichever feature was clicked) */}
      {activeFeature && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => onSelectFeature(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. PROFILE PICTURE MODAL */}
            {activeFeature === 'avatar' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-5 h-5 text-blue-600" />
                    <h3 className="font-black text-slate-900 text-sm">Choose or Upload Profile Picture</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center py-2 space-y-3">
                  <div className="w-24 h-24 rounded-full border-4 border-blue-500 overflow-hidden shadow-lg bg-slate-100 flex items-center justify-center">
                    {selectedAvatar ? (
                      <img src={selectedAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-slate-400">{customer?.name?.charAt(0) || 'C'}</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-600">Preview Profile Picture</p>
                </div>

                {/* File Upload Option */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <label className="flex items-center justify-center space-x-2 py-2 px-4 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 text-xs font-bold text-slate-800 shadow-xs transition-colors">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Upload from Camera / Device</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400 text-center mt-1">Supports JPG, PNG, WebP up to 5MB</p>
                </div>

                {/* Pre-made Avatars Gallery */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">Or Select from Verified Avatars:</p>
                  <div className="grid grid-cols-4 gap-3">
                    {AVATAR_OPTIONS.map((avUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(avUrl)}
                        className={`aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${selectedAvatar === avUrl ? 'border-blue-600 ring-2 ring-blue-400 scale-105' : 'border-slate-200 hover:border-slate-400'}`}
                      >
                        <img src={avUrl} alt="Avatar" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {avatarSuccess && (
                  <p className="text-center text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1">
                    <Check className="w-4 h-4" />
                    <span>Profile Picture Updated Successfully!</span>
                  </p>
                )}

                <div className="pt-2 flex justify-end space-x-2">
                  <button onClick={() => onSelectFeature(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAvatar}
                    disabled={avatarUploading || !selectedAvatar}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {avatarUploading ? 'Saving...' : 'Save Profile Picture'}
                  </button>
                </div>
              </div>
            )}

            {/* 2. NEXORO PAY LATER */}
            {activeFeature === 'pay_later' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-black text-slate-900 text-sm">Nexoro Pay Later Account</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl shadow-lg space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-100 uppercase tracking-wider text-[10px]">Instant Digital Credit</span>
                    <span className="bg-white/20 text-white font-extrabold px-2 py-0.5 rounded-full text-[10px]">Active & Verified</span>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Approved Credit Limit</p>
                    <p className="text-3xl font-black tracking-tight">₹25,000.00</p>
                  </div>
                  <div className="pt-2 flex justify-between text-[11px] border-t border-white/20 text-emerald-100">
                    <span>Available Credit: <strong>₹25,000.00</strong></span>
                    <span>Used Balance: <strong>₹0.00</strong></span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <p className="font-bold text-slate-900">Benefits of Nexoro Pay Later:</p>
                  <ul className="space-y-1.5 text-slate-600">
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Shop now and pay next month on the 5th with 0% interest</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>1-Click checkout on all 230+ products without OTP friction</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Automatic settlement for returns and refunds within 10 seconds</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => onSelectFeature(null)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md cursor-pointer"
                >
                  Close & Continue Shopping
                </button>
              </div>
            )}

            {/* 3. BANK & UPI DETAILS */}
            {activeFeature === 'bank_upi' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <h3 className="font-black text-slate-900 text-sm">Bank & UPI Payment Details</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveBankUpi} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Primary UPI ID for Instant Refunds</label>
                    <input
                      type="text"
                      value={upiInput}
                      onChange={(e) => setUpiInput(e.target.value)}
                      placeholder="e.g. mobile@okhdfcbank"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Verified: Used for instant 10-second automatic refund settlements.</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">Linked Bank Account</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Auto-Verified</span>
                    </div>
                    <p className="text-xs font-mono text-slate-600">HDFC Bank ••••••4012</p>
                    <p className="text-[10px] text-slate-500">IFSC: HDFC0001234 • Anna Salai Branch</p>
                  </div>

                  {bankSaved && (
                    <p className="text-xs font-bold text-emerald-600 text-center">UPI ID updated successfully!</p>
                  )}

                  <div className="pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => onSelectFeature(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                      Done
                    </button>
                    <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm">
                      Save UPI Details
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 4. PAYMENT & REFUND */}
            {activeFeature === 'refunds' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-slate-900 text-sm">Payments & Instant Refunds</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-emerald-700 font-bold uppercase">Total Refunds Settled</p>
                      <p className="text-xl font-black text-emerald-800">₹1,299.00</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                      100% On-Time
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-800 pt-1">Recent Transactions & Status:</p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">Order #ORD-2026-00006</p>
                        <p className="text-[10px] text-slate-500 font-mono">UTR: 202611029984 • Credited to UPI</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600">+₹1,299.00</span>
                        <p className="text-[10px] text-emerald-700 font-bold">Refund Settled</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">Order #ORD-2026-00005</p>
                        <p className="text-[10px] text-slate-500 font-mono">Diwali Fest Brass Diya • Paid</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900">₹899.00</span>
                        <p className="text-[10px] text-blue-600 font-bold">Paid via UPI</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-800 text-xs rounded-xl">
                  Close
                </button>
              </div>
            )}

            {/* 5. CHANGE LANGUAGE */}
            {activeFeature === 'languages' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-purple-600" />
                    <h3 className="font-black text-slate-900 text-sm">Select Preferred Language</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Your chosen language will be used across the store and for autonomous AI voice order confirmation calls.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { code: 'en', name: 'English (Indian Accent)', sub: 'Default Store & AI Receptionist' },
                    { code: 'ta', name: 'தமிழ் (Tamil)', sub: 'முழுமையான தமிழ் குரல் மற்றும் உரை' },
                    { code: 'hi', name: 'हिन्दी (Hindi)', sub: 'हिन्दी वॉयस असिस्टेंट और स्टोर' },
                    { code: 'te', name: 'తెలుగు (Telugu)', sub: 'తెలుగు వాయిస్ ఆర్డర్ కన్ఫర్మేషన్' },
                    { code: 'ml', name: 'മലയാളം (Malayalam)', sub: 'മലയാളം വോയ്‌സ് അസിസ്റ്റന്റ്' }
                  ].map((l) => (
                    <button
                      key={l.code}
                      onClick={() => handleLanguageSelect(l.code)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${customer?.preferred_language === l.code ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-400' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{l.name}</p>
                        <p className="text-[10px] text-slate-500">{l.sub}</p>
                      </div>
                      {customer?.preferred_language === l.code && <Check className="w-4 h-4 text-purple-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. WISHLIST */}
            {activeFeature === 'wishlist' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-rose-600" />
                    <h3 className="font-black text-slate-900 text-sm">Wishlisted Products (5)</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto">
                  {[
                    { name: 'Pure Banarasi Silk Zari Woven Saree', price: 2799, cat: "Women's Fashion", img: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200' },
                    { name: 'Solid Brass Peacock Diya Set (Pack of 4)', price: 899, cat: 'Kitchen Products', img: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=200' },
                    { name: 'Royal Kaju Katli & Dry Fruit Box', price: 1299, cat: 'Grocery', img: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=200' }
                  ].map((w, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between space-x-3">
                      <img src={w.img} alt={w.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{w.name}</p>
                        <p className="text-[10px] text-slate-500">{w.cat}</p>
                        <p className="font-black text-xs text-slate-900">₹{w.price}</p>
                      </div>
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold">Saved</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm">
                  Continue Browsing Catalog
                </button>
              </div>
            )}

            {/* 7. SHARED PRODUCTS */}
            {activeFeature === 'shared' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Share2 className="w-5 h-5 text-amber-600" />
                    <h3 className="font-black text-slate-900 text-sm">Shared Products & Referral Rewards</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl shadow-md space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-100">Refer & Earn Bonus</p>
                  <p className="text-base font-black">Get ₹50 Instant Wallet Cash</p>
                  <p className="text-[11px] text-amber-100">For every friend who places their first order through your referral code.</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">
                    https://nexora.ai/store?ref={customer?.customer_code || 'CUST-2026'}
                  </span>
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs">
                  Done
                </button>
              </div>
            )}

            {/* 8. FOLLOWED SHOPS */}
            {activeFeature === 'followed' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Store className="w-5 h-5 text-sky-600" />
                    <h3 className="font-black text-slate-900 text-sm">Followed Brand Stores (4)</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { name: 'Nexora Official Electronics Hub', followers: '45.2K Followers', verified: true },
                    { name: 'Kaira Royal Festive Studio', followers: '32.1K Followers', verified: true },
                    { name: 'Gourmet Organic Pantry India', followers: '18.9K Followers', verified: true },
                    { name: 'AuraWave Audio Technologies', followers: '12.4K Followers', verified: true }
                  ].map((s, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-slate-900 flex items-center space-x-1">
                          <span>{s.name}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        </p>
                        <p className="text-[10px] text-slate-500">{s.followers}</p>
                      </div>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-lg">Following</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs">
                  Close
                </button>
              </div>
            )}

            {/* 9. NEXORO BALANCE */}
            {activeFeature === 'balance' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Wallet className="w-5 h-5 text-teal-600" />
                    <h3 className="font-black text-slate-900 text-sm">Nexoro Wallet & Cashback Balance</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-3xl shadow-lg space-y-2">
                  <span className="text-[10px] text-teal-100 font-bold uppercase tracking-wider">Available Cash Balance</span>
                  <p className="text-3xl font-black">₹{Number(customer?.wallet_balance || 500).toFixed(2)}</p>
                  <p className="text-[11px] text-teal-100">Automatically applied at checkout on any order.</p>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">Wallet History:</p>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                    <span>Diwali Welcome Bonus</span>
                    <span className="font-bold text-emerald-600">+₹500.00</span>
                  </div>
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm">
                  Use on Next Purchase
                </button>
              </div>
            )}

            {/* 10. BECOME A SUPPLIER */}
            {activeFeature === 'supplier' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="w-5 h-5 text-orange-600" />
                    <h3 className="font-black text-slate-900 text-sm">Become a Verified Supplier</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {supplierSubmitted ? (
                  <div className="p-6 text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                      <Check className="w-6 h-6" />
                    </div>
                    <p className="font-black text-sm text-slate-900">Application Submitted!</p>
                    <p className="text-xs text-slate-500">Our Merchant Onboarding Team will verify your GSTIN and reach out within 24 hours.</p>
                    <button onClick={() => onSelectFeature(null)} className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Done</button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); setSupplierSubmitted(true); }} className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sell your products on Nexora AI. Enjoy zero listing fees, automated RAG inventory sync, and autonomous AI voice order confirmation calls.
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Company / Store Name *</label>
                      <input
                        type="text"
                        required
                        value={supplierData.company}
                        onChange={(e) => setSupplierData({ ...supplierData, company: e.target.value })}
                        placeholder="e.g. Apex Electronics Private Ltd"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">GSTIN Number *</label>
                      <input
                        type="text"
                        required
                        value={supplierData.gstin}
                        onChange={(e) => setSupplierData({ ...supplierData, gstin: e.target.value })}
                        placeholder="e.g. 33AAAAA0000A1Z5"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                        <select
                          value={supplierData.category}
                          onChange={(e) => setSupplierData({ ...supplierData, category: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                        >
                          <option>Electronics</option>
                          <option>Women's Fashion</option>
                          <option>Men's Fashion</option>
                          <option>Kitchen Products</option>
                          <option>Grocery</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          value={supplierData.city}
                          onChange={(e) => setSupplierData({ ...supplierData, city: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end space-x-2">
                      <button type="button" onClick={() => onSelectFeature(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md">
                        Submit Supplier Application
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* 11. SETTINGS */}
            {activeFeature === 'settings' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Settings className="w-5 h-5 text-slate-700" />
                    <h3 className="font-black text-slate-900 text-sm">Account & Delivery Settings</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={settingsData.name}
                      onChange={(e) => setSettingsData({ ...settingsData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Default Delivery Address</label>
                    <input
                      type="text"
                      value={settingsData.address}
                      onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={settingsData.city}
                        onChange={(e) => setSettingsData({ ...settingsData, city: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={settingsData.state}
                        onChange={(e) => setSettingsData({ ...settingsData, state: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">PIN Code</label>
                      <input
                        type="text"
                        value={settingsData.pincode}
                        onChange={(e) => setSettingsData({ ...settingsData, pincode: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {settingsSaved && (
                    <p className="text-xs font-bold text-emerald-600 text-center">Settings saved successfully!</p>
                  )}

                  <div className="pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => onSelectFeature(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                      Close
                    </button>
                    <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm">
                      Update Settings
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 12. RATE NEXORO */}
            {activeFeature === 'rate' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                    <h3 className="font-black text-slate-900 text-sm">Rate Nexoro Experience</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {ratingSubmitted ? (
                  <div className="p-6 text-center space-y-2">
                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full mx-auto flex items-center justify-center">
                      <Star className="w-6 h-6 fill-yellow-400" />
                    </div>
                    <p className="font-black text-sm text-slate-900">Thank You For Your Feedback!</p>
                    <p className="text-xs text-slate-500">Your rating helps us improve our multilingual AI telephony and e-commerce shopping experience.</p>
                    <button onClick={() => onSelectFeature(null)} className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Close</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 text-center">How would you rate your autonomous AI shopping experience?</p>
                    <div className="flex justify-center space-x-2 py-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingStars(star)}
                          className="p-1 cursor-pointer transition-transform hover:scale-125"
                        >
                          <Star className={`w-8 h-8 ${star <= ratingStars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Share what you loved about our AI voice receptionist or delivery..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <button
                      onClick={() => setRatingSubmitted(true)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md"
                    >
                      Submit 5-Star Review
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 13. LEGAL AND POLICIES */}
            {activeFeature === 'legal' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-black text-slate-900 text-sm">Legal & Customer Policies</h3>
                  </div>
                  <button onClick={() => onSelectFeature(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-600 max-h-72 overflow-y-auto pr-1">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <p className="font-bold text-slate-900">1. 7-Day Hassle-Free Returns & 10-Second Refunds</p>
                    <p className="text-[11px] leading-relaxed">
                      All products purchased on Nexoro AI are covered under a 7-day doorstep replacement or refund guarantee. Once pickup is initiated, refunds are credited back to your UPI ID in 10 seconds.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <p className="font-bold text-slate-900">2. Autonomous AI Voice Telephony & TRAI Compliance</p>
                    <p className="text-[11px] leading-relaxed">
                      Our automated AI Receptionist complies strictly with TRAI, DoT, and DPDP Act standards. Calls are placed solely for order verification, address validation, and delivery updates.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <p className="font-bold text-slate-900">3. 100% Genuine Manufacturer Guarantee</p>
                    <p className="text-[11px] leading-relaxed">
                      Every product listed in the catalog is sourced through verified enterprise manufacturers and suppliers with standard 1-year brand warranty.
                    </p>
                  </div>
                </div>

                <button onClick={() => onSelectFeature(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
