import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './views/DashboardView';
import { LiveCallView } from './views/LiveCallView';
import { CallHistoryView } from './views/CallHistoryView';
import { CustomerManagementView } from './views/CustomerManagementView';
import { ProductsInventoryView } from './views/ProductsInventoryView';
import { OrdersView } from './views/OrdersView';
import { AppointmentsView } from './views/AppointmentsView';
import { ComplaintsView } from './views/ComplaintsView';
import { HumanHandoffView } from './views/HumanHandoffView';
import { KnowledgeBaseView } from './views/KnowledgeBaseView';
import { CampaignsView } from './views/CampaignsView';
import { EmployeesView } from './views/EmployeesView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { AIConfigView } from './views/AIConfigView';
import { AuthView } from './views/AuthView';
import { CustomerDashboardView } from './views/CustomerDashboardView';
import { AgentConsoleView } from './views/AgentConsoleView';
import { CustomerStoreView } from './views/CustomerStoreView';
import { LandingPageView } from './views/LandingPageView';
import { AICallingManagementView } from './views/AICallingManagementView';
import { Bell, AlertCircle, X, Headphones, Eye, RotateCcw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, token, adminToken, customerToken, customer, loading, setPendingHandoffsCount, portalMode, setPortalMode } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [liveHandoffAlert, setLiveHandoffAlert] = useState<any | null>(null);

  // Admin preview switcher for testing Customer / Agent experiences
  const [adminRoleOverride, setAdminRoleOverride] = useState<'CUSTOMER' | 'AGENT' | null>(null);

  // Real-time Agent Dispatch WebSocket listener
  useEffect(() => {
    if (!token) return;

    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/handoffs/ws/agent`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'HANDOFF_ALERT') {
            setLiveHandoffAlert(data.ticket);
            setPendingHandoffsCount((prev) => prev + 1);

            // Audio notification chime
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.3);
            } catch {
              // Audio context might be restricted before interaction
            }
          }
        } catch (e) {
          console.error('Error handling WebSocket alert', e);
        }
      };
    } catch (e) {
      console.warn('Agent WebSocket connection skipped', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">Authenticating NEXORA AI Session...</p>
        </div>
      </div>
    );
  }

  // 1. Landing Page (Public presentation & entry point)
  if (portalMode === 'landing') {
    return (
      <LandingPageView
        onOpenAuth={(role) => {
          if (role === 'CUSTOMER') setPortalMode('customer');
          else if (role === 'AGENT') setPortalMode('agent');
          else setPortalMode('admin');
        }}
      />
    );
  }

  // 2. Customer Shopping Store (Public or Customer browsing)
  if (portalMode === 'store') {
    return <CustomerStoreView />;
  }

  // 3. Customer Dashboard (Dedicated portal for logged-in customers)
  if (portalMode === 'customer') {
    if (customerToken || customer) {
      return <CustomerDashboardView />;
    }
    return <AuthView initialRole="CUSTOMER" />;
  }

  // 4. Dedicated AI Agent Operator Console
  if (portalMode === 'agent') {
    const isAgent = Boolean(adminToken && user && ['AGENT', 'ADMIN', 'SUPERADMIN'].includes(user.role?.toUpperCase()));
    if (isAgent) {
      return <AgentConsoleView />;
    }
    return <AuthView initialRole="AGENT" />;
  }

  // 5. Admin & Staff Portal (Protected - requires staff/admin session)
  const isStaffAuthenticated = Boolean(adminToken && user && ['ADMIN', 'SUPERADMIN'].includes(user.role?.toUpperCase()));
  if (!isStaffAuthenticated) {
    return <AuthView initialRole="ADMIN" />;
  }

  const effectiveRole = adminRoleOverride || user?.role?.toUpperCase();

  // 1. Customer Experience (Strictly isolated for Customer role)
  if (effectiveRole === 'CUSTOMER' || effectiveRole === 'USER') {
    return (
      <div>
        {adminRoleOverride && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between sticky top-0 z-50">
            <span className="flex items-center space-x-1.5 font-semibold text-blue-300">
              <Eye className="w-3.5 h-3.5" />
              <span>Admin Preview Mode: Customer Voice Portal</span>
            </span>
            <button
              onClick={() => setAdminRoleOverride(null)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Return to Admin Suite</span>
            </button>
          </div>
        )}
        <CustomerDashboardView />
      </div>
    );
  }

  // 2. AI Agent Console Experience (Dedicated for Agent role)
  if (effectiveRole === 'AGENT') {
    return (
      <div>
        {adminRoleOverride && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between sticky top-0 z-50">
            <span className="flex items-center space-x-1.5 font-semibold text-indigo-300">
              <Eye className="w-3.5 h-3.5" />
              <span>Admin Preview Mode: AI Agent Operator Console</span>
            </span>
            <button
              onClick={() => setAdminRoleOverride(null)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Return to Admin Suite</span>
            </button>
          </div>
        )}
        <AgentConsoleView />
      </div>
    );
  }

  // 3. Company Owner / Admin Full Enterprise Experience
  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'agent-console':
        return <AgentConsoleView />;
      case 'customer-portal':
        return <CustomerDashboardView />;
      case 'ai-calling':
        return <AICallingManagementView />;
      case 'store':
        return <CustomerStoreView />;
      case 'live-calls':
        return <LiveCallView />;
      case 'calls':
        return <CallHistoryView />;
      case 'customers':
        return <CustomerManagementView />;
      case 'products':
        return <ProductsInventoryView />;
      case 'orders':
        return <OrdersView />;
      case 'appointments':
        return <AppointmentsView />;
      case 'complaints':
        return <ComplaintsView />;
      case 'handoff':
        return <HumanHandoffView />;
      case 'knowledge':
        return <KnowledgeBaseView />;
      case 'campaigns':
        return <CampaignsView />;
      case 'employees':
        return <EmployeesView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'settings':
        return <SettingsView />;
      case 'ai-config':
        return <AIConfigView />;
      default:
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Header with Role Switchers */}
        <div className="bg-slate-900 text-slate-300 px-6 py-2 text-xs flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Admin Suite
            </span>
            <span className="text-slate-400">Company Owner & Administration</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Experience Portal Previews:</span>
            <button
              onClick={() => setAdminRoleOverride('CUSTOMER')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Eye className="w-3 h-3" />
              <span>Customer Portal</span>
            </button>
            <button
              onClick={() => setAdminRoleOverride('AGENT')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Eye className="w-3 h-3" />
              <span>Agent Console</span>
            </button>
          </div>
        </div>

        <Header onOpenLiveCall={() => setCurrentTab('live-calls')} />

        {/* Real-time Transfer Toast Alert Popup */}
        {liveHandoffAlert && (
          <div className="m-4 p-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-2xl shadow-lg flex items-center justify-between animate-bounce">
            <div className="flex items-center space-x-3">
              <Headphones className="w-6 h-6 text-white shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  Incoming Human Handoff: {liveHandoffAlert.customer_name} ({liveHandoffAlert.customer_phone})
                </p>
                <p className="text-xs text-amber-100 mt-0.5">
                  Reason: {liveHandoffAlert.reason} • Language: {liveHandoffAlert.customer_language?.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setCurrentTab('handoff');
                  setLiveHandoffAlert(null);
                }}
                className="bg-white text-slate-900 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-amber-50 cursor-pointer shadow-xs"
              >
                Go to Desk
              </button>
              <button
                onClick={() => setLiveHandoffAlert(null)}
                className="p-1 hover:bg-white/20 rounded-lg"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
