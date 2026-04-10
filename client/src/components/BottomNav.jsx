import { useWs } from '../context/WsContext';
import { Home, Radio, Camera, BarChart2, Settings } from 'lucide-react';

const TABS = [
  { id: 'dashboard',  icon: Home,      label: 'Home' },
  { id: 'simulation', icon: Radio,     label: 'Live Sim' },
  { id: 'camera',     icon: Camera,    label: 'Cameras' },
  { id: 'analytics',  icon: BarChart2, label: 'Analytics' },
  { id: 'settings',   icon: Settings,  label: 'Settings' },
];

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="mobile-bottom-nav flex justify-around items-center px-1 py-1 pb-safe bg-[#02050a]/95 backdrop-blur-xl border-t border-cyan-500/10">
      {TABS.map(t => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all flex-1 ${
              active ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className={`relative flex items-center justify-center transition-transform duration-300 ${
              active ? 'scale-110' : ''
            }`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              {active && (
                 <span className="absolute -inset-2 bg-cyan-400/20 rounded-full blur-md -z-10"></span>
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-wide transition-all ${
              active ? 'opacity-100 font-bold' : 'opacity-70'
            }`}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
