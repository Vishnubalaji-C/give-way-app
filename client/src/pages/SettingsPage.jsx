import { useState } from 'react';
import { useWs } from '../context/WsContext';
import { Shield, Zap, Book, SlidersHorizontal, UserCheck } from 'lucide-react';

const LANES = ['1', '2', '3'];
const LANE_LABELS = { '1': 'Primary', '2': 'Secondary', '3': 'Transverse' };

export default function SettingsPage({ user, onUpdateUser }) {
  const { state, auditLog, send } = useWs();
  const [activeMode, setActiveMode] = useState('auto');

  const forceGreen = (id) => { send('FORCE_GREEN', { laneId: id }); };
  const forceRed   = (id) => { send('FORCE_RED',   { laneId: id }); };

  const switchMode = (mode) => {
    setActiveMode(mode);
    send('SET_OVERRIDE_MODE', { mode });
  };

  const lanes = state?.lanes ?? {};

  const OVERRIDE_MODES = [
    { id: 'auto',      label: '🤖 GiveWay AI',    desc: 'Full autonomous adaptive traffic control' },
    { id: 'vip',       label: '👑 VIP Corridor',    desc: 'Escort mode favoring pre-planned route' },
    { id: 'festival',  label: '🎉 Festival Mode',   desc: 'Load sharing for extremely dense crowds' },
    { id: 'emergency', label: '🚨 All-Stop',         desc: 'Lockdown mode: Red lights enforced on all lanes' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pb-32">
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-red-600/10 to-transparent border border-red-500/20 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">System Settings & Controls</h2>
            <p className="text-sm text-slate-400 mt-1">Manual overrides mapped. RBAC verification complete.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-bold font-mono shadow-inner shadow-green-500/10">
          <UserCheck size={16} /> BIOMETRIC AUTHORIZED: {user?.id || 'OFF-UNKNOWN'}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── Central Overrides & Modes ─────────────────────── */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass border border-cyan-500/10 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
               <Zap size={22} className="text-amber-400" />
               <h3 className="text-xl font-bold text-white">30s Manual Override</h3>
               <span className="text-[10px] ml-auto px-3 py-1 bg-red-500/20 text-red-300 font-mono font-bold rounded-lg border border-red-500/30 uppercase">
                 Overrules Antigravity AI
               </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LANES.map(id => {
                const l = lanes[id] ?? {};
                const sig = l.signal ?? 'red';
                const isActive = sig === 'green';
                
                return (
                  <div key={id} className={`p-5 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-cyan-900/10 border-cyan-500/30 shadow-[0_4px_24px_rgba(0,229,255,0.1)]' : 'bg-[#0b1019] border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className={`text-base font-bold ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>{LANE_LABELS[id]} Approach</span>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-mono font-black ${
                        isActive ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_12px_#00ff8844]' : 'bg-red-500/10 border border-red-500/20 text-red-500/70'
                      }`}>
                         {isActive ? '● GREEN' : 'RED'}
                      </span>
                    </div>
                    
                    <div className="flex gap-3">
                      <button onClick={() => forceGreen(id)}
                        className="flex-1 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold hover:bg-green-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#00ff88]"></span> Go
                      </button>
                      <button onClick={() => forceRed(id)}
                        className="flex-1 py-3 rounded-xl bg-red-500/5 text-red-500/70 border border-red-500/20 font-bold hover:bg-red-500/20 hover:-translate-y-1 transition-all">
                        Stop
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass border border-purple-500/10 rounded-3xl p-6 sm:p-8">
             <div className="flex items-center gap-3 mb-6">
                <SlidersHorizontal size={22} className="text-purple-400" />
                <h3 className="text-xl font-bold text-white">Global Operation Mode</h3>
             </div>
             <div className="grid gap-3">
               {OVERRIDE_MODES.map(m => {
                  const isSelected = activeMode === m.id;
                  return (
                    <button key={m.id} onClick={() => switchMode(m.id)}
                       className={`p-4 rounded-2xl flex items-center justify-between border transition-all text-left group ${
                         isSelected 
                          ? 'bg-purple-900/30 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' 
                          : 'bg-[#02050a]/40 border-slate-800 hover:border-slate-700'
                       }`}>
                       <div>
                          <div className={`font-black text-lg ${isSelected ? 'text-purple-300' : 'text-slate-300'}`}>{m.label}</div>
                          <div className={`text-xs mt-1 ${isSelected ? 'text-purple-300/70' : 'text-slate-500 max-w-xs'}`}>{m.desc}</div>
                       </div>
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'border-purple-400' : 'border-slate-700'
                       }`}>
                          {isSelected && <div className="w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_10px_#a855f7]"></div>}
                       </div>
                    </button>
                  );
               })}
             </div>
          </div>
        </div>

        {/* ── Audit Log ─────────────────────────────────────── */}
        <div className="lg:col-span-2 glass border border-amber-500/10 rounded-3xl p-6 flex flex-col items-stretch">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shadow-inner border border-amber-500/30">
                 <Book size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Action Ledger</h3>
            </div>
            <button className="text-[10px] text-amber-500/60 font-mono font-bold hover:text-amber-400" onClick={() => send('GET_AUDIT')}>
               ↻ PULL
            </button>
          </div>

          <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-y-auto max-h-[600px] space-y-3">
             {auditLog.length === 0 && (
               <div className="text-center text-xs text-slate-600 font-mono py-10 opacity-60">
                 [ No logged interruptions in current session ]
               </div>
             )}
             {auditLog.map(e => (
               <div key={e.id} className="text-xs p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-md">
                 <div className="flex justify-between items-start mb-2">
                   <span className="font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                     {e.action}
                   </span>
                   <span className="font-mono text-slate-500">
                     {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                   </span>
                 </div>
                 <div className="text-slate-300 leading-relaxed font-medium">{e.details}</div>
               </div>
             ))}
          </div>
        </div>

      </div>

    </div>
  );
}
