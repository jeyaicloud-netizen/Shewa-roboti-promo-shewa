import React from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { CallLog } from '../types';

interface RecentsListProps {
  logs: CallLog[];
  onCall: (number: string) => void;
}

export const RecentsList: React.FC<RecentsListProps> = ({ logs, onCall }) => {
  return (
    <div className="w-full h-full flex flex-col px-4 py-2 overflow-y-auto">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-3">
        የቅርብ ጊዜ ጥሪዎች (Recents)
      </div>

      <div className="flex flex-col divide-y divide-slate-800/60">
        {logs.map((log) => {
          const isCbe = log.number === '951';

          return (
            <div
              key={log.id}
              onClick={() => onCall(log.number)}
              className="flex items-center justify-between py-3.5 px-2 hover:bg-slate-800/40 active:bg-slate-800/70 rounded-xl cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3.5">
                {/* Avatar Icon */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${
                    isCbe
                      ? 'bg-gradient-to-tr from-amber-500 to-amber-700 text-slate-950 ring-2 ring-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {isCbe ? 'CBE' : log.name.slice(0, 1)}
                </div>

                {/* Details */}
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${isCbe ? 'text-amber-400 font-semibold' : 'text-slate-100'}`}>
                    {log.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    {log.type === 'outgoing' && <PhoneOutgoing className="w-3 h-3 text-emerald-400" />}
                    {log.type === 'incoming' && <PhoneIncoming className="w-3 h-3 text-blue-400" />}
                    {log.type === 'missed' && <PhoneMissed className="w-3 h-3 text-rose-400" />}
                    <span>{log.number}</span>
                    <span>•</span>
                    <span>{log.time}</span>
                  </div>
                </div>
              </div>

              {/* Quick Call Icon Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCall(log.number);
                }}
                className="w-10 h-10 rounded-full bg-slate-800/70 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 text-slate-400 flex items-center justify-center transition-all"
                title="ደውል"
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
