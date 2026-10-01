import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Grid,
  Pause,
  Play,
  UserPlus,
  Disc,
  User,
} from 'lucide-react';
import { CallState, IvrStep } from '../types';
import { phoneAudio } from '../utils/audio';

interface ActiveCallScreenProps {
  number: string;
  callState: CallState;
  ivrStep: IvrStep;
  durationSeconds: number;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isSpeakerOn?: boolean;
  onToggleSpeaker?: () => void;
  callStatusText?: string;
  micPermissionDenied?: boolean;
  onRequestMicPermission?: () => void;
  onSendUserText?: (text: string) => void;
  onFinishSpeaking?: () => void;
  onEndCall: () => void;
  onDtmfKey: (digit: string) => void;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  number,
  callState,
  ivrStep,
  durationSeconds,
  isAgentSpeaking,
  isUserSpeaking,
  isMuted = false,
  onToggleMute,
  isSpeakerOn = true,
  onToggleSpeaker,
  onEndCall,
  onDtmfKey,
}) => {
  const [isOnHold, setIsOnHold] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

  // Automatically show keypad during IVR welcome menu if user needs to press 4
  useEffect(() => {
    if (ivrStep === 'welcome_menu') {
      setShowInCallKeypad(true);
    } else if (ivrStep === 'agent_intro' || ivrStep === 'active_call') {
      setShowInCallKeypad(false);
    }
  }, [ivrStep]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleKeypadPress = (digit: string) => {
    phoneAudio.playDtmf(digit);
    onDtmfKey(digit);
  };

  const isRinging = callState === 'ringing' || callState === 'dialing';

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-white text-[#202124] overflow-hidden select-none font-sans">
      {/* Top Google Phone Status Bar (White Theme) */}
      <div className="pt-4 px-6 flex items-center justify-between z-10 text-xs text-[#5F6368]">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-[11px] bg-[#E8F0FE] text-[#1A73E8] px-1.5 py-0.5 rounded font-semibold">HD</span>
        </div>

        {/* Call Timer */}
        <div className="font-mono text-xs tracking-wider text-[#3C4043] font-medium">
          {isRinging ? 'በመደወል ላይ...' : formatTime(durationSeconds)}
        </div>

        {/* Subtle hardware-like LED dot:
            - RED DOT when recording user
            - GREEN DOT when other side is speaking */}
        <div className="flex items-center justify-end w-6">
          {isUserSpeaking ? (
            <span
              className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              aria-label="Microphone recording"
            />
          ) : isAgentSpeaking ? (
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
              aria-label="Speaker active"
            />
          ) : (
            <span className="w-2 h-2" />
          )}
        </div>
      </div>

      {/* Main Caller Profile Section (Pure Google Pixel Phone Style) */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 -mt-6">
        {/* Neutral Google Contact Avatar - No CBE logo */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-28 h-28 rounded-full bg-[#E8F0FE] border border-blue-100 flex items-center justify-center shadow-sm">
            <User className="w-14 h-14 text-[#1A73E8]" />
          </div>
        </div>

        {/* Number / Name Display - Standard Google Phone style */}
        <h1 className="text-3xl font-normal tracking-tight text-[#202124] mb-1 text-center font-mono">
          {number}
        </h1>
        <p className="text-sm font-normal text-[#5F6368] text-center">
          {isRinging ? 'በመደወል ላይ...' : 'የተገናኘ ጥሪ'}
        </p>
      </div>

      {/* In-Call DTMF Keypad (Light Theme) */}
      {showInCallKeypad && (
        <div className="px-6 py-4 bg-white/95 backdrop-blur-md border-t border-gray-200 rounded-t-3xl z-20 shadow-lg animate-slideUp">
          <div className="flex items-center justify-between mb-3 px-3">
            <span className="text-xs font-medium text-[#5F6368]">ቁልፍ ሰሌዳ</span>
            <button
              onClick={() => setShowInCallKeypad(false)}
              className="text-xs text-[#5F6368] hover:text-[#202124] px-2 py-1"
            >
              ዝጋ ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeypadPress(digit)}
                className="h-12 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#202124] font-medium text-xl flex items-center justify-center active:scale-95 transition-all shadow-sm"
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Google Phone Standard 6-Button Controls (Light Theme) */}
      <div className="px-8 pb-8 z-10">
        <div className="grid grid-cols-3 gap-y-5 gap-x-6 max-w-xs mx-auto mb-8">
          {/* 1. Mute */}
          <button
            onClick={onToggleMute}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                isMuted
                  ? 'bg-[#C2E7FF] text-[#001D35] ring-2 ring-[#1A73E8]'
                  : 'bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] active:scale-95'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-[#1A73E8]" /> : <Mic className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-[#5F6368] font-medium">
              {isMuted ? 'ድምፅ ጠፍቷል' : 'ድምፅ አጥፋ'}
            </span>
          </button>

          {/* 2. Keypad */}
          <button
            onClick={() => setShowInCallKeypad(!showInCallKeypad)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                showInCallKeypad
                  ? 'bg-[#C2E7FF] text-[#001D35] ring-2 ring-[#1A73E8]'
                  : 'bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] active:scale-95'
              }`}
            >
              <Grid className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-[#5F6368]">ቁልፍ ሰሌዳ</span>
          </button>

          {/* 3. Speaker */}
          <button
            onClick={onToggleSpeaker}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                isSpeakerOn
                  ? 'bg-[#C2E7FF] text-[#001D35] ring-2 ring-[#1A73E8]'
                  : 'bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] active:scale-95'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6 text-[#1A73E8]" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-[#5F6368] font-medium">
              {isSpeakerOn ? 'ስፒከር (በርቷል)' : 'ስፒከር (ጠፍቷል)'}
            </span>
          </button>

          {/* 4. Add call */}
          <button
            onClick={() => {}}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-14 h-14 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] flex items-center justify-center text-[#3C4043] active:scale-95 transition-all shadow-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-[#5F6368]">ጥሪ ጨምር</span>
          </button>

          {/* 5. Hold */}
          <button
            onClick={() => setIsOnHold(!isOnHold)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                isOnHold
                  ? 'bg-[#1A73E8] text-white shadow-md'
                  : 'bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] active:scale-95'
              }`}
            >
              {isOnHold ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-[#5F6368]">አቆይ</span>
          </button>

          {/* 6. Record */}
          <button
            onClick={() => {}}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-14 h-14 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] flex items-center justify-center text-[#3C4043] active:scale-95 transition-all shadow-sm">
              <Disc className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-[#5F6368]">ቅዳ</span>
          </button>
        </div>

        {/* Circular Red Hang Up Button (Google Phone Material Style) */}
        <div className="w-full flex items-center justify-center">
          <button
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-[#EA4335] hover:bg-[#D93025] active:scale-95 transition-all shadow-lg shadow-red-500/25 flex items-center justify-center text-white"
            aria-label="ጥሪ ዝጋ"
          >
            <PhoneOff className="w-7 h-7 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
