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
  Headphones,
  ShoppingBag,
  LogOut,
  Camera,
  Upload,
  Pause,
  Play,
  RotateCcw,
  Truck,
  ExternalLink,
  MapPin,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, Order, Product, Appointment, Complaint, CallRecord, CustomerProfile } from '../services/api';
import { webrtcService } from '../services/webrtcService';
import { NexoraAvatar } from '../components/layout/NexoraAvatar';

export const CustomerDashboardView: React.FC = () => {
  const { customer, customerToken, customerLogout, refreshCustomer, user, setPortalMode } = useAuth();

  // Active customer profile
  const activeCustomer: CustomerProfile = customer || {
    id: user?.id || 'cust-default',
    customer_code: 'CUST-2026-00019',
    name: user?.full_name || 'Valued Customer',
    phone: user?.phone || '9840122567',
    email: user?.email || 'customer@nexora.ai',
    preferred_language: 'en',
    total_orders_count: 0,
    created_at: new Date().toISOString()
  };

  const [activeSubTab, setActiveSubTab] = useState<'voice' | 'orders' | 'tracking' | 'appointments' | 'complaints' | 'history' | 'profile' | 'settings'>('voice');

  // Call state machine:
  // IDLE -> CALLING -> RINGING -> ACCEPTED -> CONNECTING -> CONNECTED -> ON_HOLD -> REJECTED -> FAILED -> ENDED
  const [callState, setCallState] = useState<
    'IDLE' | 'CALLING' | 'RINGING' | 'ACCEPTED' | 'CONNECTING' | 'CONNECTED' | 'ON_HOLD' | 'REJECTED' | 'FAILED' | 'ENDED'
  >('IDLE');

  const [callId, setCallId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(activeCustomer.preferred_language || 'en');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string; language?: string; timestamp?: string }>>([]);
  const [userSpeechInput, setUserSpeechInput] = useState<string>('');
  const [interimSpeech, setInterimSpeech] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [callSummary, setCallSummary] = useState<any | null>(null);
  const [callStatusMessage, setCallStatusMessage] = useState<string>('Ready to connect with NEXORA AI');

  // FLOW B: Incoming Call from AI Agent
  const [incomingCallFromAgent, setIncomingCallFromAgent] = useState<any | null>(null);

  // Business Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Forms & Modals
  const [newComplaintTitle, setNewComplaintTitle] = useState('');
  const [newComplaintDesc, setNewComplaintDesc] = useState('');
  const [newComplaintCategory, setNewComplaintCategory] = useState('ORDER');
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const [apptService, setApptService] = useState('AI Telephony & Order Consultation');
  const [apptDate, setApptDate] = useState('2026-11-05 11:00');
  const [apptSuccess, setApptSuccess] = useState(false);

  // Profile Edit
  const [editName, setEditName] = useState(activeCustomer.name);
  const [editAddress, setEditAddress] = useState(activeCustomer.address_line1 || 'No. 45, Anna Salai');
  const [editCity, setEditCity] = useState(activeCustomer.city || 'Chennai');
  const [editPincode, setEditPincode] = useState(activeCustomer.pincode || '600001');
  const [profileSaved, setProfileSaved] = useState(false);

  const timerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const callSocketRef = useRef<WebSocket | null>(null);
  const customerDispatchWsRef = useRef<WebSocket | null>(null);
  const outgoingRingtoneRef = useRef<any>(null);
  const incomingRingtoneRef = useRef<any>(null);

  // Load customer data scoped to this customer
  useEffect(() => {
    loadCustomerData();
  }, [activeCustomer.id, activeCustomer.phone]);

  // Duration Timer
  useEffect(() => {
    if (callState === 'CONNECTED' || callState === 'ON_HOLD') {
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

  // Setup Customer Persistent WebSocket for incoming calls from Agent (FLOW B)
  useEffect(() => {
    const cleanPhone = (activeCustomer.phone || '').replace(/\D/g, '').slice(-10);
    const ident = cleanPhone || activeCustomer.id;
    if (!ident) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/live-calls/ws/customer/${ident}`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      customerDispatchWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'INCOMING_CALL_FROM_AGENT') {
            console.log('[Customer Dashboard] Received incoming call from agent:', data);
            setIncomingCallFromAgent(data);
            startIncomingRingtone();
          } else if (data.event === 'CALL_ENDED' || data.event === 'CALL_REJECTED') {
            stopIncomingRingtone();
            setIncomingCallFromAgent(null);
          }
        } catch (e) {
          console.error('[Customer Dashboard] Error handling incoming dispatch WS:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Customer Dashboard] Customer dispatch socket closed.');
      };
    } catch (e) {
      console.warn('[Customer Dashboard] Could not connect customer dispatch WS:', e);
    }

    return () => {
      stopIncomingRingtone();
      if (ws) ws.close();
    };
  }, [activeCustomer.phone, activeCustomer.id]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallingRingtone();
      stopIncomingRingtone();
      if (callSocketRef.current) callSocketRef.current.close();
      if (customerDispatchWsRef.current) customerDispatchWsRef.current.close();
      webrtcService.close();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const loadCustomerData = async () => {
    setLoadingData(true);
    try {
      const cleanPhone = (activeCustomer.phone || '').replace(/\D/g, '').slice(-10);

      // Scoped fetch: customer's own orders, complaints, appointments, calls
      const [ordRes, apptRes, compRes, callRes] = await Promise.all([
        api.getMyOrders().catch(() => api.listOrders({ customer_id: activeCustomer.id })),
        api.listAppointments({ customer_id: activeCustomer.id }).catch(() => ({ data: [] })),
        api.listComplaints({ customer_id: activeCustomer.id }).catch(() => ({ data: [] })),
        api.listCalls({ search: cleanPhone || activeCustomer.phone }).catch(() => ({ data: [] }))
      ]);

      setOrders(ordRes.data || []);
      setAppointments(apptRes.data || []);
      setComplaints(compRes.data || []);
      setCallHistory(callRes.data || []);
    } catch (e) {
      console.error('Error loading scoped customer data', e);
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
    outgoingRingtoneRef.current = setInterval(playChime, 3200);
  };

  const stopCallingRingtone = () => {
    if (outgoingRingtoneRef.current) {
      clearInterval(outgoingRingtoneRef.current);
      outgoingRingtoneRef.current = null;
    }
  };

  // Ringtone synthesizer for incoming call from Agent
  const startIncomingRingtone = () => {
    stopIncomingRingtone();
    const playIncomingTone = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } catch (e) {}
    };
    playIncomingTone();
    incomingRingtoneRef.current = setInterval(playIncomingTone, 2200);
  };

  const stopIncomingRingtone = () => {
    if (incomingRingtoneRef.current) {
      clearInterval(incomingRingtoneRef.current);
      incomingRingtoneRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------
  // FLOW A: CUSTOMER INITIATES CALL TO AI AGENT
  // ---------------------------------------------------------------------------
  const handleStartCall = async () => {
    try {
      setCallState('CALLING');
      setTranscript([]);
      setCallDuration(0);
      setCallSummary(null);
      setIsMuted(false);
      setIsOnHold(false);
      setCallStatusMessage('Connecting to AI Voice line...');

      // 1. Request microphone permission upfront
      await webrtcService.startLocalAudio();

      setCallState('RINGING');
      setCallStatusMessage('Ringing Agent Console... Waiting for Agent to accept...');
      startCallingRingtone();

      // 2. Request Call session from backend
      const res = await api.requestCall({
        caller_number: activeCustomer.phone,
        caller_name: activeCustomer.name,
        language: selectedLanguage,
        customer_id: activeCustomer.id
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
            setCallState('ACCEPTED');
            setCallStatusMessage('Agent accepted call. Establishing WebRTC audio stream...');

            const greetingText =
              data.call?.greeting_text ||
              data.call?.greeting ||
              'Welcome to Khaira Company! My name is Khaira AI, your autonomous voice assistant. How may I assist you today?';
            setTranscript([
              { speaker: 'ai', text: greetingText, language: selectedLanguage, timestamp: new Date().toLocaleTimeString() }
            ]);

            // Play neural TTS audio if present
            if (data.call?.tts?.audio_url && speakerEnabled) {
              playAiAudio(data.call.tts.audio_url);
            }

            // Transition to CONNECTING
            setCallState('CONNECTING');

            // Setup connection state callback: only transition to CONNECTED when media is linked!
            webrtcService.setConnectionStateCallback((state) => {
              console.log('[Customer WebRTC] Connection state update:', state);
              if (state === 'connected') {
                setCallState('CONNECTED');
                setCallStatusMessage('Connected with NEXORA AI Voice Specialist');
              } else if (state === 'failed' || state === 'disconnected') {
                setCallState('FAILED');
                setCallStatusMessage('Audio stream interrupted.');
              }
            });

            // Initialize WebRTC as Initiator (Caller)
            try {
              await webrtcService.initializeConnection(newCallId, true, (signalMsg) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(signalMsg));
                }
              });
            } catch (rtcErr) {
              console.warn('[Customer WebRTC] Initialization notice:', rtcErr);
            }

            // Start continuous Speech Recognition in chosen language
            initSpeechRecognition(newCallId);

          } else if (data.event === 'CALL_REJECTED') {
            stopCallingRingtone();
            webrtcService.close();
            setCallState('REJECTED');
            setCallStatusMessage('Agent is currently unavailable or declined the call.');

          } else if (data.event === 'CALL_ENDED') {
            stopCallingRingtone();
            webrtcService.close();
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch (e) {}
            }
            setCallState('ENDED');
            setCallStatusMessage('Call ended successfully.');
            if (data.call) setCallSummary(data.call);
            loadCustomerData();

          } else if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(data.event)) {
            await webrtcService.handleSignalMessage(data);

          } else if (data.event === 'TRANSCRIPT_TURN') {
            const t = data.turn;
            if (t) {
              const textContent = t.reply_text || t.text || t.user_query;
              if (textContent) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    speaker: t.speaker || 'ai',
                    text: textContent,
                    language: t.language || selectedLanguage,
                    timestamp: new Date().toLocaleTimeString()
                  }
                ]);
              }
              if (t.tts?.audio_url && speakerEnabled && t.speaker !== 'customer') {
                playAiAudio(t.tts.audio_url);
              }
            }
          }
        } catch (err) {
          console.error('[Customer WebSocket] Error handling message:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('[Customer WebSocket] Error:', e);
        setCallState('FAILED');
        setCallStatusMessage('Connection error. Please try again.');
        stopCallingRingtone();
      };
    } catch (err: any) {
      console.error('Call initiation failed:', err);
      stopCallingRingtone();
      setCallState('FAILED');
      setCallStatusMessage('Failed to start call. Please check your mic and network.');
    }
  };

  // ---------------------------------------------------------------------------
  // FLOW B: CUSTOMER ACCEPTS INCOMING CALL FROM AGENT
  // ---------------------------------------------------------------------------
  const handleAcceptAgentCall = async () => {
    if (!incomingCallFromAgent) return;
    const targetCallId = incomingCallFromAgent.call_id || incomingCallFromAgent.id;
    stopIncomingRingtone();

    try {
      setCallState('ACCEPTED');
      setCallId(targetCallId);
      setTranscript([
        {
          speaker: 'system',
          text: `Inbound call from ${incomingCallFromAgent.agent_name || 'AI Voice Specialist'} (${incomingCallFromAgent.purpose || 'Priority Support'}).`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setCallDuration(0);
      setIsMuted(false);
      setIsOnHold(false);
      setCallStatusMessage('Accepting call and establishing WebRTC audio connection...');

      // 1. Request mic
      await webrtcService.startLocalAudio();

      // 2. Notify backend of customer acceptance
      await api.customerAcceptCall(targetCallId);

      // 3. Connect call WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/live-calls/ws/${targetCallId}`;
      const ws = new WebSocket(wsUrl);
      callSocketRef.current = ws;

      setCallState('CONNECTING');

      // Setup WebRTC connection state callback
      webrtcService.setConnectionStateCallback((state) => {
        console.log('[Customer Inbound WebRTC] State:', state);
        if (state === 'connected') {
          setCallState('CONNECTED');
          setCallStatusMessage(`Connected with ${incomingCallFromAgent.agent_name || 'AI Agent'}`);
        } else if (state === 'failed' || state === 'disconnected') {
          setCallState('FAILED');
          setCallStatusMessage('Audio connection interrupted.');
        }
      });

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(msg.event)) {
            await webrtcService.handleSignalMessage(msg);
          } else if (msg.event === 'TRANSCRIPT_TURN') {
            const t = msg.turn || msg;
            const textContent = t.reply_text || t.text || t.user_query;
            if (textContent) {
              setTranscript((prev) => [
                ...prev,
                {
                  speaker: t.speaker || 'agent',
                  text: textContent,
                  language: t.language || selectedLanguage,
                  timestamp: new Date().toLocaleTimeString()
                }
              ]);
            }
            if (t.tts?.audio_url && speakerEnabled && t.speaker !== 'customer') {
              playAiAudio(t.tts.audio_url);
            }
          } else if (msg.event === 'CALL_ENDED') {
            webrtcService.close();
            setCallState('ENDED');
            setCallStatusMessage('Call ended by operator.');
            loadCustomerData();
          }
        } catch (e) {
          console.warn('[Customer Inbound WS] Parse notice:', e);
        }
      };

      // Customer is Receiver in Agent Outbound Call
      await webrtcService.initializeConnection(targetCallId, false, (signalMsg) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(signalMsg));
        }
      });

      // Start continuous speech recognition
      initSpeechRecognition(targetCallId);

      setIncomingCallFromAgent(null);
    } catch (err) {
      console.error('[Customer Dashboard] Failed to accept agent call:', err);
      setCallState('FAILED');
      setCallStatusMessage('Failed to connect incoming call.');
      setIncomingCallFromAgent(null);
    }
  };

  const handleRejectAgentCall = async () => {
    if (!incomingCallFromAgent) return;
    const targetCallId = incomingCallFromAgent.call_id || incomingCallFromAgent.id;
    stopIncomingRingtone();
    try {
      await api.rejectCall(targetCallId, 'Declined by customer');
    } catch (e) {}
    setIncomingCallFromAgent(null);
  };

  // ---------------------------------------------------------------------------
  // SPEECH RECOGNITION & AUDIO
  // ---------------------------------------------------------------------------
  const initSpeechRecognition = (activeCallId: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;

      const langMap: Record<string, string> = {
        en: 'en-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        ml: 'ml-IN',
        hi: 'hi-IN'
      };
      recognition.lang = langMap[selectedLanguage] || 'en-IN';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) {
          setInterimSpeech(interimTranscript);
        }

        if (finalTranscript.trim()) {
          setInterimSpeech('');
          handleSendSpeechTurn(activeCallId, finalTranscript.trim());
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('[Customer SpeechRecognition] Error:', err.error);
        }
      };

      recognition.onend = () => {
        if (['CONNECTED', 'ON_HOLD'].includes(callState)) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('[Customer SpeechRecognition] Unavailable:', e);
    }
  };

  const handleSendSpeechTurn = async (targetCallId: string, text: string) => {
    if (!text.trim()) return;

    setTranscript((prev) => [
      ...prev,
      { speaker: 'customer', text, language: selectedLanguage, timestamp: new Date().toLocaleTimeString() }
    ]);

    if (callSocketRef.current && callSocketRef.current.readyState === WebSocket.OPEN) {
      callSocketRef.current.send(
        JSON.stringify({
          event: 'user_message',
          call_id: targetCallId,
          text,
          language: selectedLanguage
        })
      );
    } else {
      try {
        const res = await api.sendTurn(targetCallId, text, selectedLanguage);
        if (res.data && res.data.reply_text) {
          setTranscript((prev) => [
            ...prev,
            {
              speaker: 'ai',
              text: res.data.reply_text,
              language: res.data.language || selectedLanguage,
              timestamp: new Date().toLocaleTimeString()
            }
          ]);
          if (res.data.tts?.audio_url && speakerEnabled) {
            playAiAudio(res.data.tts.audio_url);
          }
        }
      } catch (e) {
        console.error('Error sending speech turn via HTTP fallback:', e);
      }
    }
  };

  const playAiAudio = (url: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
        setIsAiSpeaking(true);
        audioRef.current.onended = () => setIsAiSpeaking(false);
      }
    } catch (e) {}
  };

  // ---------------------------------------------------------------------------
  // AUDIO CONTROLS: MUTE, HOLD, SPEAKER, END
  // ---------------------------------------------------------------------------
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webrtcService.setMuted(next);
  };

  const handleToggleHold = () => {
    const next = !isOnHold;
    setIsOnHold(next);
    webrtcService.setHold(next);
    setCallState(next ? 'ON_HOLD' : 'CONNECTED');
    setCallStatusMessage(next ? 'Call on hold' : 'Call resumed');
  };

  const handleToggleSpeaker = () => {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    webrtcService.setSpeaker(next);
  };

  const handleEndCall = async () => {
    stopCallingRingtone();
    stopIncomingRingtone();
    if (callId) {
      try {
        await api.endCall(callId, 'CUSTOMER_ENDED');
      } catch (e) {}
    }
    webrtcService.close();
    if (callSocketRef.current) {
      callSocketRef.current.close();
      callSocketRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setCallState('ENDED');
    setCallStatusMessage('Call ended. Thank you for connecting with NEXORA AI.');
    loadCustomerData();
  };

  // ---------------------------------------------------------------------------
  // SUB-TAB ACTIONS
  // ---------------------------------------------------------------------------
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaintTitle.trim()) return;
    try {
      await api.createComplaint({
        customer_id: activeCustomer.id,
        title: newComplaintTitle,
        description: newComplaintDesc,
        category: newComplaintCategory,
        priority: 'MEDIUM'
      });
      setComplaintSuccess(true);
      setNewComplaintTitle('');
      setNewComplaintDesc('');
      setTimeout(() => setComplaintSuccess(false), 3000);
      loadCustomerData();
    } catch (e) {
      console.error('Failed to create complaint', e);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAppointment({
        customer_id: activeCustomer.id,
        service_name: apptService,
        scheduled_time: apptDate,
        duration_minutes: 30,
        notes: 'Booked directly via Customer Portal'
      });
      setApptSuccess(true);
      setTimeout(() => setApptSuccess(false), 3000);
      loadCustomerData();
    } catch (e) {
      console.error('Failed to book appointment', e);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.customerUpdateProfile({
        name: editName,
        address_line1: editAddress,
        city: editCity,
        pincode: editPincode,
        preferred_language: selectedLanguage
      });
      await refreshCustomer();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  };

  // Format Duration
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Summary Metrics calculations
  const totalOrdersCount = orders.length;
  const activeOrdersCount = orders.filter((o) =>
    ['PENDING', 'PROCESSING', 'CONFIRMED', 'SHIPPED'].includes((o.status || '').toUpperCase())
  ).length;
  const completedOrdersCount = orders.filter((o) =>
    ['DELIVERED', 'COMPLETED'].includes((o.status || '').toUpperCase())
  ).length;
  const pendingComplaintsCount = complaints.filter((c) =>
    ['PENDING', 'OPEN', 'IN_PROGRESS'].includes((c.status || '').toUpperCase())
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      <audio ref={audioRef} className="hidden" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
                  CUSTOMER <span className="text-blue-600">DASHBOARD</span>
                </h1>
                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">
                KAIRA Technologies • NEXORA AI Voice Portal
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Primary Action: Explore Store */}
            <button
              onClick={() => setPortalMode('store')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center space-x-2 cursor-pointer transition-all hover:scale-[1.02]"
              title="Browse 16 product categories in the NEXORA Store"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Store</span>
            </button>

            {/* Customer Avatar & Code */}
            <button
              onClick={() => setActiveSubTab('profile')}
              className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 text-xs cursor-pointer transition-colors"
              title="Click to view and edit profile"
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] overflow-hidden border border-white">
                {activeCustomer.avatar_url ? (
                  <img src={activeCustomer.avatar_url} alt={activeCustomer.name} className="w-full h-full object-cover" />
                ) : (
                  activeCustomer.name.charAt(0)
                )}
              </div>
              <div className="text-left">
                <p className="font-extrabold text-[11px] leading-tight text-slate-800">{activeCustomer.name}</p>
                <p className="text-[9px] font-mono text-blue-600 leading-none">{activeCustomer.customer_code}</p>
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={customerLogout}
              className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-200/80 flex items-center space-x-1 cursor-pointer transition-colors"
              title="Sign out of Customer Session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* =======================================================================
            SECTION A: DASHBOARD OVERVIEW & SUMMARY METRICS
            ======================================================================= */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Welcome back, {activeCustomer.name.split(' ')[0]}!
                </h2>
                <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  {activeCustomer.customer_code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Access autonomous AI voice assistance, track orders in real time, and manage consultations.
              </p>
            </div>

            {/* Account Details Capsule */}
            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Mobile</p>
                <p className="font-mono font-bold text-slate-800">{activeCustomer.phone}</p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Email</p>
                <p className="font-bold text-slate-800 truncate max-w-[160px]">{activeCustomer.email || 'N/A'}</p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Language</p>
                <p className="font-bold text-purple-700 uppercase">{activeCustomer.preferred_language || 'EN'}</p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                <span className="text-[11px] font-extrabold text-emerald-600">Active & Verified</span>
              </div>
            </div>
          </div>

          {/* 4 Live Summary Cards from actual database records */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 rounded-2xl border border-blue-100/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-900">Total Orders</span>
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-3xl font-black text-blue-950">{totalOrdersCount}</p>
              <p className="text-[11px] text-blue-600/80 mt-1">Lifetime customer purchases</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border border-amber-100/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-900">Active Orders</span>
                <Truck className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-3xl font-black text-amber-950">{activeOrdersCount}</p>
              <p className="text-[11px] text-amber-600/80 mt-1">Processing or in transit</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-2xl border border-emerald-100/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900">Completed Orders</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-3xl font-black text-emerald-950">{completedOrdersCount}</p>
              <p className="text-[11px] text-emerald-600/80 mt-1">Delivered successfully</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50/50 p-4 rounded-2xl border border-purple-100/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-900">Pending Complaints</span>
                <AlertOctagon className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-3xl font-black text-purple-950">{pendingComplaintsCount}</p>
              <p className="text-[11px] text-purple-600/80 mt-1">Active resolution tickets</p>
            </div>
          </div>
        </section>

        {/* =======================================================================
            SECTION B: AI VOICE AGENT CALLING SECTION (MOST IMPORTANT)
            ======================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-blue-500/30 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                  <PhoneCall className="w-5 h-5" />
                </span>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Connect with NEXORA AI Voice Assistant
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time two-way WebRTC audio calling with live transcription in 5 Indian languages.
              </p>
            </div>

            {/* AI Agent Availability Badge & Status Pill */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>AI Agent Available</span>
              </div>

              {/* Call State Pill */}
              <div
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center space-x-1.5 shadow-2xs ${
                  callState === 'CONNECTED'
                    ? 'bg-emerald-600 text-white'
                    : callState === 'CONNECTING' || callState === 'ACCEPTED'
                    ? 'bg-amber-500 text-white animate-pulse'
                    : callState === 'RINGING' || callState === 'CALLING'
                    ? 'bg-blue-600 text-white animate-pulse'
                    : callState === 'ON_HOLD'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>STATE: {callState}</span>
              </div>
            </div>
          </div>

          {/* Language Selector & Controls (Only 5 languages: en, ta, te, ml, hi) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Language Selector */}
            <div className="md:col-span-8 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Conversation Language
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { code: 'en', label: 'English', native: 'Indian Accent' },
                  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
                  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
                  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
                  { code: 'hi', label: 'Hindi', native: 'हिन्दी' }
                ].map((l) => (
                  <button
                    key={l.code}
                    disabled={callState !== 'IDLE' && callState !== 'ENDED'}
                    onClick={() => setSelectedLanguage(l.code)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                      selectedLanguage === l.code
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="font-bold text-xs">{l.label}</p>
                    <p className="text-[10px] text-slate-500">{l.native}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Start / End Call Button */}
            <div className="md:col-span-4 flex flex-col items-center justify-center space-y-2">
              {['IDLE', 'ENDED', 'REJECTED', 'FAILED'].includes(callState) ? (
                <button
                  onClick={handleStartCall}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2.5 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <PhoneCall className="w-5 h-5 animate-bounce" />
                  <span>Start Voice Call Now</span>
                </button>
              ) : (
                <button
                  onClick={handleEndCall}
                  className="w-full py-4 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-rose-500/25 flex items-center justify-center space-x-2.5 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>End Voice Call ({formatTime(callDuration)})</span>
                </button>
              )}

              <p className="text-[11px] text-slate-500 text-center font-medium">
                {callStatusMessage}
              </p>
            </div>
          </div>

          {/* Active Call Live Audio & Conversation Stream */}
          {callState !== 'IDLE' && (
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
              {/* Call Controls Bar during active call */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                  <span className="font-mono font-bold text-sm text-emerald-300">
                    Duration: {formatTime(callDuration)}
                  </span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-slate-300">
                    Language: <strong className="text-white uppercase">{selectedLanguage}</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleMute}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      isMuted ? 'bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                  </button>

                  <button
                    onClick={handleToggleHold}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      isOnHold ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isOnHold ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isOnHold ? 'Resume' : 'Hold'}</span>
                  </button>

                  <button
                    onClick={handleToggleSpeaker}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      speakerEnabled ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {speakerEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{speakerEnabled ? 'Speaker On' : 'Speaker Off'}</span>
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Hang Up</span>
                  </button>
                </div>
              </div>

              {/* Real-time Transcription Stream */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-72 overflow-y-auto space-y-3">
                {transcript.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    <Headphones className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
                    <p>Live audio connection established. Start speaking into your microphone...</p>
                  </div>
                ) : (
                  transcript.map((t, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        t.speaker === 'customer' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                          t.speaker === 'customer'
                            ? 'bg-blue-600 text-white rounded-br-none shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-0.5 text-[10px] opacity-75 font-bold uppercase">
                          <span>{t.speaker === 'customer' ? 'You' : 'AI Specialist'}</span>
                          <span>•</span>
                          <span>{t.timestamp}</span>
                        </div>
                        <p className="leading-relaxed font-medium">{t.text}</p>
                      </div>
                    </div>
                  ))
                )}

                {interimSpeech && (
                  <div className="text-right text-[11px] text-blue-600 font-mono italic animate-pulse">
                    Speaking: "{interimSpeech}..."
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* =======================================================================
            SECTION C: INCOMING CALL MODAL FROM AI AGENT (FLOW B)
            ======================================================================= */}
        {incomingCallFromAgent && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border-2 border-emerald-500 animate-in zoom-in-95 duration-200 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-md shadow-emerald-500/20 animate-bounce">
                <PhoneCall className="w-8 h-8" />
              </div>

              <div>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                  INCOMING VOICE CALL
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  {incomingCallFromAgent.agent_name || 'Sarah Jenkins (AI Voice Specialist)'}
                </h3>
                <p className="text-xs text-blue-600 font-mono font-bold mt-0.5">
                  Caller: {incomingCallFromAgent.caller_number || '+91-44-6789-0100 (NEXORA AI Support)'}
                </p>
                <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  Purpose: <strong>{incomingCallFromAgent.purpose || 'Order Confirmation & Customer Support'}</strong>
                </p>
                <p className="text-[11px] text-purple-700 font-bold uppercase mt-1">
                  Language: {incomingCallFromAgent.language || 'English'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleRejectAgentCall}
                  className="py-3 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-2xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <PhoneOff className="w-4 h-4 text-rose-500" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={handleAcceptAgentCall}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center space-x-1.5 hover:scale-105"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Accept Call</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SECTION D: DASHBOARD SUB-TABS (ORDERS, APPOINTMENTS, COMPLAINTS, HISTORY)
            ======================================================================= */}
        <section className="space-y-4">
          {/* Sub-tab Navigation */}
          <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-1 text-xs font-bold">
            <button
              onClick={() => setActiveSubTab('voice')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'voice'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Voice Assistant Studio</span>
            </button>

            <button
              onClick={() => setActiveSubTab('orders')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>My Orders ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('tracking')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'tracking'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Order Tracking</span>
            </button>

            <button
              onClick={() => setActiveSubTab('appointments')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'appointments'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Appointments ({appointments.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('complaints')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'complaints'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Complaints & Tickets ({complaints.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'history'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Call History ({callHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('profile')}
              className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                activeSubTab === 'profile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Profile & Settings</span>
            </button>
          </div>

          {/* Sub-tab 1: Voice Assistant Guide */}
          {activeSubTab === 'voice' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 text-xs text-slate-700">
              <h4 className="font-extrabold text-base text-slate-900">
                How to Use the NEXORA AI Voice Assistant
              </h4>
              <p className="leading-relaxed">
                NEXORA AI handles full conversational order inquiries, delivery tracking, product specifications, and returns using autonomous speech.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="font-bold text-slate-900 mb-1">1. Choose Language</p>
                  <p className="text-slate-500 text-[11px]">Select from English, Tamil, Telugu, Malayalam, or Hindi.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="font-bold text-slate-900 mb-1">2. Two-Way Audio</p>
                  <p className="text-slate-500 text-[11px]">Speak naturally through your microphone; our AI replies with natural neural voice.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="font-bold text-slate-900 mb-1">3. Human Handoff</p>
                  <p className="text-slate-500 text-[11px]">Whenever needed, the AI seamlessly transfers your call to a human specialist operator.</p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: My Orders */}
          {activeSubTab === 'orders' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">My Orders History</h4>
                  <p className="text-xs text-slate-500">Track and review all purchases associated with {activeCustomer.phone}</p>
                </div>
                <button
                  onClick={() => setPortalMode('store')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Shop More</span>
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No orders found yet for this account.</p>
                  <button
                    onClick={() => setPortalMode('store')}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.map((ord) => (
                    <div key={ord.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-blue-600">{ord.order_number}</span>
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold uppercase">
                            {ord.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium mt-1">
                          Items: {ord.items ? ord.items.map((i) => `${i.name} (x${i.quantity})`).join(', ') : 'Order items'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Placed on: {new Date(ord.created_at || '').toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">₹{(ord.total_amount || 0).toLocaleString('en-IN')}</p>
                        <button
                          onClick={() => setActiveSubTab('tracking')}
                          className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1"
                        >
                          <span>Track Package</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: Order Tracking */}
          {activeSubTab === 'tracking' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-6">
              <h4 className="font-extrabold text-base text-slate-900">Live Delivery Tracking</h4>

              {orders.length === 0 ? (
                <p className="text-xs text-slate-400">No active orders available for live tracking.</p>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-blue-900">Latest Active Shipment: {orders[0].order_number}</p>
                      <p className="text-[11px] text-blue-700">Estimated Delivery: Express in 2-3 business days</p>
                    </div>
                    <span className="text-xs font-extrabold bg-blue-600 text-white px-3 py-1 rounded-full uppercase">
                      {orders[0].status || 'IN TRANSIT'}
                    </span>
                  </div>

                  {/* 4-Step Timeline */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="space-y-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center mx-auto">
                        ✓
                      </div>
                      <p className="font-bold text-slate-900">Order Placed</p>
                      <p className="text-[10px] text-slate-400">Verified by AI</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center mx-auto">
                        ✓
                      </div>
                      <p className="font-bold text-slate-900">Processing</p>
                      <p className="text-[10px] text-slate-400">Packed in Hub</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center mx-auto animate-pulse">
                        🚚
                      </div>
                      <p className="font-bold text-blue-600">In Transit</p>
                      <p className="text-[10px] text-slate-400">Out for Delivery</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 font-bold flex items-center justify-center mx-auto">
                        4
                      </div>
                      <p className="font-bold text-slate-400">Delivered</p>
                      <p className="text-[10px] text-slate-400">Doorstep Handover</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 4: Appointments */}
          {activeSubTab === 'appointments' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">My Consultations & Callbacks</h4>
                  <p className="text-xs text-slate-500">Scheduled voice calls with AI or human specialists</p>
                </div>
              </div>

              {/* Book Appointment Form */}
              <form onSubmit={handleBookAppointment} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Schedule a New Consultation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={apptService}
                    onChange={(e) => setApptService(e.target.value)}
                    placeholder="Service Name"
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                    required
                  />
                  <input
                    type="text"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    placeholder="YYYY-MM-DD HH:MM"
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Confirm Booking
                  </button>
                  {apptSuccess && <span className="text-xs text-emerald-600 font-bold">Appointment confirmed!</span>}
                </div>
              </form>

              {/* Appointment List */}
              <div className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{a.service_name}</p>
                      <p className="text-[11px] text-slate-500">Scheduled: {a.scheduled_time}</p>
                    </div>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab 5: Complaints & Tickets */}
          {activeSubTab === 'complaints' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-6">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Complaints & Escalation Tickets</h4>
                <p className="text-xs text-slate-500">Track resolution progress or submit a new grievance</p>
              </div>

              {/* Submit Form */}
              <form onSubmit={handleCreateComplaint} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Raise New Grievance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Complaint Subject / Order Issue"
                    value={newComplaintTitle}
                    onChange={(e) => setNewComplaintTitle(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                    required
                  />
                  <select
                    value={newComplaintCategory}
                    onChange={(e) => setNewComplaintCategory(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="ORDER">Order & Delivery Issue</option>
                    <option value="PAYMENT">Payment & Refund</option>
                    <option value="VOICE_CALL">Voice Assistant Issue</option>
                    <option value="PRODUCT">Product Quality & Warranty</option>
                  </select>
                </div>
                <textarea
                  placeholder="Detailed description of the issue..."
                  value={newComplaintDesc}
                  onChange={(e) => setNewComplaintDesc(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs h-20"
                ></textarea>
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Submit Ticket
                  </button>
                  {complaintSuccess && <span className="text-xs text-emerald-600 font-bold">Ticket created successfully!</span>}
                </div>
              </form>

              {/* Complaints List */}
              <div className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-blue-600">{c.ticket_number}</span>
                        <span className="font-bold text-slate-900">{c.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.description}</p>
                    </div>
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase text-[10px] border border-amber-200">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab 6: Call History */}
          {activeSubTab === 'history' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-base text-slate-900">Past Voice Calls</h4>
              {callHistory.length === 0 ? (
                <p className="text-xs text-slate-400">No past call records found.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {callHistory.map((call) => (
                    <div key={call.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">
                            {call.direction === 'OUTBOUND' ? 'Outbound Call from Agent' : 'Customer Inbound Call'}
                          </span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.2 rounded font-bold uppercase">
                            {call.language}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Date: {new Date(call.created_at || '').toLocaleString()} • Duration: {call.duration_seconds}s
                        </p>
                        {call.summary && <p className="text-[11px] text-slate-700 mt-1 italic">"{call.summary}"</p>}
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 uppercase">
                        {call.status || 'COMPLETED'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 7: Profile & Settings */}
          {activeSubTab === 'profile' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-6">
              <h4 className="font-extrabold text-base text-slate-900">My Account Profile</h4>

              {/* Profile Picture Management */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-black overflow-hidden border-2 border-white shadow-md">
                    {activeCustomer.avatar_url ? (
                      <img src={activeCustomer.avatar_url} alt={activeCustomer.name} className="w-full h-full object-cover" />
                    ) : (
                      activeCustomer.name.charAt(0)
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform" title="Upload new photo">
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            if (typeof reader.result === 'string') {
                              try {
                                await api.customerUpdateProfile({ avatar_url: reader.result });
                                await refreshCustomer();
                              } catch (err) {
                                console.error('Failed to update avatar', err);
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Customer Profile Picture</h5>
                  <p className="text-[11px] text-slate-500">Supports JPG, PNG or WebP files. Click the camera icon to upload from your device.</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registered Phone</label>
                  <input
                    type="text"
                    value={activeCustomer.phone}
                    disabled
                    className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono opacity-80"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shipping Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Postal PIN Code</label>
                    <input
                      type="text"
                      value={editPincode}
                      onChange={(e) => setEditPincode(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                  >
                    Save Changes
                  </button>
                  {profileSaved && <span className="text-emerald-600 font-bold">Profile updated successfully!</span>}
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
