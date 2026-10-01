import React from 'react';
import { Delete, Phone } from 'lucide-react';
import { phoneAudio } from '../utils/audio';

interface KeypadProps {
  number: string;
  onNumberChange: (num: string) => void;
  onCall: (num: string) => void;
}

const KEYS = [
  { digit: '1', sub: '⚿' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

export const Keypad: React.FC<KeypadProps> = ({ number, onNumberChange, onCall }) => {
  const handleKeyPress = (digit: string) => {
    phoneAudio.playDtmf(digit);
    onNumberChange(number + digit);
  };

  const handleDelete = () => {
    onNumberChange(number.slice(0, -1));
  };

  const handleClear = () => {
    onNumberChange('');
  };

  const isCbeMatch = number === '951' || number === '95' || number === '9';

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-sm mx-auto h-full px-6 pb-6 pt-2">
      {/* Top Number Display */}
      <div className="w-full flex flex-col items-center justify-center min-h-[90px] mb-2">
        {number ? (
          <div className="w-full flex flex-col items-center">
            {isCbeMatch && (
              <div className="text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full mb-1 flex items-center gap-1.5 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                የኢትዮጵያ ንግድ ባንክ (CBE 951)
              </div>
            )}
            <div className="relative w-full flex items-center justify-center">
              <span className="text-4xl font-normal tracking-wider text-slate-100 select-all font-mono">
                {number}
              </span>
              <button
                onClick={handleDelete}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleClear();
                }}
                className="absolute right-2 p-2 text-slate-400 hover:text-slate-200 active:scale-90 transition-transform"
                title="አጥፋ"
                aria-label="Delete"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
            {number === '951' && (
              <span className="text-xs text-slate-400 mt-1">የደንበኞች አገልግሎት ማዕከል</span>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <span>ቁጥር ይተይቡ (ለምሳሌ፡ <strong className="text-amber-400 font-semibold cursor-pointer" onClick={() => onNumberChange('951')}>951</strong>)</span>
          </div>
        )}
      </div>

      {/* Dial Keys Grid */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3.5 w-full max-w-[280px]">
        {KEYS.map((k) => (
          <button
            key={k.digit}
            onClick={() => handleKeyPress(k.digit)}
            className="w-18 h-18 mx-auto rounded-full bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-600 active:scale-95 transition-all duration-100 flex flex-col items-center justify-center border border-slate-700/40 shadow-sm"
          >
            <span className="text-2xl font-light text-slate-100 leading-none">{k.digit}</span>
            {k.sub && (
              <span className="text-[10px] font-medium text-slate-400 tracking-widest mt-1 uppercase">
                {k.sub}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Call Button */}
      <div className="mt-5 w-full flex items-center justify-center">
        <button
          onClick={() => {
            const numToCall = number.trim() || '951';
            onCall(numToCall);
          }}
          className="w-18 h-18 rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white"
          aria-label="ደውል"
        >
          <Phone className="w-8 h-8 fill-current" />
        </button>
      </div>
    </div>
  );
};
