import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  RotateCcw, 
  Volume2, 
  Play, 
  Pause, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Globe, 
  MessageSquare, 
  FileText, 
  AlertCircle, 
  X, 
  UserCheck, 
  Users, 
  ShieldAlert, 
  PlusCircle, 
  Send, 
  Sparkles, 
  Headphones, 
  TrendingUp, 
  AlertTriangle,
  Calendar,
  CreditCard,
  ShoppingBag,
  HelpCircle,
  ThumbsUp,
  MessageCircle
} from 'lucide-react';
import { api, AICallLog, AICallingStats, AIAgentProfile } from '../services/api';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Calls', icon: PhoneCall },
  { id: 'ORDER_CONFIRMATION', label: 'Order Confirmations', icon: ShoppingBag },
  { id: 'PAYMENT_CONFIRMATION', label: 'Payment Confirmations', icon: CreditCard },
  { id: 'PAYMENT_FAILURE', label: 'Payment Failures', icon: AlertCircle },
  { id: 'ORDER_DELAY', label: 'Order Delays', icon: Clock },
  { id: 'APPOINTMENT_CONFIRMATION', label: 'Appt Confirmations', icon: Calendar },
  { id: 'APPOINTMENT_RESCHEDULE', label: 'Appt Reschedules', icon: Calendar },
  { id: 'CUSTOMER_FEEDBACK', label: 'Customer Feedback', icon: ThumbsUp },
  { id: 'CUSTOMER_COMPLAINT', label: 'Customer Complaints', icon: AlertTriangle },
  { id: 'CUSTOMER_ENQUIRY', label: 'Customer Enquiries', icon: HelpCircle }
];

export const AICallingManagementView: React.FC = () => {
  const [logs, setLogs] = useState<AICallLog[]>([]);
  const [stats, setStats] = useState<AICallingStats | null>(null);
  const [agents, setAgents] = useState<AIAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  
  const [selectedCall, setSelectedCall] = useState<AICallLog | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [escalateLoading, setEscalateLoading] = useState<string | null>(null);

  // Agent Management Modal / Panel
  const [showAgentsPanel, setShowAgentsPanel] = useState<boolean>(false);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);

  // Manual Trigger Modal
  const [showTriggerModal, setShowTriggerModal] = useState<boolean>(false);
  const [triggerCategory, setTriggerCategory] = useState<string>('ORDER_CONFIRMATION');
  const [triggerPhone, setTriggerPhone] = useState<string>('+91-98745-86845');
  const [triggerLanguage, setTriggerLanguage] = useState<string>('ta');
  const [triggerOutcome, setTriggerOutcome] = useState<string>('SUCCESS');
  const [triggerDispatching, setTriggerDispatching] = useState<boolean>(false);
  const [triggerSuccessMsg, setTriggerSuccessMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes, agentsRes] = await Promise.all([
        api.getAICallLogs({
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          language: languageFilter !== 'ALL' ? languageFilter : undefined,
          search: search || undefined
        }),
        api.getAICallingStats(),
        api.getAIAgents()
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
      setAgents(agentsRes.data);
    } catch (e) {
      console.error("Failed to fetch AI calling logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [categoryFilter, statusFilter, languageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleRetryCall = async (callId: string) => {
    try {
      setRetryLoading(callId);
      await api.retryAICall(callId);
      await fetchLogs();
    } catch (e) {
      console.error("Retry failed", e);
    } finally {
      setRetryLoading(null);
    }
  };

  const handleEscalateCall = async (callId: string) => {
    try {
      setEscalateLoading(callId);
      await api.escalateAICall(callId, "Escalated by supervisor to human desk");
      await fetchLogs();
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall(prev => prev ? { ...prev, call_status: 'ESCALATED', escalated_to_human: true } : null);
      }
    } catch (e) {
      console.error("Escalation failed", e);
    } finally {
      setEscalateLoading(null);
    }
  };

  const handleToggleAgentStatus = async (agentId: string, currentStatus: string) => {
    try {
      setUpdatingAgentId(agentId);
      const newStatus = currentStatus === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
      await api.updateAgentPresence(agentId, newStatus);
      await fetchLogs();
    } catch (e) {
      console.error("Failed to update agent status", e);
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriggerDispatching(true);
    setTriggerSuccessMsg(null);
    try {
      const res = await api.triggerAICall({
        category: triggerCategory,
        phone_number: triggerPhone,
        language: triggerLanguage,
        simulate_outcome: triggerOutcome,
        bypass_duplicate_check: true
      });
      setTriggerSuccessMsg(`AI Call successfully dispatched to ${triggerPhone} via ${res.data.agent_name || 'AI Specialist'}!`);
      await fetchLogs();
      setTimeout(() => {
        setTriggerSuccessMsg(null);
        setShowTriggerModal(false);
      }, 2500);
    } catch (e) {
      console.error("Failed to trigger AI call", e);
    } finally {
      setTriggerDispatching(false);
    }
  };

  const toggleAudio = (audioUrl?: string, callId?: string) => {
    if (!audioUrl) return;
    if (playingAudioId === callId && audioElement) {
      audioElement.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingAudioId(null);
    audio.play().catch(e => console.warn("Audio autoplay blocked", e));
    setAudioElement(audio);
    setPlayingAudioId(callId || null);
  };

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      en: 'English',
      ta: 'Tamil (தமிழ்)',
      te: 'Telugu (తెలుగు)',
      ml: 'Malayalam (മലയാളം)',
      hi: 'Hindi (हिन्दी)'
    };
    return map[code.toLowerCase()] || code.toUpperCase();
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'ORDER_CONFIRMATION': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'PAYMENT_CONFIRMATION': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'PAYMENT_FAILURE': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'ORDER_DELAY': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'APPOINTMENT_CONFIRMATION': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'APPOINTMENT_RESCHEDULE': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'CUSTOMER_FEEDBACK': return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'CUSTOMER_COMPLAINT': return 'text-orange-700 bg-orange-50 border-orange-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
              Autonomous Telephony Engine
            </span>
            <span className="text-xs text-slate-400">• Multi-Turn Grounded AI Speech</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center space-x-2">
            <PhoneCall className="w-6 h-6 text-blue-600" />
            <span>AI Customer Support & Order Voice System</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Autonomous human-like outbound calling across 8 support categories in English, Tamil, and regional Indian languages. Complete with automatic event detection, duplicate prevention, and retry rules.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 flex-wrap gap-2">
          <button
            onClick={() => setShowAgentsPanel(!showAgentsPanel)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center space-x-2 cursor-pointer transition-all shadow-xs"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>AI Agents ({agents.length})</span>
          </button>

          <button
            onClick={() => setShowTriggerModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs flex items-center space-x-2 cursor-pointer transition-all shadow-sm shadow-blue-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Trigger Automated Call</span>
          </button>

          <button
            onClick={fetchLogs}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl text-xs flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
            title="Refresh Call Queue"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Agents Roster Banner (collapsible or toggled) */}
      {showAgentsPanel && (
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-400 flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Specialized AI Agent Assignment Desk</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each AI agent specializes in distinct customer support categories and regional language flows.
              </p>
            </div>
            <button
              onClick={() => setShowAgentsPanel(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {agents.map((ag) => (
              <div key={ag.id} className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold bg-slate-700 px-2 py-0.5 rounded-md text-slate-300">
                      Ext {ag.extension}
                    </span>
                    <button
                      onClick={() => handleToggleAgentStatus(ag.id, ag.status)}
                      disabled={updatingAgentId === ag.id}
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer transition-all ${
                        ag.status === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                      }`}
                    >
                      {updatingAgentId === ag.id ? 'Updating...' : ag.status}
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-white">{ag.full_name}</h4>
                  <p className="text-xs text-blue-300 font-medium mt-0.5">{ag.department}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">{ag.phone}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>{ag.languages.join(', ')}</span>
                  </div>
                  <div className="font-bold text-amber-400">★ {ag.csat_rating}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Total AI Calls</p>
          <p className="text-xl font-black text-slate-900 mt-1">{stats?.total_calls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase">Completed</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{stats?.completed_calls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-blue-600 uppercase">Confirmed Orders</p>
          <p className="text-xl font-black text-blue-700 mt-1">{stats?.confirmed_orders || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-amber-600 uppercase">Unanswered</p>
          <p className="text-xl font-black text-amber-700 mt-1">{stats?.unanswered_calls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-rose-600 uppercase">Escalated to Human</p>
          <p className="text-xl font-black text-rose-700 mt-1">{stats?.escalated_calls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-indigo-600 uppercase">Avg Call Duration</p>
          <p className="text-xl font-black text-indigo-700 mt-1">{stats?.avg_duration_seconds || 0}s</p>
        </div>
      </div>

      {/* 8 Customer Support Categories Navigation Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-max">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'ALL' 
              ? (stats?.total_calls || 0)
              : (stats?.categories?.[tab.id] || 0);
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Order ID, Customer Name, or Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="NOT_ANSWERED">Not Answered</option>
              <option value="FAILED">Failed</option>
              <option value="ESCALATED">Escalated to Human</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-500">Language:</span>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-pointer"
            >
              <option value="ALL">All Languages</option>
              <option value="en">English</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="te">Telugu (తెలుగు)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Call Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Assigned AI Agent</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Call Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading AI Voice Call records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No automated AI calls found matching this filter.
                  </td>
                </tr>
              ) : (
                logs.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border inline-flex items-center space-x-1 ${getCategoryColor(call.category)}`}>
                        <span>{call.category_display || call.category}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{call.customer_name || 'Customer'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{call.phone_number}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center shrink-0">
                          {call.agent_name ? call.agent_name[0] : 'A'}
                        </div>
                        <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[140px]">
                          {call.agent_name || 'Sarah Jenkins'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {call.order_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-blue-500" />
                        <span>{getLanguageLabel(call.preferred_language)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          call.call_status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : call.call_status === 'NOT_ANSWERED'
                            ? 'bg-amber-100 text-amber-800'
                            : call.call_status === 'ESCALATED' || call.escalated_to_human
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {call.escalated_to_human ? 'Escalated to Human' : call.call_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {call.duration_seconds}s
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {call.recording_url && (
                          <button
                            onClick={() => toggleAudio(call.recording_url, call.id)}
                            className={`p-1.5 rounded-xl cursor-pointer transition-all ${
                              playingAudioId === call.id
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Play Voice Audio"
                          >
                            {playingAudioId === call.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedCall(call)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors"
                        >
                          Transcript
                        </button>

                        <button
                          onClick={() => handleRetryCall(call.id)}
                          disabled={retryLoading === call.id}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors"
                          title={`Retry call (Attempts: ${call.retry_count || 0}/3)`}
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${retryLoading === call.id ? 'animate-spin' : ''}`} />
                        </button>

                        {!call.escalated_to_human && (
                          <button
                            onClick={() => handleEscalateCall(call.id)}
                            disabled={escalateLoading === call.id}
                            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors"
                            title="Escalate to Human Operator Desk"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Details / Audio / Transcript Modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getCategoryColor(selectedCall.category)}`}>
                    {selectedCall.category_display || selectedCall.category}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedCall.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  AI Call with {selectedCall.customer_name} ({selectedCall.phone_number})
                </h3>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Audio Player Card */}
              {selectedCall.recording_url && (
                <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleAudio(selectedCall.recording_url, selectedCall.id)}
                      className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm cursor-pointer transition-all"
                    >
                      {playingAudioId === selectedCall.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className="font-bold text-xs text-blue-950">AI Edge-TTS Neural Voice Recording</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">
                        Language: {getLanguageLabel(selectedCall.preferred_language)} • {selectedCall.duration_seconds}s Duration
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-800 bg-white px-2.5 py-1 rounded-xl border border-blue-200">
                    Agent: {selectedCall.agent_name || 'Sarah Jenkins'}
                  </span>
                </div>
              )}

              {/* Summary */}
              {selectedCall.summary && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Automated AI Call Summary</p>
                  <p className="text-xs text-slate-800 mt-1 leading-relaxed font-medium">
                    {selectedCall.summary}
                  </p>
                </div>
              )}

              {/* Retry Rules & Safeguards */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Retry Count</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedCall.retry_count || 0} / 3 Max</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Duplicate Protection</p>
                  <p className="font-bold text-emerald-600 mt-0.5">Active (60m Window)</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Escalation Status</p>
                  <p className={`font-bold mt-0.5 ${selectedCall.escalated_to_human ? 'text-purple-600' : 'text-slate-600'}`}>
                    {selectedCall.escalated_to_human ? 'Escalated to Human' : 'AI Handled'}
                  </p>
                </div>
              </div>

              {/* Turn-by-Turn Transcript */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-3">Conversation Transcript</p>
                <div className="space-y-3">
                  {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                    selectedCall.transcript.map((turn, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-2xl text-xs max-w-[85%] ${
                          turn.speaker === 'ai'
                            ? 'bg-blue-600 text-white ml-auto rounded-tr-xs'
                            : 'bg-slate-100 text-slate-800 mr-auto rounded-tl-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                          <span className="font-bold">
                            {turn.speaker === 'ai' ? (turn.agent_name || selectedCall.agent_name || 'AI Voice Agent') : selectedCall.customer_name || 'Customer'}
                          </span>
                          <span>{turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <p className="leading-relaxed">{turn.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No turns logged for this call session.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleEscalateCall(selectedCall.id)}
                disabled={escalateLoading === selectedCall.id || selectedCall.escalated_to_human}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs flex items-center space-x-2 cursor-pointer transition-all border border-purple-200"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{selectedCall.escalated_to_human ? 'Escalated' : 'Escalate to Human Desk'}</span>
              </button>

              <button
                onClick={() => handleRetryCall(selectedCall.id)}
                disabled={retryLoading === selectedCall.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center space-x-2 cursor-pointer transition-all shadow-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${retryLoading === selectedCall.id ? 'animate-spin' : ''}`} />
                <span>Trigger Retry Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Automated Call Trigger Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Initiate Automated Customer AI Call</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Launch an AI voice session across any of the 8 support categories.
                </p>
              </div>
              <button
                onClick={() => setShowTriggerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerSubmit} className="p-5 space-y-4">
              {triggerSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{triggerSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Support Category</label>
                <select
                  value={triggerCategory}
                  onChange={(e) => setTriggerCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                >
                  <option value="ORDER_CONFIRMATION">Order Confirmations</option>
                  <option value="PAYMENT_CONFIRMATION">Payment Confirmations</option>
                  <option value="PAYMENT_FAILURE">Payment Failures</option>
                  <option value="ORDER_DELAY">Order Delays</option>
                  <option value="APPOINTMENT_CONFIRMATION">Appointment Confirmations</option>
                  <option value="APPOINTMENT_RESCHEDULE">Appointment Rescheduled / Delayed</option>
                  <option value="CUSTOMER_FEEDBACK">Customer Feedback</option>
                  <option value="CUSTOMER_COMPLAINT">Customer Complaints</option>
                  <option value="ORDER_CANCELLED">Order Cancellations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Mobile Phone Number</label>
                <input
                  type="text"
                  value={triggerPhone}
                  onChange={(e) => setTriggerPhone(e.target.value)}
                  placeholder="+91-98401-00000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Voice Language</label>
                  <select
                    value={triggerLanguage}
                    onChange={(e) => setTriggerLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                  >
                    <option value="ta">Tamil (தமிழ்) - Karthik</option>
                    <option value="en">English - Sarah Jenkins</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Call Flow Simulation</label>
                  <select
                    value={triggerOutcome}
                    onChange={(e) => setTriggerOutcome(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                  >
                    <option value="SUCCESS">Confirmed / Success</option>
                    <option value="QUESTION_ANSWERED">Customer Questions Answered</option>
                    <option value="CANCEL_REQUESTED">Cancellation Requested</option>
                    <option value="NOT_ANSWERED">Not Answered (Retry Scheduled)</option>
                    <option value="FAILED">Network Dropped / Failed</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={triggerDispatching}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-sm shadow-blue-500/20 transition-all"
                >
                  {triggerDispatching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing Voice & Calling...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Dispatch Outbound AI Call</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
