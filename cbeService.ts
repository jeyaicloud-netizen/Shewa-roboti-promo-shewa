import { phoneAudio } from './audio';
import { ChatMessage } from '../types';
import { CBE_WELCOME_AUDIO, CBE_GREETING_AUDIO } from './cachedAudio';

export interface CallEvents {
  onStatusChange?: (status: string) => void;
  onAgentSpeakingChange?: (isSpeaking: boolean) => void;
  onUserSpeakingChange?: (isSpeaking: boolean) => void;
  onTranscriptUpdate?: (speaker: 'agent' | 'user', text: string) => void;
  onMicPermissionDenied?: (denied: boolean) => void;
  onError?: (errorText: string) => void;
}

export class CbePhoneManager {
  private events: CallEvents;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private history: ChatMessage[] = [];
  private isCallActive = false;
  private isAgentSpeaking = false;
  private isListening = false;
  private silenceTimer: any = null;
  private vadInterval: any = null;
  private recordTimeout: any = null;
  private stopRecordingFn: (() => void) | null = null;
  private onResultCallback: ((text: string) => void) | null = null;
  private currentSpeechTranscript = '';
  public isMuted: boolean = false;

  constructor(events: CallEvents = {}) {
    this.events = events;
  }

  setEvents(events: CallEvents) {
    this.events = events;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.events.onUserSpeakingChange?.(false);
    }
  }

  // Pre-cached prompts in Amharic
  readonly welcomePrompt = 'እንኳን ወደ ኢትዮጵያ ንግድ ባንክ የደንበኞች አገልግሎት ማዕከል በደህና መጡ። ለአማርኛ 4ን ይጫኑ። Welcome to Commercial Bank of Ethiopia, for English press 1.';
  readonly agentGreeting = 'የኢትዮጵያ ንግድ ባንክ አመሃ ነኝ፤ እባክዎት ምን ልርዳዎት?';

  // Start the call session
  startCall() {
    this.isCallActive = true;
    this.isMuted = false;
    this.history = [];
    this.currentSpeechTranscript = '';
  }

  // End the call
  endCall() {
    this.isCallActive = false;
    this.stopListening();
    phoneAudio.stopCurrentAudio();
    phoneAudio.stopRingback();
    phoneAudio.playCallEnded();
  }

  // Play pre-cached authentic welcome prompt immediately (0ms delay)
  async playWelcomePrompt(): Promise<void> {
    if (!this.isCallActive) return;
    this.isAgentSpeaking = true;
    this.events.onAgentSpeakingChange?.(true);
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ የጥሪ ማዕከል');
    this.events.onTranscriptUpdate?.('agent', this.welcomePrompt);

    try {
      await phoneAudio.playBase64Audio(CBE_WELCOME_AUDIO);
    } catch (e) {
      console.warn('Cached welcome audio playback warning:', e);
      await this.speakAgent(this.welcomePrompt);
    } finally {
      this.isAgentSpeaking = false;
      this.events.onAgentSpeakingChange?.(false);
    }
  }

  // Play recorded authentic agent greeting immediately (0ms delay)
  async playAgentGreeting(): Promise<void> {
    if (!this.isCallActive) return;
    this.isAgentSpeaking = true;
    this.events.onAgentSpeakingChange?.(true);
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ አመሃ ነኝ፤ እባክዎት ምን ልርዳዎት?');
    this.events.onTranscriptUpdate?.('agent', this.agentGreeting);

    try {
      await phoneAudio.playAudioFile('/audio/1_cbe_greeting_ameha.mp3');
    } catch (e) {
      console.warn('Playing custom greeting MP3 fallback:', e);
      await phoneAudio.playBase64Audio(CBE_GREETING_AUDIO);
    } finally {
      this.isAgentSpeaking = false;
      this.events.onAgentSpeakingChange?.(false);
    }
  }

  // Speak agent message (via Server TTS -> Web Audio fallback)
  async speakAgent(text: string): Promise<void> {
    if (!this.isCallActive) return;

    this.isAgentSpeaking = true;
    this.events.onAgentSpeakingChange?.(true);
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ እየተናገረ ነው...');
    this.events.onTranscriptUpdate?.('agent', text);

    try {
      // 1. Try server Gemini TTS first (high quality, native voice)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          await phoneAudio.playBase64Audio(data.audioBase64);
          this.isAgentSpeaking = false;
          this.events.onAgentSpeakingChange?.(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Server TTS failed, using browser speech fallback', e);
    }

    // 2. Fallback to Browser Speech Synthesis (only if Amharic voice is available)
    await phoneAudio.speakFallback(text);
    this.isAgentSpeaking = false;
    this.events.onAgentSpeakingChange?.(false);
  }

  // Start hands-free automatic listening for user's voice (completely silent, no browser chimes)
  startListening(onResult: (userSpeech: string) => void) {
    if (!this.isCallActive || this.isAgentSpeaking || this.isListening) return;

    this.isListening = true;
    this.currentSpeechTranscript = '';
    this.events.onUserSpeakingChange?.(false);

    // Use MediaRecorder with AudioContext VAD directly:
    // This is 100% silent (no browser SpeechRecognition "kew-kew" chime) and works universally
    this.fallbackMicrophoneRecording(onResult);
  }

  // Fallback MediaRecorder with real-time volume analysis and silence detection
  private async fallbackMicrophoneRecording(onResult: (text: string) => void) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Set up AudioContext for volume analysis and silence detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();
      let hasSpoken = false;
      let isStopping = false;

      const stopRecordingAndSend = () => {
        if (isStopping) return;
        isStopping = true;
        this.stopRecordingFn = null;

        if (this.vadInterval) {
          clearInterval(this.vadInterval);
          this.vadInterval = null;
        }
        if (this.recordTimeout) {
          clearTimeout(this.recordTimeout);
          this.recordTimeout = null;
        }

        try {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          }
          stream.getTracks().forEach((track) => track.stop());
          if (audioCtx.state !== 'closed') {
            audioCtx.close();
          }
        } catch (e) {
          console.warn('Error stopping media recorder:', e);
        }
      };

      this.stopRecordingFn = stopRecordingAndSend;

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          // No audio captured, resume listening
          if (this.isCallActive && !this.isAgentSpeaking) {
            this.startListening(onResult);
          }
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const resultStr = typeof reader.result === 'string' ? reader.result : '';
          const commaIdx = resultStr.indexOf(',');
          const base64Data = commaIdx !== -1 ? resultStr.substring(commaIdx + 1) : '';

          if (!base64Data || base64Data.length < 100) {
            // Nothing substantial captured, resume listening
            if (this.isCallActive && !this.isAgentSpeaking) {
              this.startListening(onResult);
            }
            return;
          }

          try {
            this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ በማሰብ ላይ...');
            const res = await fetch('/api/transcribe-and-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Data,
                mimeType: 'audio/webm',
                history: this.history,
              }),
            });
            const data = await res.json();
            if (data.replyText) {
              if (data.transcribedText && data.transcribedText !== 'ድምፅ አልተሰማም') {
                this.events.onTranscriptUpdate?.('user', data.transcribedText);
                this.history.push({ role: 'user', text: data.transcribedText });
              }
              this.history.push({ role: 'model', text: data.replyText, audioUrl: data.audioUrl });
              this.handleAiReply(data.replyText, data.audioBase64, data.audioUrl, onResult);
            } else {
              this.startListening(onResult);
            }
          } catch (err) {
            console.error('Audio transcribe error:', err);
            this.startListening(onResult);
          }
        };
      };

      // Check audio volume every 100ms
      this.vadInterval = setInterval(() => {
        if (!this.isListening || isStopping) return;
        if (this.isMuted) {
          this.events.onUserSpeakingChange?.(false);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        if (avg > 12) {
          // User is actively speaking
          hasSpoken = true;
          this.events.onUserSpeakingChange?.(true);
          silenceStart = Date.now();
        } else {
          this.events.onUserSpeakingChange?.(false);
          // If the user has spoken, and there has been silence for 1.6 seconds, trigger finish!
          if (hasSpoken && Date.now() - silenceStart > 1600) {
            stopRecordingAndSend();
          }
        }
      }, 100);

      // Maximum 10 seconds recording safety limit to never get stuck
      this.recordTimeout = setTimeout(() => {
        if (hasSpoken) {
          stopRecordingAndSend();
        }
      }, 10000);

      this.mediaRecorder.start(250);
      this.events.onStatusChange?.('እያዳመጠ ነው... (ይናገሩ)');
      this.events.onMicPermissionDenied?.(false);
    } catch (micErr) {
      console.warn('Mic access permission not granted yet:', micErr);
      this.events.onMicPermissionDenied?.(true);
      this.events.onStatusChange?.('የማይክሮፎን ፈቃድ ያስፈልጋል');
      this.events.onError?.('የማይክሮፎን ፈቃድ አልተሰጠም። እባክዎትን ፍቀድ የሚለውን ይጫኑ ወይም በጽሁፍ ይናገሩ።');
    }
  }

  // Manually finish speaking (user pressed "ተናግሬ ጨረስኩ")
  finishSpeakingManually() {
    if (this.stopRecordingFn) {
      this.stopRecordingFn();
      this.stopRecordingFn = null;
    } else if (this.currentSpeechTranscript.trim().length > 0 && this.onResultCallback) {
      const text = this.currentSpeechTranscript.trim();
      this.stopListening();
      this.onResultCallback(text);
    }
  }

  // Explicit user-triggered permission request
  async requestMicPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.events.onMicPermissionDenied?.(false);
      this.events.onStatusChange?.('ማይክሮፎን ተፈቅዷል');
      return true;
    } catch (err) {
      console.warn('Microphone permission request error:', err);
      this.events.onMicPermissionDenied?.(true);
      return false;
    }
  }

  stopListening() {
    this.isListening = false;
    this.events.onUserSpeakingChange?.(false);
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.recordTimeout) {
      clearTimeout(this.recordTimeout);
      this.recordTimeout = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        // ignore
      }
    }
  }

  // Process text conversation turn with Gemini
  async processUserMessage(userText: string, onNextTurn: (text: string) => void) {
    if (!this.isCallActive) return;

    this.history.push({ role: 'user', text: userText });
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ በማሰብ ላይ...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: this.history,
        }),
      });

      const data = await response.json();
      const reply = data.replyText || 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ጥያቄዎን በድጋሚ ይንገሩኝ?';
      this.history.push({ role: 'model', text: reply, audioUrl: data.audioUrl });

      await this.handleAiReply(reply, data.audioBase64, data.audioUrl, onNextTurn);
    } catch (err: any) {
      console.error('Chat error:', err);
      const fallbackReply = 'ይቅርታ ደንበኛችን፣ የመስመር መቆራረጥ አጋጥሟል። እባክዎትን ጥያቄዎን ደግመው ያሰሙን።';
      await this.speakAgent(fallbackReply);
      if (this.isCallActive) {
        this.startListening(onNextTurn);
      }
    }
  }

  // Handle AI reply playback and automatically reopen mic
  private async handleAiReply(
    replyText: string,
    audioBase64: string | null,
    audioUrl: string | null | undefined,
    onNextTurn: (text: string) => void
  ) {
    if (!this.isCallActive) return;

    this.isAgentSpeaking = true;
    this.events.onAgentSpeakingChange?.(true);
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ እየመለሰ ነው...');
    this.events.onTranscriptUpdate?.('agent', replyText);

    if (audioUrl) {
      try {
        await phoneAudio.playAudioFile(audioUrl);
      } catch (e) {
        console.warn('Playing audioUrl failed:', e);
      }
    } else if (audioBase64) {
      try {
        await phoneAudio.playBase64Audio(audioBase64);
      } catch (e) {
        console.warn('Playing audio base64 failed, falling back:', e);
        await phoneAudio.speakFallback(replyText);
      }
    } else {
      await phoneAudio.speakFallback(replyText);
    }

    this.isAgentSpeaking = false;
    this.events.onAgentSpeakingChange?.(false);

    // Automatically resume listening hands-free ONLY AFTER audio playback finishes completely!
    if (this.isCallActive) {
      this.startListening(onNextTurn);
    }
  }
}
