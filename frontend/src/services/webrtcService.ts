// Real-time WebRTC Peer-to-Peer Two-Way Audio Communication Service
// Connects Customer and Agent browser tabs with STUN audio streaming

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private callId: string | null = null;
  private sendSignalCallback: ((data: any) => void) | null = null;
  private onConnectionStateCallback: ((state: string) => void) | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
    }
  }

  async startLocalAudio(): Promise<MediaStream | null> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('[WebRTC] Local microphone stream acquired successfully.');
        return this.localStream;
      }
    } catch (err) {
      console.warn('[WebRTC] Microphone permission request deferred or denied:', err);
    }
    return null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  setConnectionStateCallback(cb: (state: string) => void) {
    this.onConnectionStateCallback = cb;
  }

  async initializeConnection(
    callId: string,
    isInitiator: boolean,
    sendSignal: (data: any) => void,
    onRemoteTrack?: (stream: MediaStream) => void
  ): Promise<void> {
    this.close();
    this.callId = callId;
    this.sendSignalCallback = sendSignal;
    this.pendingCandidates = [];

    try {
      this.pc = new RTCPeerConnection(RTC_CONFIG);

      // 1. Acquire local microphone stream if not already active
      if (!this.localStream) {
        await this.startLocalAudio();
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          if (this.pc && this.localStream) {
            this.pc.addTrack(track, this.localStream);
          }
        });
      } else {
        // Ensure bidirectional audio transceiver even if mic is unattached initially
        this.pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      // 2. Handle ICE Candidates
      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.sendSignalCallback && this.callId) {
          this.sendSignalCallback({
            event: 'webrtc_ice',
            call_id: this.callId,
            candidate: event.candidate
          });
        }
      };

      // 3. Handle Remote Audio Track
      this.pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        console.log('[WebRTC] Remote audio track received from peer.');
        if (this.remoteAudio && remoteStream) {
          this.remoteAudio.srcObject = remoteStream;
          this.remoteAudio.play().catch((playErr) => {
            console.log('[WebRTC] Audio autoplay policy deferred:', playErr);
          });
        }
        if (onRemoteTrack && remoteStream) {
          onRemoteTrack(remoteStream);
        }
      };

      // 4. Monitor Connection State
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState || 'closed';
        console.log(`[WebRTC] Connection State for Call ${callId}:`, state);
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback(state);
        }
      };

      // 5. If Initiator (Caller / Customer), generate and send Offer
      if (isInitiator) {
        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true
        });
        await this.pc.setLocalDescription(offer);

        if (this.sendSignalCallback) {
          this.sendSignalCallback({
            event: 'webrtc_offer',
            call_id: this.callId,
            sdp: offer
          });
        }
        console.log('[WebRTC] SDP Offer created and sent.');
      }
    } catch (err) {
      console.error('[WebRTC] PeerConnection initialization error:', err);
    }
  }

  async handleSignalMessage(data: any): Promise<void> {
    if (!this.pc) return;

    try {
      if (data.event === 'webrtc_offer' && data.sdp) {
        if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'have-local-offer') {
          console.warn('[WebRTC] Offer ignored due to signalingState:', this.pc.signalingState);
          return;
        }
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        // Flush any queued ICE candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (this.sendSignalCallback && this.callId) {
          this.sendSignalCallback({
            event: 'webrtc_answer',
            call_id: this.callId,
            sdp: answer
          });
        }
        console.log('[WebRTC] SDP Answer created and sent to initiator.');

      } else if (data.event === 'webrtc_answer' && data.sdp) {
        if (this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log('[WebRTC] SDP Answer applied successfully.');

          // Flush any queued ICE candidates
          while (this.pendingCandidates.length > 0) {
            const cand = this.pendingCandidates.shift();
            if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }

      } else if (data.event === 'webrtc_ice' && data.candidate) {
        try {
          if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
            await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            // Buffer candidate until remote description is settled
            this.pendingCandidates.push(data.candidate);
          }
        } catch (e) {
          console.warn('[WebRTC] Error adding ICE candidate:', e);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Error processing signaling message:', err);
    }
  }

  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  setSpeaker(enabled: boolean): void {
    if (this.remoteAudio) {
      this.remoteAudio.muted = !enabled;
    }
  }

  close(): void {
    this.pendingCandidates = [];
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }
    this.callId = null;
    this.sendSignalCallback = null;
  }
}

export const webrtcService = new WebRTCService();
