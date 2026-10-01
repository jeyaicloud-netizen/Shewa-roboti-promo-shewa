import React from 'react';
import { Phone, Building2 } from 'lucide-react';
import { Contact } from '../types';

interface ContactsListProps {
  contacts: Contact[];
  onCall: (number: string) => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({ contacts, onCall }) => {
  return (
    <div className="w-full h-full flex flex-col px-4 py-2 overflow-y-auto">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-3">
        ዕውቂያዎች (Contacts)
      </div>

      <div className="flex flex-col divide-y divide-slate-800/60">
        {contacts.map((c) => {
          return (
            <div
              key={c.id}
              onClick={() => onCall(c.number)}
              className="flex items-center justify-between py-3.5 px-2 hover:bg-slate-800/40 active:bg-slate-800/70 rounded-xl cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${
                    c.isCbe
                      ? 'bg-gradient-to-tr from-amber-500 to-amber-700 text-slate-950 ring-2 ring-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {c.isCbe ? <Building2 className="w-5 h-5 text-slate-950" /> : c.name.slice(0, 1)}
                </div>

                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${c.isCbe ? 'text-amber-400 font-semibold' : 'text-slate-100'}`}>
                    {c.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <span>{c.number}</span>
                    {c.label && <span>• {c.label}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCall(c.number);
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
