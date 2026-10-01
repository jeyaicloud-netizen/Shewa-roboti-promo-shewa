import { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Clock,
  Users,
  Search,
  MoreVertical,
  X,
  Sparkles,
} from 'lucide-react';
import { TabType, CallState, IvrStep, CallLog, Contact } from './types';
import { phoneAudio } from './utils/audio';
import { CbePhoneManager } from './utils/cbeService';
import { Keypad } from './components/Keypad';
import { ActiveCallScreen } from './components/ActiveCallScreen';
import { RecentsList } from './components/RecentsList';
import { ContactsList } from './components/ContactsList';

const INITIAL_LOGS: CallLog[] = [
  {
    id: '1',
    name: 'የኢትዮጵያ ንግድ ባንክ',
    number: '951',
    type: 'outgoing',
    time: 'ትናንት፣ 4:20 PM',
    duration: '02:45',
  },
  {
    id: '2',
    name: 'አቤል (Abel CBE)',
    number: '+251 911 234 567',
    type: 'incoming',
    time: 'ትናንት፣ 11:15 AM',
    duration: '01:10',
  },
  {
    id: '3',
    name: 'የኢትዮጵያ ንግድ ባንክ',
    number: '951',
    type: 'outgoing',
    time: 'መስከረም 28',
    duration: '03:12',
  },
  {
    id: '4',
    name: 'ኢትዮ ቴሌኮም (Ethio telecom)',
    number: '994',
    type: 'outgoing',
    time: 'መስከረም 25',
    duration: '01:30',
  },
];

const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'የኢትዮጵያ ንግድ ባንክ (CBE)',
    number: '951',
    label: 'የደንበኞች አገልግሎት',
    isCbe: true,
  },
  {
    id: 'c2',
    name: 'ሲቢኢ ብር ድጋፍ (CBE Birr Support)',
    number: '951',
    label: 'የሞባይል ባንኪንግ',
    isCbe: true,
  },
  {
    id: 'c3',
    name: 'ኢትዮ ቴሌኮም (Ethio telecom)',
    number: '994',
    label: 'የጥሪ ማዕከል',
  },
  {
    id: 'c4',
    name: 'ፖሊስ (Police Emergency)',
    number: '991',
    label: 'አደጋ ጊዜ',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('speed_dial');
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const [dialNumber, setDialNumber] = useState<string>('951');

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCallNumber, setCurrentCallNumber] = useState<string>('');
  const [ivrStep, setIvrStep] = useState<IvrStep>('not_started');
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [callStatusText, setCallStatusText] = useState<string>('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);

  // Call history & contacts
  const [callLogs, setCallLogs] = useState<CallLog[]>(INITIAL_LOGS);
  const [contacts] = useState<Contact[]>(INITIAL_CONTACTS);

  // Phone manager ref
  const managerRef = useRef<CbePhoneManager | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize Phone Manager
  useEffect(() => {
    const mgr = new CbePhoneManager({
      onStatusChange: (status) => setCallStatusText(status),
      onAgentSpeakingChange: (speaking) => setIsAgentSpeaking(speaking),
      onUserSpeakingChange: (speaking) => setIsUserSpeaking(speaking),
      onError: (err) => setCallStatusText(err),
    });
    managerRef.current = mgr;

    return () => {
      mgr.endCall();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer tick during connected call
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDurationSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Initiate call to given number
  const handleStartCall = async (num: string) => {
    const targetNum = num.trim() || '951';
    setCurrentCallNumber(targetNum);
    setCallState('ringing');
    setIvrStep('not_started');
    setCallStatusText('በመደወል ላይ...');

    phoneAudio.startRingback();

    // After 2.5 seconds of ringing, simulate pickup
    setTimeout(async () => {
      phoneAudio.stopRingback();
      phoneAudio.playCallConnected();
      setCallState('connected');
      managerRef.current?.startCall();

      if (targetNum === '951') {
        // Commercial Bank of Ethiopia IVR Flow
        setIvrStep('welcome_menu');
        setCallStatusText('የኢትዮጵያ ንግድ ባንክ የጥሪ ማዕከል');

        // Play initial IVR welcome prompt
        if (managerRef.current) {
          await managerRef.current.speakAgent(managerRef.current.welcomePrompt);
        }
      } else {
        setCallStatusText('ጥሪ ተገናኝቷል');
      }
    }, 2400);
  };

  // User taps DTMF Key on keypad (e.g. 4 for Amharic)
  const handleDtmfInput = async (digit: string) => {
    if (ivrStep === 'welcome_menu' && digit === '4') {
      setIvrStep('agent_intro');
      setCallStatusText('ወደ አማርኛ አገልግሎት እየተገናኘ ነው...');
      phoneAudio.stopCurrentAudio();

      setTimeout(async () => {
        if (managerRef.current) {
          // Play the representative's greeting: "የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ምን ልርዳዎ?"
          await managerRef.current.speakAgent(managerRef.current.agentGreeting);

          // Once greeting completes, transition to active hands-free turn
          setIvrStep('active_call');
          setCallStatusText('እባክዎትን ይናገሩ... (ማይክ ክፍት ነው)');

          // Start listening to the caller in Amharic
          managerRef.current.startListening((userSpeech) => {
            handleUserTurn(userSpeech);
          });
        }
      }, 500);
    }
  };

  // Handle a user speech turn in Amharic
  const handleUserTurn = async (userText: string) => {
    if (!managerRef.current || callState !== 'connected') return;

    await managerRef.current.processUserMessage(userText, (nextUserSpeech) => {
      handleUserTurn(nextUserSpeech);
    });
  };

  // Hang up the call
  const handleEndCall = () => {
    if (managerRef.current) {
      managerRef.current.endCall();
    }
    phoneAudio.stopRingback();
    phoneAudio.stopCurrentAudio();
    phoneAudio.playCallEnded();

    // Log the call into Recents
    if (currentCallNumber) {
      const isCbe = currentCallNumber === '951';
      const newLog: CallLog = {
        id: Date.now().toString(),
        name: isCbe ? 'የኢትዮጵያ ንግድ ባንክ' : currentCallNumber,
        number: currentCallNumber,
        type: 'outgoing',
        time: 'አሁን',
        duration: `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`,
      };
      setCallLogs((prev) => [newLog, ...prev]);
    }

    setCallState('ended');
    setIvrStep('not_started');
    setCallStatusText('ጥሪው ተቋርጧል');

    setTimeout(() => {
      setCallState('idle');
      setCallStatusText('');
    }, 1200);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center p-0 sm:p-4 text-slate-100 font-sans">
      {/* Phone Shell / Viewport */}
      <div className="relative w-full max-w-md h-screen sm:h-[840px] bg-slate-900 sm:rounded-[36px] overflow-hidden shadow-2xl flex flex-col border border-slate-800">
        {/* Active Call Overlay Screen */}
        {callState !== 'idle' ? (
          <ActiveCallScreen
            number={currentCallNumber}
            callState={callState}
            ivrStep={ivrStep}
            durationSeconds={durationSeconds}
            isAgentSpeaking={isAgentSpeaking}
            isUserSpeaking={isUserSpeaking}
            callStatusText={callStatusText}
            onEndCall={handleEndCall}
            onDtmfKey={handleDtmfInput}
          />
        ) : (
          /* Google Phone Main App Screen */
          <div className="flex-1 flex flex-col justify-between h-full bg-[#121316]">
            {/* Top Search Bar (Google Pixel Phone Style) */}
            <div className="pt-3 px-4 pb-2">
              <div className="w-full h-12 bg-slate-800/80 hover:bg-slate-800 rounded-full px-4 flex items-center justify-between text-slate-300 border border-slate-700/40 shadow-sm transition-colors">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-normal text-slate-400">እውቂያዎችን ይፈልጉ...</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDialNumber('951');
                      setShowKeypad(true);
                    }}
                    className="flex items-center gap-1 bg-amber-500/15 text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/30"
                    title="ወደ 951 ይደውሉ"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>951 CBE</span>
                  </button>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Main Content Area based on Selected Tab */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'recents' ? (
                <RecentsList logs={callLogs} onCall={handleStartCall} />
              ) : activeTab === 'contacts' ? (
                <ContactsList contacts={contacts} onCall={handleStartCall} />
              ) : (
                /* Speed Dial / Keypad View */
                <div className="w-full h-full flex flex-col">
                  {showKeypad ? (
                    <Keypad
                      number={dialNumber}
                      onNumberChange={setDialNumber}
                      onCall={handleStartCall}
                    />
                  ) : (
                    /* Speed Dial Favorites */
                    <div className="p-4 flex flex-col gap-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">
                        ተመራጭ ቁጥሮች (Favorites)
                      </div>
                      <div
                        onClick={() => handleStartCall('951')}
                        className="bg-gradient-to-r from-purple-950/60 to-amber-950/40 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400/60 transition-all shadow-md group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center font-black text-slate-950 text-base shadow-sm">
                            CBE
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-amber-300">
                              የኢትዮጵያ ንግድ ባንክ
                            </span>
                            <span className="text-xs text-slate-400">
                              951 • የደንበኞች አገልግሎት ማዕከል
                            </span>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <Phone className="w-5 h-5 fill-current" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Floating Keypad Toggle or Close Keypad button */}
            <div className="px-6 py-1 flex items-center justify-center">
              {showKeypad && activeTab === 'speed_dial' && (
                <button
                  onClick={() => setShowKeypad(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 py-1 px-3 rounded-full flex items-center gap-1 bg-slate-800/40"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>የቁልፍ ሰሌዳ ደብቅ</span>
                </button>
              )}
            </div>

            {/* Bottom Navigation Bar (Google Phone Style: Favorites, Recents, Contacts) */}
            <div className="h-16 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/80 px-6 flex items-center justify-around">
              {/* Speed Dial / Favorites Tab */}
              <button
                onClick={() => {
                  setActiveTab('speed_dial');
                  setShowKeypad(true);
                }}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeTab === 'speed_dial'
                    ? 'text-amber-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`px-4 py-0.5 rounded-full ${
                    activeTab === 'speed_dial' ? 'bg-amber-400/20' : ''
                  }`}
                >
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-[11px]">መደወያ</span>
              </button>

              {/* Recents Tab */}
              <button
                onClick={() => {
                  setActiveTab('recents');
                  setShowKeypad(false);
                }}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeTab === 'recents'
                    ? 'text-amber-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`px-4 py-0.5 rounded-full ${
                    activeTab === 'recents' ? 'bg-amber-400/20' : ''
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[11px]">የቅርብ ጊዜ</span>
              </button>

              {/* Contacts Tab */}
              <button
                onClick={() => {
                  setActiveTab('contacts');
                  setShowKeypad(false);
                }}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeTab === 'contacts'
                    ? 'text-amber-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`px-4 py-0.5 rounded-full ${
                    activeTab === 'contacts' ? 'bg-amber-400/20' : ''
                  }`}
                >
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px]">ዕውቂያዎች</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
