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
  Radio,
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
  callStatusText: string;
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
  callStatusText,
  onEndCall,
  onDtmfKey,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

  // Automatically open or highlight keypad during IVR menu so user easily presses 4
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
  const isCbe = number === '951';

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 overflow-hidden select-none">
      {/* Top Status Bar (Google Phone Style) */}
      <div className="pt-4 px-6 flex items-center justify-between z-10 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>HD ጥሪ</span>
        </div>
        <div className="font-mono text-sm tracking-wider text-slate-200">
          {isRinging ? 'በመደወል ላይ...' : formatTime(durationSeconds)}
        </div>
        {/* Android Green Mic Indicator when microphone is actively listening */}
        <div className="flex items-center gap-1">
          {ivrStep === 'active_call' && !isAgentSpeaking && (
            <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] animate-pulse">
              <Mic className="w-3 h-3 fill-current" />
              <span>ማይክ ክፍት ነው</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Caller Profile Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Large Avatar with Acoustic Wave Rings */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Pulsing ring when agent or user speaks */}
          {(isAgentSpeaking || isUserSpeaking) && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-amber-500/15 animate-ping"></div>
              <div className="absolute w-32 h-32 rounded-full bg-amber-500/25 animate-pulse"></div>
            </>
          )}

          {/* CBE Gold & Purple Avatar */}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-[#581c87] via-[#7e22ce] to-[#d97706] p-1 shadow-2xl flex items-center justify-center border-2 border-amber-400/40">
            <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
              {isCbe ? (
                <div className="flex flex-col items-center justify-center text-center p-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-md mb-0.5">
                    CBE
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 tracking-wider">ንግድ ባንክ</span>
                </div>
              ) : (
                <span className="text-3xl font-light text-slate-200">{number.slice(0, 2)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Contact Name & Number */}
        <h1 className="text-2xl font-medium tracking-tight text-white mb-1 text-center">
          {isCbe ? 'የኢትዮጵያ ንግድ ባንክ' : `ቁጥር: ${number}`}
        </h1>
        <p className="text-sm font-normal text-slate-400 mb-2">
          {number} {isCbe && '• የደንበኞች አገልግሎት'}
        </p>

        {/* Subtle Call Status indicator (Clean, non-AI) */}
        <div className="h-6 flex items-center justify-center">
          {isRinging ? (
            <span className="text-xs text-amber-400/90 flex items-center gap-1.5 animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              ጥሪ እየተገናኘ ነው...
            </span>
          ) : isOnHold ? (
            <span className="text-xs text-amber-400 font-medium">ጥሪው ተቆይቷል</span>
          ) : (
            <span className="text-xs text-slate-400">
              {callStatusText}
            </span>
          )}
        </div>
      </div>

      {/* In-Call DTMF Keypad (Opens when user taps Keypad or during IVR prompt "ለአማርኛ 4ን ይጫኑ") */}
      {showInCallKeypad && (
        <div className="px-6 py-3 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 rounded-t-3xl z-20 animate-slideUp">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-medium text-amber-400">
              {ivrStep === 'welcome_menu' ? 'ለአማርኛ 4ን ይጫኑ (Press 4)' : 'የቁልፍ ሰሌዳ (Keypad)'}
            </span>
            <button
              onClick={() => setShowInCallKeypad(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              ዝጋ ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeypadPress(digit)}
                className={`h-12 rounded-full flex items-center justify-center transition-all ${
                  digit === '4' && ivrStep === 'welcome_menu'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold scale-105 shadow-lg shadow-amber-500/40 animate-bounce'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-100 font-medium active:scale-95'
                }`}
              >
                <span className="text-xl">{digit}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* In-Call Controls Grid (Google Pixel standard 6-button layout) */}
      <div className="px-8 pb-4 z-10">
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 max-w-xs mx-auto mb-8">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-white text-slate-950'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 active:scale-95'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-slate-400">ድምፅ አጥፋ</span>
          </button>

          {/* Keypad Button */}
          <button
            onClick={() => setShowInCallKeypad(!showInCallKeypad)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                showInCallKeypad
                  ? 'bg-white text-slate-950'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 active:scale-95'
              }`}
            >
              <Grid className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-slate-400">ቁልፍ ሰሌዳ</span>
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn
                  ? 'bg-white text-slate-950'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 active:scale-95'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-slate-400">ስፒከር</span>
          </button>

          {/* Add Call Button */}
          <button
            onClick={() => {}}
            className="flex flex-col items-center gap-1.5 group opacity-70"
          >
            <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-[11px] text-slate-400">ጥሪ ጨምር</span>
          </button>

          {/* Hold Button */}
          <button
            onClick={() => setIsOnHold(!isOnHold)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isOnHold
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 active:scale-95'
              }`}
            >
              {isOnHold ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            </div>
            <span className="text-[11px] text-slate-400">አቆይ (Hold)</span>
          </button>

          {/* Direct Press 4 Quick Button (During IVR step) */}
          <button
            onClick={() => handleKeypadPress('4')}
            className={`flex flex-col items-center gap-1.5 group transition-all ${
              ivrStep === 'welcome_menu' ? 'scale-105' : 'opacity-80'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                ivrStep === 'welcome_menu'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40 animate-pulse'
                  : 'bg-slate-800/80 text-amber-400'
              }`}
            >
              4
            </div>
            <span className="text-[11px] text-amber-400 font-medium">ለአማርኛ (4)</span>
          </button>
        </div>

        {/* Big Red Hang Up Button */}
        <div className="w-full flex items-center justify-center pb-4">
          <button
            onClick={onEndCall}
            className="w-18 h-18 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 active:scale-95 transition-all shadow-xl shadow-rose-600/40 flex items-center justify-center text-white"
            aria-label="ጥሪ ዝጋ"
          >
            <PhoneOff className="w-8 h-8 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
