import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Headphones,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Package,
  Calendar,
  AlertOctagon,
  Search,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Send,
  Radio,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, CallRecord, Customer, Order, Appointment, Complaint } from '../services/api';
import { webrtcService } from '../services/webrtcService';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

export const AgentConsoleView: React.FC = () => {
  const { user, logout } = useAuth();
  const [agentStatus, setAgentStatus] = useState<'AVAILABLE' | 'ON_CALL' | 'BREAK' | 'OFFLINE'>('AVAILABLE');

  // Real-time incoming call queue
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [agentReplyInput, setAgentReplyInput] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);

  // Lookup data & tools
  const [activeToolTab, setActiveToolTab] = useState<'orders' | 'appointments' | 'complaints' | 'outbound'>('orders');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);

  // Search queries for lookups
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Outbound Call State
  const [outboundPhone, setOutboundPhone] = useState<string>('+1-415-555-0142');
  const [outboundPurpose, setOutboundPurpose] = useState<string>('Appointment Reminder');
  const [outboundStarting, setOutboundStarting] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const incomingRingIntervalRef = useRef<any>(null);
  const agentSocketRef = useRef<WebSocket | null>(null);
  const activeCallSocketRef = useRef<WebSocket | null>(null);

  // Connect WebSockets and load data
  useEffect(() => {
    loadConsoleData();
    pollPendingCalls();
    initAgentWebSocket();

    // 2-second fallback polling interval for resilient cross-tab detection
    const interval = setInterval(pollPendingCalls, 2000);
    return () => {
      clearInterval(interval);
      stopIncomingRingtone();
      if (agentSocketRef.current) agentSocketRef.current.close();
      if (activeCallSocketRef.current) activeCallSocketRef.current.close();
      webrtcService.close();
    };
  }, []);

  // Duration Timer
  useEffect(() => {
    if (activeCall) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall]);

  const initAgentWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/live-calls/ws/agent-calls`;
      const ws = new WebSocket(wsUrl);
      agentSocketRef.current = ws;

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'INCOMING_CALL') {
            setIncomingCalls((prev) => {
              const incId = data.call.id || data.call.call_id;
              if (prev.find((c) => (c.id || c.call_id) === incId)) return prev;
              return [...prev, data.call];
            });
            startIncomingRingtone();

          } else if (data.event === 'SYNC_PENDING') {
            if (data.calls && data.calls.length > 0) {
              setIncomingCalls(data.calls);
              startIncomingRingtone();
            }

          } else if (data.event === 'CALL_ACCEPTED') {
            setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== data.call_id));
            stopIncomingRingtone();

          } else if (data.event === 'CALL_REJECTED') {
            setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== data.call_id));
            stopIncomingRingtone();

          } else if (data.event === 'CALL_ENDED') {
            if (activeCall && (activeCall.id === data.call_id || activeCall.call_id === data.call_id)) {
              webrtcService.close();
              if (activeCallSocketRef.current) activeCallSocketRef.current.close();
              setActiveCall(null);
              setAgentStatus('AVAILABLE');
              loadConsoleData();
            }

          } else if (data.event === 'TRANSCRIPT_TURN') {
            const t = data.turn;
            if (t) {
              setTranscript((prev) => [
                ...prev,
                { speaker: t.speaker || 'customer', text: t.reply_text || t.user_query, timestamp: t.timestamp || new Date().toLocaleTimeString() }
              ]);
            }

          } else if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(data.event)) {
            await webrtcService.handleSignalMessage(data);
          }
        } catch (err) {
          console.error('[Agent Console WebSocket] Message parse error:', err);
        }
      };

      ws.onerror = (e) => {
        console.warn('[Agent Console WebSocket] Error:', e);
      };

      ws.onclose = () => {
        console.log('[Agent Console WebSocket] Closed. Retrying in 3s...');
        setTimeout(initAgentWebSocket, 3000);
      };
    } catch (e) {
      console.warn('Failed to initialize Agent WebSocket:', e);
    }
  };

  const loadConsoleData = async () => {
    try {
      const [custRes, ordRes, apptRes, compRes, callRes] = await Promise.all([
        api.listCustomers(),
        api.listOrders(),
        api.listAppointments(),
        api.listComplaints(),
        api.listCalls({ limit: 8 })
      ]);
      setCustomers(custRes.data);
      setOrders(ordRes.data);
      setAppointments(apptRes.data);
      setComplaints(compRes.data);
      setRecentCalls(callRes.data);
    } catch (e) {
      console.warn('Failed to load console data', e);
    }
  };

  const pollPendingCalls = async () => {
    try {
      const res = await api.getPendingCallRequests();
      const calls = res.data || [];
      setIncomingCalls(calls);
      if (calls.length > 0 && !activeCall) {
        startIncomingRingtone();
      } else {
        stopIncomingRingtone();
      }
    } catch (e) {}
  };

  const startIncomingRingtone = () => {
    if (incomingRingIntervalRef.current) return;
    const playRing = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {}
    };
    playRing();
    incomingRingIntervalRef.current = setInterval(playRing, 2200);
  };

  const stopIncomingRingtone = () => {
    if (incomingRingIntervalRef.current) {
      clearInterval(incomingRingIntervalRef.current);
      incomingRingIntervalRef.current = null;
    }
  };

  const handleAcceptCall = async (callIdInput: any) => {
    const callId = typeof callIdInput === 'string' ? callIdInput : (callIdInput?.id || callIdInput?.call_id);
    if (!callId) {
      console.error('No call ID provided to handleAcceptCall');
      return;
    }
    stopIncomingRingtone();

    let acceptedCallData: any = null;
    try {
      const res = await api.acceptCall(callId, user?.id || 'agent');
      acceptedCallData = res.data;
      setActiveCall(acceptedCallData);
      setAgentStatus('ON_CALL');
      setTranscript(acceptedCallData.transcript || []);
      setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== callId));
    } catch (err: any) {
      console.error('Failed to accept call via API:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to accept call';
      alert(detail);
      return;
    }

    // Connect to call-specific WebSocket and initialize WebRTC
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
      const callWs = new WebSocket(`${protocol}//${host}/api/v1/live-calls/ws/${callId}`);
      activeCallSocketRef.current = callWs;

      callWs.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(msg.event)) {
            await webrtcService.handleSignalMessage(msg);
          } else if (msg.event === 'TRANSCRIPT_TURN' || msg.event === 'ai_response') {
            const t = msg.turn || msg;
            setTranscript((prev) => [
              ...prev,
              { speaker: t.speaker || 'ai', text: t.reply_text || t.user_query, timestamp: t.timestamp || new Date().toLocaleTimeString() }
            ]);
          } else if (msg.event === 'CALL_ENDED') {
            webrtcService.close();
            setActiveCall(null);
            setAgentStatus('AVAILABLE');
            loadConsoleData();
          }
        } catch (e) {
          console.warn('Error in callWs message handler:', e);
        }
      };

      // Initialize WebRTC as Receiver
      await webrtcService.initializeConnection(callId, false, (signalMsg) => {
        if (callWs.readyState === WebSocket.OPEN) {
          callWs.send(JSON.stringify(signalMsg));
        } else if (agentSocketRef.current?.readyState === WebSocket.OPEN) {
          agentSocketRef.current.send(JSON.stringify(signalMsg));
        }
      });
    } catch (rtcErr: any) {
      console.warn('WebRTC audio receiver warning (non-fatal):', rtcErr);
    }
  };

  const handleRejectCall = async (callIdInput: any) => {
    const callId = typeof callIdInput === 'string' ? callIdInput : (callIdInput?.id || callIdInput?.call_id);
    if (!callId) return;
    try {
      stopIncomingRingtone();
      await api.rejectCall(callId, 'Rejected by agent');
      setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== callId));
    } catch (err) {
      console.error('Failed to reject call', err);
    }
  };

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentReplyInput.trim() || !activeCall) return;

    const text = agentReplyInput.trim();
    setAgentReplyInput('');
    const cId = activeCall.id || activeCall.call_id;

    try {
      setTranscript((prev) => [
        ...prev,
        { speaker: 'agent', text, timestamp: new Date().toLocaleTimeString() }
      ]);
      await api.agentSpeak(cId, text, activeCall.language || 'en');
    } catch (err) {
      console.error('Error sending agent reply', err);
    }
  };

  const handleEndActiveCall = async () => {
    if (!activeCall) return;
    try {
      const cId = activeCall.id || activeCall.call_id;
      await api.endCall(cId, 'RESOLVED_BY_AI');
      webrtcService.close();
      if (activeCallSocketRef.current) activeCallSocketRef.current.close();
      setActiveCall(null);
      setAgentStatus('AVAILABLE');
      loadConsoleData();
    } catch (e) {
      webrtcService.close();
      setActiveCall(null);
      setAgentStatus('AVAILABLE');
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webrtcService.setMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    webrtcService.setSpeaker(next);
  };

  const handleStartOutboundCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutboundStarting(true);
    try {
      const res = await api.startCall(outboundPhone, 'en');
      setActiveCall(res.data);
      setAgentStatus('ON_CALL');
      setTranscript([
        {
          speaker: 'ai',
          text: `Outbound call initiated to ${outboundPhone} regarding: ${outboundPurpose}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start outbound call');
    } finally {
      setOutboundStarting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Console Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-700">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
                  NEXORA AI Agent Console
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                  Operator Desk
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Live Voice Reception, WebRTC Audio & Telephony Dispatch</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Availability State Selector */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 font-semibold text-[11px]">Status:</span>
              <select
                value={agentStatus}
                onChange={(e: any) => setAgentStatus(e.target.value)}
                className={`px-3 py-1 text-xs font-bold rounded-xl border focus:outline-none cursor-pointer ${
                  agentStatus === 'AVAILABLE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : agentStatus === 'ON_CALL'
                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                <option value="AVAILABLE">● Available (Listening for Calls)</option>
                <option value="ON_CALL">● In Live Call</option>
                <option value="BREAK">● On Break</option>
                <option value="OFFLINE">○ Offline</option>
              </select>
            </div>

            {/* Profile & Sign Out */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 text-xs">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shadow-xs">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-bold text-slate-800 leading-none">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 text-xs font-semibold text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Real-time Incoming Call Alert Banner */}
        {incomingCalls.length > 0 && (
          <div className="space-y-3">
            {incomingCalls.map((call) => (
              <div
                key={call.id || call.call_id}
                className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 ring-4 ring-blue-300 animate-pulse"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3.5 bg-white/20 rounded-2xl ring-2 ring-white/40">
                    <PhoneIncoming className="w-7 h-7 animate-bounce text-white" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm uppercase tracking-wide">
                        Incoming Customer Call Request
                      </span>
                      <span className="text-[11px] bg-white/30 text-white px-2.5 py-0.5 rounded-full font-bold uppercase">
                        {call.language === 'ta' ? 'Tamil (தமிழ்)' : call.language === 'hi' ? 'Hindi (हिन्दी)' : call.language === 'te' ? 'Telugu (తెలుగు)' : call.language === 'ml' ? 'Malayalam (മലയാളം)' : 'English'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-100 mt-1">
                      Customer: <span className="font-extrabold text-white text-sm">{call.caller_name || 'Customer'}</span> • Mobile: <span className="font-mono font-bold text-white">{call.caller_number}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleAcceptCall(call.id || call.call_id)}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer transform hover:scale-105"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accept & Connect Call</span>
                  </button>
                  <button
                    onClick={() => handleRejectCall(call.id || call.call_id)}
                    className="px-4 py-2.5 bg-rose-500/80 hover:bg-rose-600 text-white font-semibold text-xs rounded-2xl transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Call Screen & Live Transcript (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Call Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-2xl ${
                    activeCall ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">
                      {activeCall ? 'Live Call Connected • WebRTC Two-Way Audio' : 'Reception Channel Idle'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {activeCall
                        ? `Connected with ${activeCall.caller_number} in [${(activeCall.language || 'en').toUpperCase()}]`
                        : 'Agent Console is Available. Waiting for incoming customer calls.'}
                    </p>
                  </div>
                </div>

                {activeCall && (
                  <div className="flex items-center space-x-2">
                    <div className="font-mono text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatSeconds(callDuration)}</span>
                    </div>

                    <button
                      onClick={toggleMute}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isMuted ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={toggleSpeaker}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        !speakerEnabled ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      title={speakerEnabled ? 'Mute Audio' : 'Enable Audio'}
                    >
                      {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={handleEndActiveCall}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>End Call</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Live Transcript Stream */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 h-80 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Real-Time Conversation Stream</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {transcript.length} turns
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-2">
                  {transcript.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs space-y-1">
                      <Headphones className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-500">No active audio transcript</p>
                      <p className="text-[11px]">When a customer speaks or turns are recognized, live text streams here.</p>
                    </div>
                  ) : (
                    transcript.map((t, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${t.speaker === 'customer' ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] font-semibold text-slate-400 mb-0.5 px-1">
                          {t.speaker === 'customer' ? 'Customer' : t.speaker === 'agent' ? 'You (Agent)' : 'NEXORA AI Receptionist'}
                          {t.timestamp && ` • ${t.timestamp}`}
                        </span>
                        <div
                          className={`p-2.5 rounded-xl max-w-sm text-xs leading-relaxed ${
                            t.speaker === 'customer'
                              ? 'bg-white border border-slate-200 text-slate-800'
                              : t.speaker === 'agent'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-indigo-600 text-white shadow-xs'
                          }`}
                        >
                          {t.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Agent Intervene / Speech Turn Input */}
                {activeCall && (
                  <form onSubmit={handleSendAgentReply} className="pt-2 border-t border-slate-200 flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Type message for the AI voice to speak back to the customer..."
                      value={agentReplyInput}
                      onChange={(e) => setAgentReplyInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Quick Human Handoff Dispatch Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Specialist Human Escalation Desk</h4>
                  <p className="text-[11px] text-slate-500">Transfer complex or sensitive calls to a dedicated senior department.</p>
                </div>
              </div>
              <button
                disabled={!activeCall}
                onClick={() => alert('Call escalated and dispatched to human specialist.')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Transfer to Human
              </button>
            </div>
          </div>

          {/* Right Column: Orders, Appointments & Outbound Lookups (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col h-[520px]">
              {/* Tool Switcher Tabs */}
              <div className="flex items-center space-x-1 pb-3 border-b border-slate-100 overflow-x-auto text-xs font-semibold">
                <button
                  onClick={() => setActiveToolTab('orders')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeToolTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Orders
                </button>
                <button
                  onClick={() => setActiveToolTab('appointments')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeToolTab === 'appointments' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Appointments
                </button>
                <button
                  onClick={() => setActiveToolTab('complaints')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeToolTab === 'complaints' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Complaints
                </button>
                <button
                  onClick={() => setActiveToolTab('outbound')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeToolTab === 'outbound' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Outbound Call
                </button>
              </div>

              {/* Tool Search Bar */}
              {activeToolTab !== 'outbound' && (
                <div className="pt-3 pb-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={`Search ${activeToolTab}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto pt-2 space-y-2.5 text-xs">
                {activeToolTab === 'orders' && (
                  orders
                    .filter((o) => !searchQuery || o.order_number.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((ord) => (
                      <div key={ord.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-700">{ord.order_number}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            {ord.status}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          {ord.courier_name} • Track: <span className="font-mono font-bold text-slate-800">{ord.tracking_number}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Amount: {ord.currency} {ord.total_amount?.toFixed(2)} ({ord.payment_status})
                        </p>
                      </div>
                    ))
                )}

                {activeToolTab === 'appointments' && (
                  appointments
                    .filter((a) => !searchQuery || a.service_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((appt) => (
                      <div key={appt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-700">{appt.appointment_number}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {appt.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">{appt.service_name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{appt.scheduled_time}</p>
                      </div>
                    ))
                )}

                {activeToolTab === 'complaints' && (
                  complaints
                    .filter((c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((comp) => (
                      <div key={comp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-600">{comp.ticket_number}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            {comp.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">{comp.title}</p>
                        <p className="text-[11px] text-slate-500">{comp.description}</p>
                      </div>
                    ))
                )}

                {activeToolTab === 'outbound' && (
                  <form onSubmit={handleStartOutboundCall} className="space-y-3 pt-2">
                    <p className="text-[11px] text-slate-500">
                      Initiate an authorized automated outbound voice call to a customer using the AI receptionist.
                    </p>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Customer Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={outboundPhone}
                        onChange={(e) => setOutboundPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Call Purpose</label>
                      <select
                        value={outboundPurpose}
                        onChange={(e) => setOutboundPurpose(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="Appointment Reminder">Appointment Reminder</option>
                        <option value="Order Dispatch Update">Order Dispatch Update</option>
                        <option value="Payment Confirmation">Payment Confirmation</option>
                        <option value="Customer Feedback">Customer Feedback</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={outboundStarting || !!activeCall}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <PhoneOutgoing className="w-4 h-4" />
                      <span>{outboundStarting ? 'Connecting...' : 'Dial Outbound Call'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
