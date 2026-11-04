import React from 'react';
import {
  Sparkles,
  ShoppingBag,
  UserCheck,
  Headphones,
  Shield,
  PhoneCall,
  Globe,
  Radio,
  ArrowRight,
  CheckCircle2,
  Package,
  Clock,
  Zap,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

interface LandingPageViewProps {
  onOpenAuth: (role: 'CUSTOMER' | 'AGENT' | 'ADMIN', subMode?: 'login' | 'register') => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onOpenAuth }) => {
  const { setPortalMode, customer, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white text-xs py-2 px-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
              AI TELEPHONY PLATFORM
            </span>
            <span className="hidden sm:inline">
              Autonomous Multilingual AI Voice Receptionist & E-Commerce Infrastructure across 5 Indian Languages
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-medium">
            <span className="hidden md:inline text-blue-100">Helpline: +91-80-6000-4400</span>
            <button
              onClick={() => onOpenAuth('ADMIN')}
              className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Shield className="w-3 h-3 text-amber-300" />
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & Company Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">
                  NEXORA <span className="text-blue-600">AI</span>
                </h1>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">
                KAIRA Technologies Enterprise Platform
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <a href="#voice-ai" className="hover:text-blue-600 transition-colors">
              Voice Assistant
            </a>
            <a href="#services" className="hover:text-blue-600 transition-colors">
              Services
            </a>
            <a href="#languages" className="hover:text-blue-600 transition-colors">
              Multilingual Speech
            </a>
            <a href="#company" className="hover:text-blue-600 transition-colors">
              Company Info
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Primary Action: Explore Store (Guest Access) */}
            <button
              onClick={() => setPortalMode('store')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-2 cursor-pointer transition-all hover:scale-[1.02]"
              title="Browse products in the NEXORA Store as guest"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Store</span>
            </button>

            {/* Customer Login / Dashboard */}
            {customer ? (
              <button
                onClick={() => setPortalMode('customer')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>My Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('CUSTOMER', 'login')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors border border-slate-200"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer Login</span>
              </button>
            )}

            {/* AI Agent Console Switcher */}
            <button
              onClick={() => onOpenAuth('AGENT')}
              className="hidden lg:flex items-center space-x-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 cursor-pointer transition-colors"
              title="Open AI Agent Operator Console"
            >
              <Headphones className="w-3.5 h-3.5 text-indigo-600" />
              <span>Agent Console</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200/80 rounded-full px-3 py-1 text-xs text-blue-700 font-bold">
                <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                <span>Autonomous AI Voice Receptionist & Multimodal Shopping</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
                Intelligent Voice AI <br />
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                  for Modern Commerce
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Connect seamlessly with autonomous AI voice receptionists, explore 16 diverse product categories,
                and communicate in real-time through WebRTC peer-to-peer audio in English, Tamil, Telugu, Malayalam, and Hindi.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={() => setPortalMode('store')}
                  className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 cursor-pointer transition-all hover:scale-105"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Explore NEXORA Store</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onOpenAuth('CUSTOMER', 'login')}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl text-sm font-bold border border-slate-300 shadow-sm flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Customer Login / Dashboard</span>
                </button>

                <button
                  onClick={() => onOpenAuth('CUSTOMER', 'register')}
                  className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <span>New Customer? Register</span>
                </button>
              </div>

              {/* Badges */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Real-Time WebRTC Calling</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>5 Indian Languages</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>1000+ Concurrent Lines</span>
                </span>
              </div>
            </div>

            {/* Right Card: Interactive AI Receptionist Preview */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/90 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <NexoraAvatar size="md" isSpeaking={false} />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">Khaira AI Receptionist</h3>
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Active & Available for Voice Calls</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    WebRTC Audio
                  </span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-3">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    "Hello! I am your autonomous AI receptionist. Sign in to your Customer Dashboard to initiate an instant two-way voice call, or explore our store directly."
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      English
                    </span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      தமிழ்
                    </span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      తెలుగు
                    </span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      മലയാളം
                    </span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      हिन्दी
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Available Portals</p>
                    <p className="text-xs font-bold text-slate-800">Customer • Agent • Admin</p>
                  </div>
                  <button
                    onClick={() => onOpenAuth('CUSTOMER', 'login')}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Start Voice Call</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Services Section */}
      <section id="services" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full">
              Enterprise Services
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
              Comprehensive Platform Capabilities
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Designed for high-throughput telephony, intelligent customer self-service, and seamless e-commerce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Service 1 */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-all hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-1.5">
                Bidirectional Voice AI
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Live two-way WebRTC calling between Customer Dashboards and AI Agent Consoles with real-time transcription and speech synthesis.
              </p>
            </div>

            {/* Service 2 */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-1.5">
                16-Category Storefront
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Smartphones, Laptops, Fashion, Kitchen, and Appliances with genuine product images, authentic specs, and dynamic variants.
              </p>
              <button
                onClick={() => setPortalMode('store')}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
              >
                <span>Browse Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Service 3 */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-1.5">
                Human Handoff Desk
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Autonomous escalation from AI receptionist to human operators whenever complex order queries or sensitive billing issues arise.
              </p>
            </div>

            {/* Service 4 */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-1.5">
                Enterprise Admin Suite
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Role-based access control, call queues, order management, customer CRM, knowledge base documents, and live telemetry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Multilingual Voice Assistant Section */}
      <section id="languages" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2.5 py-1 rounded-full">
              Speech Pipeline
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
              Native Voice in 5 Indian Languages
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              Neural Text-to-Speech & Speech-to-Text with Indian regional accent adaptation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { code: 'en', name: 'English', native: 'Indian Accent', voice: 'Neerja Neural', desc: 'Enterprise PBX & General Support' },
              { code: 'ta', name: 'Tamil', native: 'தமிழ்', voice: 'Pallavi Neural', desc: 'Regional Tamil Voice Reception' },
              { code: 'te', name: 'Telugu', native: 'తెలుగు', voice: 'Shruti Neural', desc: 'Order Confirmation & Verification' },
              { code: 'ml', name: 'Malayalam', native: 'മലയാളം', voice: 'Sobhana Neural', desc: 'Customer Inquiries & Support' },
              { code: 'hi', name: 'Hindi', native: 'हिन्दी', voice: 'Swara Neural', desc: 'National Commerce & Billing Assistance' },
            ].map((lang) => (
              <div
                key={lang.code}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-400 transition-all text-center"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center mx-auto mb-2 text-sm uppercase">
                  {lang.code}
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">{lang.name}</h4>
                <p className="text-xs text-blue-600 font-semibold">{lang.native}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{lang.voice}</p>
                <p className="text-[11px] text-slate-500 mt-2">{lang.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company Information Footer */}
      <footer id="company" className="bg-slate-900 text-slate-400 text-xs py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-slate-800">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-white">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span className="font-black text-sm tracking-tight">NEXORA AI</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                KAIRA Technologies Unified Multilingual AI Receptionist and Enterprise Shopping Platform.
              </p>
              <p className="text-[11px] text-slate-500">
                Chennai, Tamil Nadu 600096, India.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">
                Platform Portals
              </h4>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <button onClick={() => setPortalMode('store')} className="hover:text-white transition-colors cursor-pointer">
                    Explore NEXORA Store
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenAuth('CUSTOMER', 'login')} className="hover:text-white transition-colors cursor-pointer">
                    Customer Dashboard
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenAuth('AGENT')} className="hover:text-white transition-colors cursor-pointer">
                    AI Agent Operator Console
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenAuth('ADMIN')} className="hover:text-white transition-colors cursor-pointer">
                    Enterprise Admin Suite
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">
                Telephony Architecture
              </h4>
              <ul className="space-y-1.5 text-[11px]">
                <li>SIP & WebRTC Signaling</li>
                <li>Edge-TTS Multilingual Voice</li>
                <li>Faster-Whisper Speech-to-Text</li>
                <li>Dual-Channel Human Escalation</li>
                <li>DPDPA 2023 Compliant</li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">
                Support & Inquiries
              </h4>
              <p className="text-[11px] text-slate-300 font-mono">Toll-Free: +91-80-6000-4400</p>
              <p className="text-[11px] text-slate-300 font-mono mt-1">Escalations: +91-80-6000-4499</p>
              <p className="text-[11px] text-slate-300 mt-1">support@khairacompany.example</p>
              <div className="mt-3">
                <button
                  onClick={() => setPortalMode('store')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Start Shopping Now
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <p>© 2026 KAIRA Technologies / NEXORA AI. All rights reserved.</p>
            <p>Certified Autonomous Voice & Multi-Marketplace Architecture.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
