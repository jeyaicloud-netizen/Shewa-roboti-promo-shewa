import { phoneAudio } from './audio';
import { ChatMessage } from '../types';

export interface CallEvents {
  onStatusChange?: (status: string) => void;
  onAgentSpeakingChange?: (isSpeaking: boolean) => void;
  onUserSpeakingChange?: (isSpeaking: boolean) => void;
  onTranscriptUpdate?: (speaker: 'agent' | 'user', text: string) => void;
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
  private currentSpeechTranscript = '';

  constructor(events: CallEvents = {}) {
    this.events = events;
  }

  setEvents(events: CallEvents) {
    this.events = events;
  }

  // Pre-cached prompts in Amharic
  readonly welcomePrompt = 'እንኳን ወደ ኢትዮጵያ ንግድ ባንክ የደንበኞች አገልግሎት ማዕከል በደህና መጡ። ለአማርኛ 4ን ይጫኑ። Welcome to Commercial Bank of Ethiopia, for English press 1.';
  readonly agentGreeting = 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ምን ልርዳዎ?';

  // Start the call session
  startCall() {
    this.isCallActive = true;
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

    // 2. Fallback to Browser Speech Synthesis
    await phoneAudio.speakFallback(text);
    this.isAgentSpeaking = false;
    this.events.onAgentSpeakingChange?.(false);
  }

  // Start hands-free automatic listening for user's Amharic voice
  startListening(onResult: (userSpeech: string) => void) {
    if (!this.isCallActive || this.isAgentSpeaking || this.isListening) return;

    this.isListening = true;
    this.currentSpeechTranscript = '';
    this.events.onStatusChange?.('እያዳመጠ ነው... (ተናገሩ)');
    this.events.onUserSpeakingChange?.(false);

    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (this.recognition) {
          this.recognition.abort();
        }
        const rec = new SpeechRecognition();
        rec.lang = 'am-ET'; // Amharic (Ethiopia)
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          this.events.onStatusChange?.('እያዳመጠ ነው...');
        };

        rec.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              this.currentSpeechTranscript += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          const combined = (this.currentSpeechTranscript + interim).trim();
          if (combined.length > 0) {
            this.events.onUserSpeakingChange?.(true);
            this.events.onTranscriptUpdate?.('user', combined);

            // Debounce silence: after 1.4 seconds of silence from the user, send to AI!
            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
              if (this.isListening && combined.length > 0) {
                this.stopListening();
                onResult(combined);
              }
            }, 1400);
          }
        };

        rec.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'no-speech') {
            // Keep listening
          } else {
            this.fallbackMicrophoneRecording(onResult);
          }
        };

        rec.onend = () => {
          if (this.isListening && this.isCallActive && !this.isAgentSpeaking) {
            try {
              rec.start();
            } catch (err) {
              // Ignore restart error
            }
          }
        };

        this.recognition = rec;
        rec.start();
        return;
      } catch (e) {
        console.warn('SpeechRecognition init error:', e);
      }
    }

    // Fallback if browser doesn't have Web Speech API: use MediaRecorder
    this.fallbackMicrophoneRecording(onResult);
  }

  // Fallback MediaRecorder for devices without Web Speech Recognition
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

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          // Call backend transcribe-and-reply
          try {
            this.events.onStatusChange?.('ድምፅዎን በማስተናገድ ላይ...');
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
              if (data.transcribedText) {
                this.events.onTranscriptUpdate?.('user', data.transcribedText);
              }
              this.handleAiReply(data.replyText, data.audioBase64, onResult);
            }
          } catch (err) {
            console.error('Audio transcribe error:', err);
          }
        };
      };

      this.mediaRecorder.start(250);
      this.events.onStatusChange?.('እያዳመጠ ነው...');
    } catch (micErr) {
      console.error('Mic access error:', micErr);
      this.events.onError?.('ማይክሮፎን አልተፈቀደም። እባክዎትን የማይክሮፎን ፈቃድ ይስጡ።');
    }
  }

  stopListening() {
    this.isListening = false;
    this.events.onUserSpeakingChange?.(false);
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
      this.history.push({ role: 'model', text: reply });

      await this.handleAiReply(reply, data.audioBase64, onNextTurn);
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
  private async handleAiReply(replyText: string, audioBase64: string | null, onNextTurn: (text: string) => void) {
    if (!this.isCallActive) return;

    this.isAgentSpeaking = true;
    this.events.onAgentSpeakingChange?.(true);
    this.events.onStatusChange?.('የኢትዮጵያ ንግድ ባንክ እየመለሰ ነው...');
    this.events.onTranscriptUpdate?.('agent', replyText);

    if (audioBase64) {
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

    // Automatically resume listening hands-free!
    if (this.isCallActive) {
      this.startListening(onNextTurn);
    }
  }
}
