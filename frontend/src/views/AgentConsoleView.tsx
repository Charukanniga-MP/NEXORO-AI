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
  Users,
  Activity,
  BarChart2,
  MessageSquare,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Plus,
  Check,
  ShieldCheck,
  Settings,
  Bell,
  BellOff,
  ArrowUpRight,
  ArrowDownLeft,
  Sliders,
  Globe,
  Layers,
  PhoneForwarded,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, CallRecord, Customer, Order, Appointment, Complaint } from '../services/api';
import { webrtcService } from '../services/webrtcService';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

interface ConsoleStats {
  calls_today: number;
  waiting_calls: number;
  active_calls: number;
  avg_duration_seconds: number;
}

interface TranscriptTurn {
  speaker: 'customer' | 'ai' | 'agent' | 'system';
  text: string;
  timestamp?: string;
  language?: string;
  sentiment?: string;
  grounded?: boolean;
  tts?: any;
}

export const AgentConsoleView: React.FC = () => {
  const { user, logout } = useAuth();
  const [agentStatus, setAgentStatus] = useState<'AVAILABLE' | 'BUSY' | 'ON_CALL' | 'BREAK' | 'OFFLINE'>('AVAILABLE');

  // Live Statistics
  const [stats, setStats] = useState<ConsoleStats>({
    calls_today: 0,
    waiting_calls: 0,
    active_calls: 0,
    avg_duration_seconds: 0
  });

  // Call Queue & Active Call State
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [agentReplyInput, setAgentReplyInput] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [activeCallLanguage, setActiveCallLanguage] = useState<string>('en');

  // Customer Profile for Active Call
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [notesSaved, setNotesSaved] = useState<boolean>(false);

  // Right-Side Tool Tabs
  const [activeToolTab, setActiveToolTab] = useState<'orders' | 'appointments' | 'complaints' | 'outbound'>('orders');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appointmentFilter, setAppointmentFilter] = useState<string>('ALL');
  const [complaintFilter, setComplaintFilter] = useState<string>('ALL');

  // Outbound Call State
  const [outboundPhone, setOutboundPhone] = useState<string>('+91-98401-22567');
  const [outboundCustomerName, setOutboundCustomerName] = useState<string>('');
  const [outboundPurpose, setOutboundPurpose] = useState<string>('Order Delivery Confirmation');
  const [outboundLanguage, setOutboundLanguage] = useState<string>('en');
  const [outboundStarting, setOutboundStarting] = useState<boolean>(false);
  const [outboundHistory, setOutboundHistory] = useState<any[]>([]);

  // Modals
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState<boolean>(false);
  const [newAppointmentData, setNewAppointmentData] = useState({
    customer_id: '',
    service_name: 'AI Voice Receptionist Consultation',
    scheduled_time: '',
    duration_minutes: 30,
    notes: ''
  });
  const [isNewComplaintOpen, setIsNewComplaintOpen] = useState<boolean>(false);
  const [newComplaintData, setNewComplaintData] = useState({
    customer_id: '',
    title: '',
    description: '',
    category: 'SERVICE_QUALITY',
    priority: 'HIGH'
  });
  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState<boolean>(false);
  const [escalationReason, setEscalationReason] = useState<string>('Customer Requested Senior Specialist');
  const [escalationDepartment, setEscalationDepartment] = useState<string>('Customer Support');
  const [escalationSummary, setEscalationSummary] = useState<string>('');
  const [escalationSubmitting, setEscalationSubmitting] = useState<boolean>(false);
  const [escalationSuccessMsg, setEscalationSuccessMsg] = useState<string | null>(null);

  // Transcript Preview Modal
  const [previewCallTranscript, setPreviewCallTranscript] = useState<CallRecord | null>(null);

  // Audio Testing States
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState<boolean>(false);
  const [ringtoneMuted, setRingtoneMuted] = useState<boolean>(false);
  const [micTesting, setMicTesting] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);

  // Refs
  const timerRef = useRef<any>(null);
  const incomingRingIntervalRef = useRef<any>(null);
  const agentSocketRef = useRef<WebSocket | null>(null);
  const activeCallSocketRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimRef = useRef<any>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const INDIAN_LANGUAGES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' },
    { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  ];

  // Auto-scroll transcript on new turn
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Load Console Data on Mount
  useEffect(() => {
    loadConsoleData();
    fetchStats();
    pollPendingCalls();
    initAgentWebSocket();

    // 2-second fallback polling interval
    const pollInterval = setInterval(() => {
      pollPendingCalls();
      fetchStats();
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      stopIncomingRingtone();
      if (agentSocketRef.current) agentSocketRef.current.close();
      if (activeCallSocketRef.current) activeCallSocketRef.current.close();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
      webrtcService.close();
    };
  }, []);

  // Duration Timer for active call
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

  // Load Customer CRM information when active call connects
  useEffect(() => {
    if (activeCall) {
      loadActiveCustomerProfile(activeCall);
      setActiveCallLanguage(activeCall.language || 'en');
    } else {
      setActiveCustomer(null);
      setCustomerNotes('');
      setNotesSaved(false);
    }
  }, [activeCall]);

  const fetchStats = async () => {
    try {
      const res = await api.getConsoleStats();
      setStats(res.data);
    } catch (e) {
      // Fallback calculation from local collections
      setStats((prev) => ({
        ...prev,
        waiting_calls: incomingCalls.length,
        active_calls: activeCall ? 1 : 0
      }));
    }
  };

  const loadConsoleData = async () => {
    try {
      const [custRes, ordRes, apptRes, compRes, callRes] = await Promise.all([
        api.listCustomers(),
        api.listOrders({ limit: 50 }),
        api.listAppointments({ limit: 50 }),
        api.listComplaints({ limit: 50 }),
        api.listCalls({ limit: 12 })
      ]);
      setCustomers(custRes.data);
      setOrders(ordRes.data);
      setAppointments(apptRes.data);
      setComplaints(compRes.data);
      setRecentCalls(callRes.data);

      // Filter outbound history
      const outbounds = callRes.data.filter((c) => c.direction === 'OUTBOUND');
      setOutboundHistory(outbounds);
    } catch (e) {
      console.warn('Failed to load console data', e);
    }
  };

  const loadActiveCustomerProfile = async (call: any) => {
    try {
      let cust: Customer | null = null;
      if (call.customer_id) {
        const res = await api.getCustomerById(call.customer_id);
        cust = res.data;
      } else if (call.caller_number) {
        // Find in customer list by phone
        const cleanPhone = call.caller_number.replace(/\D/g, '').slice(-10);
        cust = customers.find((c) => c.phone.replace(/\D/g, '').slice(-10) === cleanPhone) || null;
      }
      if (cust) {
        setActiveCustomer(cust);
        setCustomerNotes(cust.notes || '');
      } else {
        setActiveCustomer({
          id: call.customer_id || 'GUEST',
          company_id: 'default',
          customer_code: 'GUEST-CALLER',
          name: call.caller_name || 'Verified Caller',
          phone: call.caller_number,
          email: `${call.caller_number.replace(/\D/g, '')}@guest.nexora.ai`,
          preferred_language: call.language || 'en',
          tags: [],
          consent_for_outbound: true,
          dnd_opt_out: false,
          total_calls_count: 1,
          created_at: new Date().toISOString()
        } as unknown as Customer);
      }
    } catch (e) {
      console.warn('Error loading customer profile for call:', e);
    }
  };

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
            fetchStats();

          } else if (data.event === 'SYNC_PENDING') {
            if (data.calls && data.calls.length > 0) {
              setIncomingCalls(data.calls);
              startIncomingRingtone();
            } else {
              setIncomingCalls([]);
              stopIncomingRingtone();
            }
            fetchStats();

          } else if (data.event === 'CALL_ACCEPTED') {
            setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== data.call_id));
            stopIncomingRingtone();
            fetchStats();

          } else if (data.event === 'CALL_REJECTED') {
            setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== data.call_id));
            stopIncomingRingtone();
            fetchStats();

          } else if (data.event === 'CALL_ENDED') {
            if (activeCall && (activeCall.id === data.call_id || activeCall.call_id === data.call_id)) {
              webrtcService.close();
              if (activeCallSocketRef.current) activeCallSocketRef.current.close();
              setActiveCall(null);
              setAgentStatus('AVAILABLE');
              loadConsoleData();
              fetchStats();
            }

          } else if (data.event === 'TRANSCRIPT_TURN') {
            const t = data.turn;
            if (t) {
              handleIncomingTurn(t);
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

  const handleIncomingTurn = (t: any) => {
    // If turn has both user query and reply text, push both turns distinctly
    if (t.user_query && t.reply_text && t.speaker === 'ai') {
      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'customer',
          text: t.user_query,
          timestamp: t.timestamp || new Date().toLocaleTimeString(),
          language: t.language
        },
        {
          speaker: 'ai',
          text: t.reply_text,
          timestamp: t.timestamp || new Date().toLocaleTimeString(),
          language: t.language,
          sentiment: t.sentiment,
          tts: t.tts
        }
      ]);
    } else {
      setTranscript((prev) => [
        ...prev,
        {
          speaker: t.speaker || 'customer',
          text: t.text || t.reply_text || t.user_query,
          timestamp: t.timestamp || new Date().toLocaleTimeString(),
          language: t.language,
          sentiment: t.sentiment,
          tts: t.tts
        }
      ]);
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
    if (ringtoneMuted) return;
    if (incomingRingIntervalRef.current) return;
    const playRing = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(650, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
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
      setActiveCallLanguage(acceptedCallData.language || 'en');

      // Setup initial greeting turn
      const greeting = acceptedCallData.greeting_text || acceptedCallData.greeting || 'Welcome to Khaira Company!';
      setTranscript([
        {
          speaker: 'system',
          text: `WebRTC Two-Way Audio connected with ${acceptedCallData.caller_number}.`,
          timestamp: new Date().toLocaleTimeString()
        },
        {
          speaker: 'ai',
          text: greeting,
          timestamp: new Date().toLocaleTimeString(),
          language: acceptedCallData.language || 'en'
        }
      ]);
      setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== callId));
      fetchStats();
    } catch (err: any) {
      console.error('Failed to accept call via API:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to accept call';
      alert(detail);
      return;
    }

    await connectCallAudio(callId, false);
  };

  const connectCallAudio = async (callId: string, isInitiator: boolean = false) => {
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
            handleIncomingTurn(t);
          } else if (msg.event === 'CALL_ENDED') {
            webrtcService.close();
            setActiveCall(null);
            setAgentStatus('AVAILABLE');
            loadConsoleData();
            fetchStats();
          }
        } catch (e) {
          console.warn('Error in callWs message handler:', e);
        }
      };

      await webrtcService.initializeConnection(callId, isInitiator, (signalMsg) => {
        if (callWs.readyState === WebSocket.OPEN) {
          callWs.send(JSON.stringify(signalMsg));
        } else if (agentSocketRef.current?.readyState === WebSocket.OPEN) {
          agentSocketRef.current.send(JSON.stringify(signalMsg));
        }
      });
    } catch (rtcErr: any) {
      console.warn('WebRTC audio connection warning:', rtcErr);
    }
  };

  const handleRejectCall = async (callIdInput: any) => {
    const callId = typeof callIdInput === 'string' ? callIdInput : (callIdInput?.id || callIdInput?.call_id);
    if (!callId) return;
    try {
      stopIncomingRingtone();
      await api.rejectCall(callId, 'Rejected by agent');
      setIncomingCalls((prev) => prev.filter((c) => (c.id || c.call_id) !== callId));
      fetchStats();
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
        { speaker: 'agent', text, timestamp: new Date().toLocaleTimeString(), language: activeCallLanguage }
      ]);
      await api.agentSpeak(cId, text, activeCallLanguage);
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
      fetchStats();
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
    setTranscript((prev) => [
      ...prev,
      {
        speaker: 'system',
        text: next ? 'Microphone muted by Agent.' : 'Microphone unmuted by Agent.',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const toggleHold = () => {
    const next = !isOnHold;
    setIsOnHold(next);
    webrtcService.setMuted(next);
    setTranscript((prev) => [
      ...prev,
      {
        speaker: 'system',
        text: next ? 'Call placed on hold by Agent.' : 'Call resumed from hold by Agent.',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const toggleSpeaker = () => {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    webrtcService.setSpeaker(next);
  };

  const handleChangeLanguage = async (newLang: string) => {
    if (!activeCall) return;
    const cId = activeCall.id || activeCall.call_id;
    try {
      setActiveCallLanguage(newLang);
      await api.changeCallLanguage(cId, newLang);
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  const handleSaveCustomerNotes = async () => {
    if (!activeCustomer || activeCustomer.id === 'GUEST') return;
    try {
      await api.updateCustomer(activeCustomer.id, { notes: customerNotes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save customer notes', e);
    }
  };

  const handleStartOutboundCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundPhone.trim()) return;
    setOutboundStarting(true);
    try {
      const res = await api.agentCallCustomer({
        phone: outboundPhone.trim(),
        customer_name: outboundCustomerName.trim() || undefined,
        language: outboundLanguage,
        purpose: outboundPurpose,
        agent_id: user?.id,
        agent_name: user?.full_name || 'Agent Operator'
      });
      const data = res.data;
      if (data.status === 'OFFLINE') {
        alert(`Customer is offline.\n\n${data.message || 'A callback request has been logged in appointments.'}`);
        setOutboundStarting(false);
        return;
      }

      const callData = data.call || { id: data.call_id, caller_number: outboundPhone, direction: 'OUTBOUND', status: 'RINGING' };
      setActiveCall(callData);
      setAgentStatus('ON_CALL');
      setActiveCallLanguage(outboundLanguage);
      setTranscript([
        {
          speaker: 'system',
          text: `Ringing customer ${outboundPhone} (${outboundCustomerName || 'Customer'})... Waiting for customer to accept call.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);

      const cId = data.call_id || callData.id;
      if (cId) {
        connectCallAudio(cId, true);
      }
      loadConsoleData();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start outbound call');
    } finally {
      setOutboundStarting(false);
    }
  };

  const handleOpenEscalationModal = () => {
    // Generate intelligent conversation summary from recent transcript turns
    const recentConvo = transcript
      .filter((t) => t.speaker !== 'system')
      .slice(-4)
      .map((t) => `${t.speaker === 'customer' ? 'Customer' : 'AI'}: ${t.text}`)
      .join(' | ');

    setEscalationSummary(recentConvo || `Customer ${activeCall?.caller_number} requires specialist intervention.`);
    setIsEscalationModalOpen(true);
  };

  const handleConfirmEscalation = async () => {
    if (!activeCall) return;
    const cId = activeCall.id || activeCall.call_id;
    setEscalationSubmitting(true);
    try {
      const res = await api.transferCall(cId, {
        reason: escalationReason,
        department: escalationDepartment,
        summary: escalationSummary,
        priority: 'HIGH'
      });
      setEscalationSuccessMsg(res.data.message || 'Call transferred successfully.');
      setTimeout(() => {
        setIsEscalationModalOpen(false);
        setEscalationSuccessMsg(null);
        handleEndActiveCall();
      }, 2000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to transfer call');
    } finally {
      setEscalationSubmitting(false);
    }
  };

  // Appointment Actions
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAppointment({
        ...newAppointmentData,
        customer_id: newAppointmentData.customer_id || (activeCustomer ? activeCustomer.id : customers[0]?.id || 'CUST-1')
      });
      setIsNewAppointmentOpen(false);
      loadConsoleData();
      alert('Appointment booked successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to create appointment');
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: string) => {
    try {
      await api.updateAppointment(id, { status });
      loadConsoleData();
    } catch (e) {
      console.error(e);
    }
  };

  // Complaint Actions
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createComplaint({
        ...newComplaintData,
        customer_id: newComplaintData.customer_id || (activeCustomer ? activeCustomer.id : customers[0]?.id || 'CUST-1')
      });
      setIsNewComplaintOpen(false);
      loadConsoleData();
      alert('Complaint ticket filed successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to file complaint');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, status: string) => {
    try {
      await api.updateComplaint(id, { status });
      loadConsoleData();
    } catch (e) {
      console.error(e);
    }
  };

  // Audio Testing Methods
  const handleTestMic = async () => {
    if (micTesting) {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
      setMicTesting(false);
      setMicLevel(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicTesting(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micAnimRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      alert('Microphone access denied or unattached.');
    }
  };

  const handleTestSpeaker = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* 1. TOP CONSOLE NAVIGATION BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-xl text-white shadow-sm">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
                  NEXORA AI Agent Console
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                  Operator Desk
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Live Voice Reception, WebRTC Audio & Telephony Dispatch</p>
            </div>
          </div>

          {/* Availability Status, Audio Testing & Agent Profile */}
          <div className="flex items-center space-x-4">
            {/* Availability State Selector */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 font-bold text-[11px] hidden sm:inline">Agent Status:</span>
              <select
                value={agentStatus}
                onChange={(e: any) => setAgentStatus(e.target.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border focus:outline-none cursor-pointer transition-colors shadow-2xs ${
                  agentStatus === 'AVAILABLE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : agentStatus === 'ON_CALL'
                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                    : agentStatus === 'BUSY'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <option value="AVAILABLE">● Available (Listening for Calls)</option>
                <option value="ON_CALL">● In Live Call</option>
                <option value="BUSY">● Busy / In Task</option>
                <option value="BREAK">● On Break</option>
                <option value="OFFLINE">○ Offline</option>
              </select>
            </div>

            {/* Audio Settings & Ringtone Toggle */}
            <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
              <button
                onClick={() => setRingtoneMuted(!ringtoneMuted)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  ringtoneMuted ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={ringtoneMuted ? 'Ringtone Muted (Click to Unmute)' : 'Ringtone Active'}
              >
                {ringtoneMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsAudioSettingsOpen(true)}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Microphone & Audio Device Diagnostics"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info & Sign Out */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 text-xs">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black flex items-center justify-center shadow-xs">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="hidden md:block text-left">
                <p className="font-extrabold text-slate-800 leading-none">{user?.full_name}</p>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1 rounded uppercase">
                    {user?.role || 'AGENT'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {user?.phone || user?.email}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="ml-1 text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* SECTION B: LIVE DASHBOARD METRICS (4 CARDS) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Calls Today</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.calls_today}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Logged calls today</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <PhoneCall className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Waiting in Queue</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 flex items-center space-x-2">
                <span>{incomingCalls.length || stats.waiting_calls}</span>
                {incomingCalls.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Pending call requests</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <PhoneIncoming className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Calls</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {activeCall ? 1 : stats.active_calls}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {activeCall ? 'Live Call in Progress' : 'Channels Free'}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${activeCall ? 'bg-emerald-50 text-emerald-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Call Duration</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {formatSeconds(Math.round(stats.avg_duration_seconds || 165))}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Based on completed calls</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* SECTION C: VISIBLE INCOMING CALLS QUEUE PANEL */}
        {incomingCalls.length > 0 && (
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-3xl p-5 text-white shadow-xl ring-4 ring-blue-300 animate-in fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Live Incoming Call Queue ({incomingCalls.length} Waiting)
                </h3>
              </div>
              <span className="text-[11px] bg-white/20 px-3 py-1 rounded-full font-bold">
                Ringing on Agent Headset
              </span>
            </div>

            <div className="space-y-3">
              {incomingCalls.map((call) => (
                <div
                  key={call.id || call.call_id}
                  className="bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="p-3 bg-white/20 rounded-xl text-white">
                      <PhoneIncoming className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-black text-base text-white">
                          {call.caller_name || 'Customer'}
                        </span>
                        <span className="text-[10px] bg-white/30 text-white font-mono px-2 py-0.5 rounded">
                          {call.customer_id || 'CUST-2026-GUEST'}
                        </span>
                        <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-2 py-0.5 rounded uppercase">
                          {call.language === 'ta' ? 'Tamil (தமிழ்)' : call.language === 'hi' ? 'Hindi (हिन्दी)' : call.language === 'te' ? 'Telugu (తెలుగు)' : call.language === 'ml' ? 'Malayalam (മലയാളം)' : 'English'}
                        </span>
                      </div>
                      <p className="text-xs text-blue-100 font-mono mt-0.5">
                        Mobile: <span className="font-bold text-white">{call.caller_number}</span> • Call ID: <span className="opacity-80 font-mono text-[10px]">{(call.id || call.call_id).slice(0, 12)}...</span>
                      </p>
                      <p className="text-[11px] text-amber-200 mt-1 font-semibold">
                        Intent: {call.reason || 'Autonomous AI Voice Assistance & Customer Inquiry'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleAcceptCall(call.id || call.call_id)}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept & Connect Call</span>
                    </button>
                    <button
                      onClick={() => handleRejectCall(call.id || call.call_id)}
                      className="px-4 py-2.5 bg-rose-500/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKSPACE GRID: Left (Active/Idle Screen) + Right (Tools & Data) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: ACTIVE CONVERSATION PANEL OR IDLE HUB */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Call Card OR Idle Readiness Hub */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-2xl ${
                    activeCall ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {activeCall ? <Radio className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-base">
                      {activeCall ? 'Active Live Call • WebRTC Audio Stream' : 'AI Reception Channels Ready'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {activeCall
                        ? `Connected with ${activeCall.caller_number} [${activeCallLanguage.toUpperCase()}] • WebRTC Peer-to-Peer Audio`
                        : 'Agent Console is Available. Ready to receive incoming customer calls.'}
                    </p>
                  </div>
                </div>

                {/* Call Status & Timer Badge */}
                {activeCall && (
                  <div className="flex items-center space-x-2">
                    <div className="font-mono text-xs font-extrabold bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 shadow-inner">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                      <span>{formatSeconds(callDuration)}</span>
                    </div>

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

              {/* TELEPHONY CONTROLS BAR (When in Active Call) */}
              {activeCall ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Left: Device States */}
                  <div className="flex items-center space-x-2">
                    {/* Mic Toggle */}
                    <button
                      onClick={toggleMute}
                      className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                        isMuted
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isMuted ? 'Muted' : 'Mic Active'}</span>
                    </button>

                    {/* Hold Toggle */}
                    <button
                      onClick={toggleHold}
                      className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                        isOnHold
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isOnHold ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      <span>{isOnHold ? 'Resume Call' : 'Hold Call'}</span>
                    </button>

                    {/* Speaker Toggle */}
                    <button
                      onClick={toggleSpeaker}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        !speakerEnabled ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                      title={speakerEnabled ? 'Audio Output Active' : 'Audio Output Muted'}
                    >
                      {speakerEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Right: Language Switcher & Escalation Button */}
                  <div className="flex items-center space-x-2">
                    {/* Language Switcher */}
                    <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <select
                        value={activeCallLanguage}
                        onChange={(e) => handleChangeLanguage(e.target.value)}
                        className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                      >
                        {INDIAN_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label} ({l.native})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Human Escalation Trigger */}
                    <button
                      onClick={handleOpenEscalationModal}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Transfer to Human</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* IDLE STATE: RECEPTION READINESS HUB */
                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                      <div>
                        <p className="font-extrabold text-slate-800">WebRTC Engine</p>
                        <p className="text-[10px] text-slate-400">Two-Way Peer Audio Online</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-extrabold text-slate-800">Multilingual AI</p>
                        <p className="text-[10px] text-slate-400">5 Indian Languages Supported</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <div>
                        <p className="font-extrabold text-slate-800">Concurrency Max</p>
                        <p className="text-[10px] text-slate-400">50 Channels Allocated</p>
                      </div>
                    </div>
                  </div>

                  {/* Audio Device Test Widget */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Mic className="w-4 h-4 text-indigo-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Microphone & Audio Check</p>
                        <p className="text-[10px] text-slate-400">Verify your headset microphone before taking calls</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {micTesting && (
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${micLevel}%` }}
                          ></div>
                        </div>
                      )}
                      <button
                        onClick={handleTestMic}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          micTesting ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {micTesting ? 'Stop Mic Test' : 'Test Mic'}
                      </button>
                      <button
                        onClick={handleTestSpeaker}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Test Chime
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* REAL-TIME CONVERSATION STREAM */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col h-[340px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                  <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Real-Time Conversation Stream</span>
                  </span>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <span>{transcript.length} turns recorded</span>
                    {activeCall && (
                      <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-full text-[10px]">
                        Live Audio Transcribing
                      </span>
                    )}
                  </div>
                </div>

                {/* Transcript Scroll Area */}
                <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3 pr-2">
                  {transcript.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs space-y-2">
                      <Headphones className="w-10 h-10 text-slate-300 stroke-1" />
                      <p className="font-extrabold text-slate-600">Reception Channel Standby</p>
                      <p className="text-[11px] max-w-sm text-slate-400 leading-relaxed">
                        When an incoming call is accepted, recognized customer speech, AI answers, and telephony status stream here in real time.
                      </p>
                    </div>
                  ) : (
                    transcript.map((t, idx) => {
                      if (t.speaker === 'system') {
                        return (
                          <div key={idx} className="flex justify-center my-1">
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-3 py-1 rounded-full font-bold">
                              ℹ️ {t.text} • {t.timestamp}
                            </span>
                          </div>
                        );
                      }

                      const isCustomer = t.speaker === 'customer';
                      const isAgent = t.speaker === 'agent';

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                        >
                          <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-slate-400 font-semibold">
                            <span>
                              {isCustomer
                                ? activeCustomer?.name || 'Customer'
                                : isAgent
                                ? 'You (Human Agent)'
                                : 'NEXORA AI Receptionist'}
                            </span>
                            {t.timestamp && <span>• {t.timestamp}</span>}
                            {t.language && (
                              <span className="bg-slate-200 text-slate-700 px-1 rounded uppercase font-bold text-[9px]">
                                {t.language}
                              </span>
                            )}
                          </div>

                          <div
                            className={`p-3 rounded-2xl max-w-md text-xs leading-relaxed shadow-xs ${
                              isCustomer
                                ? 'bg-white border border-slate-200 text-slate-800'
                                : isAgent
                                ? 'bg-emerald-600 text-white font-medium'
                                : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium'
                            }`}
                          >
                            <p>{t.text}</p>
                            {t.tts?.audio_url && (
                              <button
                                onClick={() => {
                                  const a = new Audio(t.tts.audio_url);
                                  a.play();
                                }}
                                className="mt-1.5 text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded flex items-center space-x-1 cursor-pointer"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>Play Audio TTS</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Agent Speech Intervene Form */}
                {activeCall && (
                  <form onSubmit={handleSendAgentReply} className="pt-2 border-t border-slate-200 flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder={`Type message for AI voice to speak back in [${activeCallLanguage.toUpperCase()}]...`}
                      value={agentReplyInput}
                      onChange={(e) => setAgentReplyInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!agentReplyInput.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors cursor-pointer text-xs font-bold flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Speak</span>
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* SECTION F: CUSTOMER INFORMATION CRM PANEL (During Active Call) */}
            {activeCall && activeCustomer && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-sm overflow-hidden">
                      {activeCustomer.avatar_url ? (
                        <img src={activeCustomer.avatar_url} alt={activeCustomer.name} className="w-full h-full object-cover" />
                      ) : (
                        activeCustomer.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-black text-sm text-slate-900">{activeCustomer.name}</h4>
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                          {activeCustomer.customer_code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {activeCustomer.phone} • {activeCustomer.email || 'No email registered'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">Language</span>
                    <span className="text-xs font-black text-indigo-700 uppercase">
                      {activeCustomer.preferred_language || 'EN'}
                    </span>
                  </div>
                </div>

                {/* Customer Account Metrics */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Orders</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">
                      {orders.filter((o) => o.customer_id === activeCustomer.id).length || 3}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nexoro Balance</p>
                    <p className="text-base font-black text-emerald-600 mt-0.5">
                      ₹{(activeCustomer as any).wallet_balance || '500.00'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">City / Location</p>
                    <p className="text-xs font-extrabold text-slate-800 mt-1 truncate">
                      {(activeCustomer as any).city || 'Chennai, TN'}
                    </p>
                  </div>
                </div>

                {/* Call & Customer Notes Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Real-Time Interaction Notes</label>
                    <button
                      onClick={handleSaveCustomerNotes}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {notesSaved ? '✓ Saved!' : 'Save Notes'}
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Record notes from this phone conversation (issue, customer feedback, promises made)..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 5 COLUMNS: DATA & ACTION TABS (ORDERS, APPOINTMENTS, COMPLAINTS, OUTBOUND) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col h-[600px]">
              {/* Tool Switcher Tabs */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs font-bold">
                <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveToolTab('orders')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                      activeToolTab === 'orders' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Orders</span>
                  </button>

                  <button
                    onClick={() => setActiveToolTab('appointments')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                      activeToolTab === 'appointments' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Appts</span>
                  </button>

                  <button
                    onClick={() => setActiveToolTab('complaints')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                      activeToolTab === 'complaints' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Tickets</span>
                  </button>

                  <button
                    onClick={() => setActiveToolTab('outbound')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                      activeToolTab === 'outbound' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <PhoneOutgoing className="w-3.5 h-3.5" />
                    <span>Dial Outbound</span>
                  </button>
                </div>

                {/* Tab Context Actions */}
                {activeToolTab === 'appointments' && (
                  <button
                    onClick={() => setIsNewAppointmentOpen(true)}
                    className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer"
                    title="Book New Appointment"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {activeToolTab === 'complaints' && (
                  <button
                    onClick={() => setIsNewComplaintOpen(true)}
                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                    title="File New Ticket"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tool Search Filter (Except Outbound Tab) */}
              {activeToolTab !== 'outbound' && (
                <div className="pt-3 pb-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={`Search ${activeToolTab} by ID, customer name, product...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB CONTENT PANELS */}
              <div className="flex-1 overflow-y-auto pt-2 space-y-2.5 text-xs">
                {/* 1. ORDERS TAB */}
                {activeToolTab === 'orders' && (
                  orders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">No orders in database.</div>
                  ) : (
                    orders
                      .filter((o) => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          o.order_number.toLowerCase().includes(q) ||
                          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
                          (o.tracking_number && o.tracking_number.toLowerCase().includes(q))
                        );
                      })
                      .map((ord) => {
                        const firstItem = ord.items && ord.items.length > 0 ? ord.items[0] : null;
                        return (
                          <div
                            key={ord.id}
                            className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 hover:border-indigo-300 transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-indigo-700 text-xs">{ord.order_number}</span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                ord.payment_status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.payment_status} • ₹{Number(ord.total_amount).toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2.5">
                              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-0.5 overflow-hidden shrink-0 flex items-center justify-center">
                                {firstItem?.image_url ? (
                                  <img src={firstItem.image_url} alt="product" className="w-full h-full object-contain" />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 truncate">{firstItem?.name || 'Multiple Products'}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  Courier: {ord.courier_name || 'BlueDart'} • Track: {ord.tracking_number || 'NEX-8821'}
                                </p>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Status: <strong className="text-slate-800">{ord.status}</strong></span>
                              <button
                                onClick={() => setSelectedOrderDetails(ord)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                              >
                                View Order Details →
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )
                )}

                {/* 2. APPOINTMENTS TAB */}
                {activeToolTab === 'appointments' && (
                  appointments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">No appointments scheduled.</div>
                  ) : (
                    appointments
                      .filter((a) => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          a.appointment_number.toLowerCase().includes(q) ||
                          a.service_name.toLowerCase().includes(q)
                        );
                      })
                      .map((appt) => (
                        <div
                          key={appt.id}
                          className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-indigo-700">{appt.appointment_number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              appt.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                          <p className="font-extrabold text-slate-800">{appt.service_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Time: {new Date(appt.scheduled_time).toLocaleString()} ({appt.duration_minutes}m)
                          </p>
                          <div className="pt-1 flex items-center space-x-2">
                            {appt.status !== 'CONFIRMED' && (
                              <button
                                onClick={() => handleUpdateAppointmentStatus(appt.id, 'CONFIRMED')}
                                className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            {appt.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleUpdateAppointmentStatus(appt.id, 'CANCELLED')}
                                className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )
                )}

                {/* 3. COMPLAINTS & TICKETS TAB */}
                {activeToolTab === 'complaints' && (
                  complaints.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">No open complaints or tickets.</div>
                  ) : (
                    complaints
                      .filter((c) => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          c.ticket_number.toLowerCase().includes(q) ||
                          c.title.toLowerCase().includes(q) ||
                          c.description.toLowerCase().includes(q)
                        );
                      })
                      .map((comp) => (
                        <div
                          key={comp.id}
                          className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-rose-600">{comp.ticket_number}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              comp.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-700'
                                : comp.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {comp.priority} • {comp.status}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800">{comp.title}</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{comp.description}</p>
                          <div className="pt-1 flex items-center space-x-2">
                            {comp.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleUpdateComplaintStatus(comp.id, 'RESOLVED')}
                                className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )
                )}

                {/* 4. OUTBOUND CALL DIALER TAB */}
                {activeToolTab === 'outbound' && (
                  <form onSubmit={handleStartOutboundCall} className="space-y-3 pt-1">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs leading-relaxed">
                      Launch an automated or operator-driven outbound call with real-time speech and WebRTC audio.
                    </div>

                    {/* Customer Quick Auto-fill Picker */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">Select Customer from CRM</label>
                      <select
                        onChange={(e) => {
                          const c = customers.find((cust) => cust.id === e.target.value);
                          if (c) {
                            setOutboundPhone(c.phone);
                            setOutboundCustomerName(c.name);
                            if (c.preferred_language) setOutboundLanguage(c.preferred_language);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="">-- Choose Existing Customer --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) - {c.customer_code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">Customer Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={outboundPhone}
                        onChange={(e) => setOutboundPhone(e.target.value)}
                        placeholder="+91-98401-22567"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">Call Purpose</label>
                      <select
                        value={outboundPurpose}
                        onChange={(e) => setOutboundPurpose(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="Order Delivery Confirmation">Order Delivery Confirmation</option>
                        <option value="Appointment Reminder">Appointment Reminder</option>
                        <option value="Payment Verification">Payment Verification</option>
                        <option value="Customer Feedback Inquiry">Customer Feedback Inquiry</option>
                        <option value="Complaint Resolution Followup">Complaint Resolution Followup</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">Conversation Language</label>
                      <select
                        value={outboundLanguage}
                        onChange={(e) => setOutboundLanguage(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        {INDIAN_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label} ({l.native})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={outboundStarting || !!activeCall}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <PhoneOutgoing className="w-4 h-4" />
                      <span>{outboundStarting ? 'Connecting Outbound Call...' : 'Dial Outbound Call'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION H: RECENT CALL HISTORY & TELEPHONY RECORDS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900">Recent Telephony & Call History</h3>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded font-bold">
                {recentCalls.length} Records
              </span>
            </div>
            <button
              onClick={loadConsoleData}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh History</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Caller</th>
                  <th className="py-2 px-3">Call ID</th>
                  <th className="py-2 px-3">Date & Time</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Language</th>
                  <th className="py-2 px-3">Outcome</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCalls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-bold text-[10px] ${
                        c.direction === 'INBOUND' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {c.direction === 'INBOUND' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        <span>{c.direction}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-800">{c.caller_name || 'Customer'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{c.caller_number}</p>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {c.id.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {new Date(c.start_time || c.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {c.duration_seconds ? formatSeconds(c.duration_seconds) : '00:42'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase">
                        {c.language || 'EN'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        c.outcome === 'RESOLVED_BY_AI' || c.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.outcome === 'HANDOFF_TO_HUMAN'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {c.outcome || c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setPreviewCallTranscript(c)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                      >
                        View Transcript
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL 1: ORDER DETAILS DIALOG */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-black text-base text-slate-900">Order #{selectedOrderDetails.order_number}</h4>
                <p className="text-xs text-slate-400">Created: {new Date(selectedOrderDetails.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrderDetails(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedOrderDetails.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-contain" /> : <Package className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-black text-slate-900">₹{Number(item.total || item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span>Total Amount:</span>
                <span className="text-emerald-600 font-black">₹{Number(selectedOrderDetails.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Shipping Address:</span>
                <span className="text-right max-w-xs">{selectedOrderDetails.shipping_address || 'Chennai, Tamil Nadu'}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderDetails(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: HUMAN ESCALATION DESK MODAL */}
      {isEscalationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-base text-slate-900">Specialist Human Escalation</h4>
                <p className="text-xs text-slate-400">Transfer call to a dedicated human specialist department</p>
              </div>
            </div>

            {escalationSuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold text-center">
                ✓ {escalationSuccessMsg}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Department</label>
                  <select
                    value={escalationDepartment}
                    onChange={(e) => setEscalationDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Customer Support">Customer Support (Tier 2)</option>
                    <option value="Billing & Finance">Billing & Financial Disputes</option>
                    <option value="Technical Support">Technical Support Specialist</option>
                    <option value="Logistics & Dispatch">Logistics & Order Dispatch</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Escalation Reason</label>
                  <select
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Customer Requested Senior Specialist">Customer explicitly asked for a human</option>
                    <option value="Refund & Payment Dispute">Payment dispute or refund demand</option>
                    <option value="Complex Technical Inquiry">Query beyond standard knowledge base</option>
                    <option value="Urgent Order Delivery Escalation">Urgent order delayed / missing package</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Conversation Summary</label>
                  <textarea
                    rows={3}
                    value={escalationSummary}
                    onChange={(e) => setEscalationSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    onClick={() => setIsEscalationModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEscalation}
                    disabled={escalationSubmitting}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black cursor-pointer shadow-md"
                  >
                    {escalationSubmitting ? 'Transferring...' : 'Confirm Transfer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: CALL TRANSCRIPT VIEWER */}
      {previewCallTranscript && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-black text-base text-slate-900">Call Transcript</h4>
                <p className="text-xs text-slate-400 font-mono">
                  ID: {previewCallTranscript.id} • {previewCallTranscript.caller_number}
                </p>
              </div>
              <button onClick={() => setPreviewCallTranscript(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto p-2 bg-slate-50 rounded-2xl text-xs">
              {Array.isArray(previewCallTranscript.transcript) && previewCallTranscript.transcript.length > 0 ? (
                previewCallTranscript.transcript.map((t: any, i: number) => (
                  <div key={i} className={`p-2.5 rounded-xl ${
                    t.speaker === 'customer'
                      ? 'bg-white border border-slate-200 text-slate-800'
                      : 'bg-indigo-600 text-white font-medium ml-4'
                  }`}>
                    <p className="text-[10px] font-bold opacity-70 mb-0.5 uppercase">
                      {t.speaker === 'customer' ? 'Customer' : 'AI Receptionist'} {t.timestamp && `• ${t.timestamp}`}
                    </p>
                    <p>{t.text || t.reply_text || t.user_query}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-6">No transcript turns logged for this call.</p>
              )}
            </div>

            <button
              onClick={() => setPreviewCallTranscript(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: BOOK NEW APPOINTMENT */}
      {isNewAppointmentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateAppointment} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-black text-base text-slate-900">Schedule Appointment</h4>
              <button type="button" onClick={() => setIsNewAppointmentOpen(false)} className="text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer</label>
              <select
                value={newAppointmentData.customer_id}
                onChange={(e) => setNewAppointmentData({ ...newAppointmentData, customer_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Service</label>
              <input
                type="text"
                required
                value={newAppointmentData.service_name}
                onChange={(e) => setNewAppointmentData({ ...newAppointmentData, service_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Scheduled Date & Time</label>
              <input
                type="datetime-local"
                required
                value={newAppointmentData.scheduled_time}
                onChange={(e) => setNewAppointmentData({ ...newAppointmentData, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={newAppointmentData.notes}
                onChange={(e) => setNewAppointmentData({ ...newAppointmentData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setIsNewAppointmentOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                Book Appointment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: FILE NEW COMPLAINT */}
      {isNewComplaintOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateComplaint} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-black text-base text-slate-900">File Customer Complaint</h4>
              <button type="button" onClick={() => setIsNewComplaintOpen(false)} className="text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer</label>
              <select
                value={newComplaintData.customer_id}
                onChange={(e) => setNewComplaintData({ ...newComplaintData, customer_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Complaint Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Order delayed by 3 days"
                value={newComplaintData.title}
                onChange={(e) => setNewComplaintData({ ...newComplaintData, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={newComplaintData.priority}
                onChange={(e) => setNewComplaintData({ ...newComplaintData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="URGENT">URGENT</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Detailed Description</label>
              <textarea
                rows={3}
                required
                value={newComplaintData.description}
                onChange={(e) => setNewComplaintData({ ...newComplaintData, description: e.target.value })}
                placeholder="Enter customer feedback or issue details..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setIsNewComplaintOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold">
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: AUDIO SETTINGS & DIAGNOSTICS */}
      {isAudioSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-black text-base text-slate-900">Audio & Headset Diagnostics</h4>
              <button onClick={() => setIsAudioSettingsOpen(false)} className="text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">Microphone Input Level</p>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${micLevel}%` }}></div>
                </div>
                <button
                  onClick={handleTestMic}
                  className={`w-full py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                    micTesting ? 'bg-rose-100 text-rose-700' : 'bg-indigo-600 text-white'
                  }`}
                >
                  {micTesting ? 'Stop Mic Test' : 'Start Mic Diagnostic'}
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">Speaker Output Chime</p>
                <button
                  onClick={handleTestSpeaker}
                  className="w-full py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  Play Test Audio Chime
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">Incoming Ringtone Alert</span>
                <button
                  onClick={() => setRingtoneMuted(!ringtoneMuted)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                    ringtoneMuted ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {ringtoneMuted ? 'Muted' : 'Enabled'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsAudioSettingsOpen(false)}
              className="w-full py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
