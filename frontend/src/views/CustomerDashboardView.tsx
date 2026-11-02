import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Package,
  Calendar,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Search,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  CreditCard,
  History,
  Send,
  Radio,
  FileText,
  User,
  ArrowRight,
  ChevronRight,
  XCircle,
  Headphones
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, Order, Product, Appointment, Complaint, CallRecord } from '../services/api';
import { webrtcService } from '../services/webrtcService';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

export const CustomerDashboardView: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'call' | 'orders' | 'products' | 'appointments' | 'complaints' | 'history' | 'faqs'>('call');

  // Call state: IDLE -> CALLING -> WAITING (Ringing on Agent) -> CONNECTING -> ACTIVE -> ENDED
  const [callState, setCallState] = useState<'IDLE' | 'CALLING' | 'WAITING' | 'CONNECTING' | 'ACTIVE' | 'ENDED'>('IDLE');
  const [callId, setCallId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string; language?: string; timestamp?: string }>>([]);
  const [userSpeechInput, setUserSpeechInput] = useState<string>('');
  const [interimSpeech, setInterimSpeech] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [callSummary, setCallSummary] = useState<any | null>(null);
  const [callStatusMessage, setCallStatusMessage] = useState<string>('');

  // Business Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Forms
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const [apptService, setApptService] = useState('Enterprise PBX Integration Consultation');
  const [apptDate, setApptDate] = useState('2026-11-02 10:30');
  const [apptSuccess, setApptSuccess] = useState(false);

  const timerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const callSocketRef = useRef<WebSocket | null>(null);
  const ringToneIntervalRef = useRef<any>(null);

  // Load customer initial records
  useEffect(() => {
    loadCustomerData();
  }, [user]);

  // Duration Timer
  useEffect(() => {
    if (callState === 'ACTIVE') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallingRingtone();
      if (callSocketRef.current) {
        callSocketRef.current.close();
      }
      webrtcService.close();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const loadCustomerData = async () => {
    setLoadingData(true);
    try {
      const [ordRes, prodRes, apptRes, compRes, callRes] = await Promise.all([
        api.listOrders(),
        api.listProducts(),
        api.listAppointments(),
        api.listComplaints(),
        api.listCalls({ search: user?.phone || undefined })
      ]);
      setOrders(ordRes.data);
      setProducts(prodRes.data);
      setAppointments(apptRes.data);
      setComplaints(compRes.data);
      setCallHistory(callRes.data);
    } catch (e) {
      console.error('Error loading customer dashboard data', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Ringtone synthesizer for outgoing call
  const startCallingRingtone = () => {
    stopCallingRingtone();
    const playChime = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc2.frequency.setValueAtTime(480, audioCtx.currentTime); // B4
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 1.2);
        osc2.stop(audioCtx.currentTime + 1.2);
      } catch (e) {}
    };
    playChime();
    ringToneIntervalRef.current = setInterval(playChime, 3200);
  };

  const stopCallingRingtone = () => {
    if (ringToneIntervalRef.current) {
      clearInterval(ringToneIntervalRef.current);
      ringToneIntervalRef.current = null;
    }
  };

  // Start Call Flow
  const handleStartCall = async () => {
    try {
      setCallState('CALLING');
      setTranscript([]);
      setCallDuration(0);
      setCallSummary(null);
      setCallStatusMessage('Connecting to AI Receptionist line...');

      // 1. Request microphone permission upfront
      await webrtcService.startLocalAudio();

      setCallState('WAITING');
      setCallStatusMessage('Ringing Agent Console... Waiting for Agent to accept...');
      startCallingRingtone();

      // 2. Request Call session from backend (which signals Agent Consoles in real-time)
      const res = await api.requestCall({
        caller_number: user?.phone || '9876543210',
        caller_name: user?.full_name || 'Customer',
        language: selectedLanguage,
        customer_id: user?.id
      });

      const newCallId = res.data.call_id;
      setCallId(newCallId);

      // 3. Connect real-time WebSocket for this call session
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/live-calls/ws/${newCallId}`;
      const ws = new WebSocket(wsUrl);
      callSocketRef.current = ws;

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'CALL_ACCEPTED') {
            stopCallingRingtone();
            setCallState('ACTIVE');
            setCallStatusMessage('Connected with NEXORA AI Voice Receptionist');

            const greetingText = data.call?.greeting_text || data.call?.greeting || 'Welcome to Khaira Company! My name is Khaira AI, your autonomous voice assistant. How may I assist you today?';
            setTranscript([
              { speaker: 'ai', text: greetingText, language: selectedLanguage, timestamp: new Date().toLocaleTimeString() }
            ]);

            // Play neural TTS audio if present
            if (data.call?.tts?.audio_url && speakerEnabled) {
              playAiAudio(data.call.tts.audio_url);
            }

            // Initialize WebRTC Peer-to-Peer Two-Way Audio Connection (Initiator)
            try {
              await webrtcService.initializeConnection(newCallId, true, (signalMsg) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(signalMsg));
                }
              });
            } catch (rtcErr) {
              console.warn('[Customer WebRTC] Non-fatal initialization warning:', rtcErr);
            }

            // Start continuous Speech Recognition in chosen language
            initSpeechRecognition(newCallId);

          } else if (data.event === 'CALL_REJECTED') {
            stopCallingRingtone();
            webrtcService.close();
            setCallState('ENDED');
            setCallStatusMessage('Agent is currently unavailable or declined the call.');
            alert('Call was declined or agent is currently busy.');

          } else if (data.event === 'CALL_ENDED') {
            stopCallingRingtone();
            webrtcService.close();
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch (e) {}
            }
            setCallState('ENDED');
            if (data.call) setCallSummary(data.call);
            loadCustomerData();

          } else if (data.event === 'TRANSCRIPT_TURN') {
            const t = data.turn;
            if (t) {
              setTranscript((prev) => [
                ...prev,
                { speaker: t.speaker || 'ai', text: t.reply_text || t.user_query, language: t.language, timestamp: new Date().toLocaleTimeString() }
              ]);
              if (t.tts?.audio_url && speakerEnabled) {
                playAiAudio(t.tts.audio_url);
              }
            }

          } else if (data.event === 'ai_response') {
            setTranscript((prev) => [
              ...prev,
              { speaker: 'ai', text: data.reply_text, language: data.language, timestamp: new Date().toLocaleTimeString() }
            ]);
            if (data.tts?.audio_url && speakerEnabled) {
              playAiAudio(data.tts.audio_url);
            }

          } else if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(data.event)) {
            await webrtcService.handleSignalMessage(data);
          }
        } catch (e) {
          console.error('[Customer WebSocket] Error processing message:', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('[Customer WebSocket] Error:', e);
      };

    } catch (err: any) {
      console.error('Call initialization failed', err);
      stopCallingRingtone();
      alert(err.response?.data?.detail || 'Unable to establish call with AI Receptionist. Please try again.');
      setCallState('IDLE');
    }
  };

  const handleCancelCall = async () => {
    stopCallingRingtone();
    if (callId) {
      try {
        await api.cancelCall(callId);
      } catch (e) {}
    }
    webrtcService.close();
    if (callSocketRef.current) {
      callSocketRef.current.close();
    }
    setCallState('IDLE');
    setCallStatusMessage('');
  };

  const playAiAudio = (url: string) => {
    setIsAiSpeaking(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => console.log('Audio autoplay prevented by browser policy'));
    audio.onended = () => {
      setIsAiSpeaking(false);
    };
  };

  const initSpeechRecognition = (cId: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e) {}
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        const langMap: Record<string, string> = {
          en: 'en-US',
          ta: 'ta-IN',
          hi: 'hi-IN',
          te: 'te-IN',
          ml: 'ml-IN'
        };
        recognition.lang = langMap[selectedLanguage] || 'en-US';

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              if (text && !isMuted) {
                setInterimSpeech('');
                handleSendTurn(text, cId);
              }
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (interim) {
            setInterimSpeech(interim);
          }
        };

        recognition.onend = () => {
          // Restart recognition if call is still active
          if (callState === 'ACTIVE' || callSocketRef.current?.readyState === WebSocket.OPEN) {
            try {
              recognition.start();
            } catch (e) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition start error', e);
      }
    }
  };

  const handleSendTurn = async (text: string, currentCallId?: string) => {
    const activeId = currentCallId || callId;
    if (!text.trim() || !activeId) return;

    // Add user turn to transcript immediately
    setTranscript((prev) => [
      ...prev,
      { speaker: 'customer', text, language: selectedLanguage, timestamp: new Date().toLocaleTimeString() }
    ]);
    setUserSpeechInput('');
    setInterimSpeech('');

    try {
      const res = await api.sendTurn(activeId, text, selectedLanguage);
      const data = res.data;

      setTranscript((prev) => [
        ...prev,
        { speaker: 'ai', text: data.reply_text, language: data.language, timestamp: new Date().toLocaleTimeString() }
      ]);

      if (data.tts?.audio_url && speakerEnabled) {
        playAiAudio(data.tts.audio_url);
      }

      if (data.is_terminal) {
        setTimeout(() => handleEndCall(), 2500);
      }
    } catch (e) {
      console.error('Failed to send turn', e);
    }
  };

  const handleEndCall = async () => {
    stopCallingRingtone();
    if (!callId) {
      setCallState('IDLE');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    webrtcService.close();

    try {
      const res = await api.endCall(callId, 'RESOLVED_BY_AI');
      setCallSummary(res.data);
    } catch (e) {
      console.warn('End call error', e);
    }

    if (callSocketRef.current) {
      callSocketRef.current.close();
    }

    setCallState('ENDED');
    setCallStatusMessage('Call Ended');
    loadCustomerData();
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
    if (!next && audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintTitle.trim() || !complaintDesc.trim()) return;
    try {
      await api.createComplaint({
        customer_id: user?.id,
        title: complaintTitle,
        description: complaintDesc,
        category: 'Service Request',
        priority: 'MEDIUM'
      });
      setComplaintTitle('');
      setComplaintDesc('');
      setComplaintSuccess(true);
      setTimeout(() => setComplaintSuccess(false), 3000);
      loadCustomerData();
    } catch (e) {
      alert('Failed to register complaint ticket');
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAppointment({
        customer_id: user?.id,
        service_name: apptService,
        scheduled_time: apptDate,
        duration_minutes: 30,
        location_type: 'ONLINE_VOICE',
        notes: `Booked by ${user?.full_name} via Customer Self-Service Portal`
      });
      setApptSuccess(true);
      setTimeout(() => setApptSuccess(false), 3000);
      loadCustomerData();
    } catch (e) {
      alert('Failed to schedule appointment');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Customer Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-200">
              <img src="/kaira-logo.png" alt="KAIRA" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm bg-gradient-to-r from-blue-700 to-sky-600 bg-clip-text text-transparent">
                  NEXORA Customer Portal
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                  Client Hub
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Autonomous 24/7 AI Voice Assistance & Live Telephony</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            {/* Live AI Status Pill */}
            <div className="hidden sm:flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>AI Receptionist Online & Ready</span>
            </div>

            {/* Profile Info */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user?.full_name?.charAt(0) || 'C'}
              </div>
              <div className="hidden md:block text-left">
                <p className="font-bold text-slate-800 text-xs leading-none">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{user?.phone || user?.email}</p>
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

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto border-t border-slate-100 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('call')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'call'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call AI Agent</span>
          </button>

          <button
            onClick={() => setActiveSubTab('orders')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'orders'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>My Orders & Delivery</span>
            {orders.length > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {orders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('products')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'products'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Product Catalog</span>
          </button>

          <button
            onClick={() => setActiveSubTab('appointments')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'appointments'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Appointments Desk</span>
          </button>

          <button
            onClick={() => setActiveSubTab('complaints')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'complaints'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Support & Tickets</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'history'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Call History & Transcripts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('faqs')}
            className={`py-2.5 px-4 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'faqs'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help & FAQs</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* SUBTAB 1: CALL AI AGENT */}
        {activeSubTab === 'call' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Call Hero & Controls */}
            <div className="lg:col-span-2 space-y-5">
              {/* Call Action Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center sm:text-left">
                    <div className="inline-flex items-center space-x-1.5 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold text-blue-700">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-blue-600" />
                      <span>Real-Time WebRTC Two-Way Audio</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      Speak with NEXORA Voice Receptionist
                    </h1>
                    <p className="text-xs text-slate-500 max-w-md">
                      Ask about orders, delivery statuses, product quotes, consultation appointments, or speak directly with an agent in 5 languages.
                    </p>

                    {/* Language selector */}
                    <div className="pt-2 flex items-center justify-center sm:justify-start space-x-2">
                      <span className="text-xs font-semibold text-slate-600">Preferred Language:</span>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        disabled={callState === 'ACTIVE' || callState === 'WAITING'}
                        className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="en">English (Indian English)</option>
                        <option value="ta">Tamil (தமிழ் - Pallavi Voice)</option>
                        <option value="hi">Hindi (हिन्दी - Swara Voice)</option>
                        <option value="te">Telugu (తెలుగు - Shruti Voice)</option>
                        <option value="ml">Malayalam (മലയാളം - Sobhana Voice)</option>
                      </select>
                    </div>
                  </div>

                  {/* Big Call Button & States */}
                  <div className="flex flex-col items-center shrink-0">
                    {callState === 'IDLE' || callState === 'ENDED' ? (
                      <button
                        onClick={handleStartCall}
                        className="w-28 h-28 rounded-full bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/30 flex flex-col items-center justify-center space-y-1.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer ring-8 ring-blue-50"
                      >
                        <PhoneCall className="w-8 h-8 animate-bounce" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">CALL AGENT</span>
                      </button>
                    ) : callState === 'WAITING' || callState === 'CALLING' ? (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full bg-amber-500 text-white flex items-center justify-center animate-pulse shadow-lg ring-8 ring-amber-100">
                            <PhoneCall className="w-8 h-8 animate-bounce" />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-amber-700 text-center animate-pulse">Ringing Agent Console...</p>
                        <button
                          onClick={handleCancelCall}
                          className="px-4 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel Call
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          <NexoraAvatar size="lg" />
                          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white animate-pulse"></span>
                        </div>
                        <button
                          onClick={handleEndCall}
                          className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                        >
                          <PhoneOff className="w-4 h-4" />
                          <span>Hang Up</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Status Bar */}
                {callState !== 'IDLE' && (
                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] tracking-wider ${
                        callState === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                          : callState === 'ENDED'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-700 animate-bounce'
                      }`}>
                        {callState === 'WAITING' ? 'RINGING AGENT...' : callState}
                      </span>
                      {callState === 'ACTIVE' && (
                        <div className="flex items-center space-x-1 text-slate-500 font-mono font-semibold">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatSeconds(callDuration)}</span>
                        </div>
                      )}
                      {callStatusMessage && (
                        <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
                          {callStatusMessage}
                        </span>
                      )}
                      {isAiSpeaking && (
                        <span className="text-sky-600 font-semibold text-[11px] flex items-center space-x-1">
                          <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                          <span>Voice Speaking...</span>
                        </span>
                      )}
                    </div>

                    {/* Audio Controls */}
                    {callState === 'ACTIVE' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={toggleMute}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isMuted
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                        >
                          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={toggleSpeaker}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            !speakerEnabled
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          title={speakerEnabled ? 'Mute Audio' : 'Enable Audio'}
                        >
                          {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Real-Time Live Transcript Screen */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col h-96">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-800">Live Voice Conversation Transcript</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {transcript.length} turns recorded
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
                  {transcript.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs space-y-2">
                      <NexoraAvatar size="md" />
                      <p className="font-medium text-slate-600">No active conversation yet.</p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        Click the "CALL AGENT" button above. The agent tab will receive your call and connect in real-time.
                      </p>
                    </div>
                  ) : (
                    transcript.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${item.speaker === 'customer' ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] font-semibold text-slate-400 mb-1 px-1">
                          {item.speaker === 'customer' ? 'You (Customer)' : item.speaker === 'agent' ? 'Live Human Agent' : 'NEXORA AI Receptionist'}
                          {item.timestamp && ` • ${item.timestamp}`}
                        </span>
                        <div
                          className={`p-3 rounded-2xl max-w-md text-xs leading-relaxed ${
                            item.speaker === 'customer'
                              ? 'bg-blue-600 text-white rounded-br-none shadow-xs'
                              : item.speaker === 'agent'
                              ? 'bg-indigo-600 text-white rounded-bl-none shadow-xs'
                              : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80'
                          }`}
                        >
                          {item.text}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Interim speech recognition preview */}
                  {interimSpeech && (
                    <div className="flex flex-col items-end opacity-75">
                      <span className="text-[10px] font-semibold text-blue-500 mb-1 px-1 animate-pulse">
                        Speaking...
                      </span>
                      <div className="p-3 rounded-2xl max-w-md text-xs leading-relaxed bg-blue-100 text-blue-900 border border-blue-200 rounded-br-none italic">
                        {interimSpeech}
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Message Fallback in Call */}
                {callState === 'ACTIVE' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendTurn(userSpeechInput);
                    }}
                    className="pt-3 border-t border-slate-100 flex items-center space-x-2"
                  >
                    <input
                      type="text"
                      placeholder={`Type question in ${selectedLanguage.toUpperCase()} (e.g. 'Where is order ORD-2026-00001?')...`}
                      value={userSpeechInput}
                      onChange={(e) => setUserSpeechInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* Call Ended Summary Banner */}
                {callState === 'ENDED' && callSummary && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-emerald-800 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Call Concluded Successfully ({callSummary.duration_seconds}s)</span>
                    </p>
                    <p className="text-[11px] text-emerald-700">{callSummary.summary}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Customer Info & Fast Actions */}
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{user?.full_name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{user?.phone}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Orders</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{orders.length}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Tickets</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{complaints.length}</p>
                  </div>
                </div>
              </div>

              {/* Sample Voice Queries to Try */}
              <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-3xl p-5 border border-blue-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Try Asking the AI Voice Agent:</span>
                </div>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => handleSendTurn('Where is my order ORD-2026-00001?')}
                    className="w-full text-left p-2.5 bg-white/90 hover:bg-white rounded-xl border border-blue-200/70 text-slate-700 transition-all cursor-pointer font-medium hover:border-blue-400 shadow-2xs"
                  >
                    💬 "Where is my order ORD-2026-00001?"
                  </button>
                  <button
                    onClick={() => handleSendTurn('What products are currently in stock?')}
                    className="w-full text-left p-2.5 bg-white/90 hover:bg-white rounded-xl border border-blue-200/70 text-slate-700 transition-all cursor-pointer font-medium hover:border-blue-400 shadow-2xs"
                  >
                    💬 "What products are currently in stock?"
                  </button>
                  <button
                    onClick={() => handleSendTurn('என் ஆர்டர் ORD-2026-00001 எங்கே உள்ளது?')}
                    className="w-full text-left p-2.5 bg-white/90 hover:bg-white rounded-xl border border-blue-200/70 text-slate-700 transition-all cursor-pointer font-medium hover:border-blue-400 shadow-2xs"
                  >
                    💬 "என் ஆர்டர் ORD-2026-00001 எங்கே உள்ளது?" (Tamil)
                  </button>
                  <button
                    onClick={() => handleSendTurn('I want to schedule an appointment for a demo session tomorrow')}
                    className="w-full text-left p-2.5 bg-white/90 hover:bg-white rounded-xl border border-blue-200/70 text-slate-700 transition-all cursor-pointer font-medium hover:border-blue-400 shadow-2xs"
                  >
                    💬 "Book a demo appointment for tomorrow"
                  </button>
                  <button
                    onClick={() => handleSendTurn('Please connect me to a human specialist')}
                    className="w-full text-left p-2.5 bg-white/90 hover:bg-white rounded-xl border border-blue-200/70 text-slate-700 transition-all cursor-pointer font-medium hover:border-blue-400 shadow-2xs"
                  >
                    💬 "Please transfer me to a human specialist"
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: ORDERS & TRACKING */}
        {activeSubTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Your Orders & Deliveries</h2>
                <p className="text-xs text-slate-500">Track shipments, view courier numbers, and check delivery dates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((ord) => (
                <div key={ord.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-blue-700">{ord.order_number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      ord.status === 'SHIPPED' || ord.status === 'ORDER_CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ord.status === 'DELIVERED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {ord.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Amount: {ord.currency} {ord.total_amount?.toFixed(2)} ({ord.payment_status})
                    </p>
                    <p>Courier: <span className="font-medium text-slate-800">{ord.courier_name || 'BlueDart Express'}</span></p>
                    <p>Tracking Number: <span className="font-mono text-slate-800">{ord.tracking_number || 'TRK-2026-ACTIVE'}</span></p>
                    <p>Estimated Delivery: <span className="font-medium text-slate-800">{ord.estimated_delivery ? new Date(ord.estimated_delivery).toLocaleDateString() : 'In 2 days'}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 3: PRODUCT CATALOG */}
        {activeSubTab === 'products' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Unified Product Catalog</h2>
              <p className="text-xs text-slate-500">Live products and verified inventory available across unified channels.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div key={prod.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-sm text-slate-800">{prod.name}</h3>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">
                      {prod.sku}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{prod.description}</p>
                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-sm text-slate-900">
                      {prod.currency} {prod.price.toFixed(2)}
                    </span>
                    <span className="text-emerald-600 font-semibold text-[11px]">
                      ● In Stock ({prod.stock_quantity})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 4: APPOINTMENTS */}
        {activeSubTab === 'appointments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Your Scheduled Appointments</h2>
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div key={appt.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{appt.service_name}</h4>
                      <p className="text-xs text-slate-500">{new Date(appt.scheduled_time).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-blue-100 text-blue-700">
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-800">Book New Consultation</h3>
              {apptSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-medium">
                  Appointment scheduled successfully!
                </div>
              )}
              <form onSubmit={handleBookAppointment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service</label>
                  <input
                    type="text"
                    value={apptService}
                    onChange={(e) => setApptService(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Date & Time</label>
                  <input
                    type="text"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Confirm Appointment
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUBTAB 5: COMPLAINTS */}
        {activeSubTab === 'complaints' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Support & Grievance Tickets</h2>
              <div className="space-y-3">
                {complaints.map((comp) => (
                  <div key={comp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-blue-700">{comp.ticket_number}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-100 text-amber-700">
                        {comp.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-800">{comp.title}</h4>
                    <p className="text-xs text-slate-500">{comp.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-800">Register Support Ticket</h3>
              {complaintSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-medium">
                  Support ticket registered successfully!
                </div>
              )}
              <form onSubmit={handleCreateComplaint} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Delayed package delivery"
                    value={complaintTitle}
                    onChange={(e) => setComplaintTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details about your query or grievance..."
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Submit Ticket
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUBTAB 6: CALL HISTORY */}
        {activeSubTab === 'history' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Voice Interaction History</h2>
              <p className="text-xs text-slate-500">Review past conversations, summaries, and resolution outcomes.</p>
            </div>
            <div className="space-y-3">
              {callHistory.map((call) => (
                <div key={call.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-blue-700">Call ID: {call.id.slice(0, 8)}...</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {call.duration_seconds}s • [{call.language?.toUpperCase() || 'EN'}]
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold">Outcome:</span> {call.outcome || 'RESOLVED_BY_AI'}
                  </p>
                  {call.summary && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      "{call.summary}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 7: FAQS */}
        {activeSubTab === 'faqs' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Frequently Asked Questions</h2>
              <p className="text-xs text-slate-500">Common questions about NEXORA AI Receptionist and Khaira Company.</p>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <h4 className="font-bold text-slate-800">What languages can I speak with the AI?</h4>
                <p className="text-slate-600">You can speak naturally in English, Tamil (தமிழ்), Hindi (हिन्दी), Telugu (తెలుగు), and Malayalam (മലയാളം).</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <h4 className="font-bold text-slate-800">How do I track my order via voice?</h4>
                <p className="text-slate-600">Simply click "Call AI Agent" and say "Where is my order?" or provide your order ID (e.g. ORD-2026-00001). The AI will fetch your live delivery status.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <h4 className="font-bold text-slate-800">Can I be transferred to a real human agent?</h4>
                <p className="text-slate-600">Yes! Just say "Connect me to a human specialist" at any time. The AI will escalate and connect you to the agent console.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
