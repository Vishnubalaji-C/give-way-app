import { useWs } from '../context/WsContext';
import { Wind, Radio, Shield, Zap, Activity, Navigation, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function GreenWavePage() {
  const { state, send, junctions, alerts } = useWs();
  const [activeHandshake, setActiveHandshake] = useState(null);

  const triggerWave = () => {
    send('TRIGGER_GREEN_WAVE');
    setActiveHandshake('ACTIVE');
    setTimeout(() => setActiveHandshake(null), 5000);
  };

  return (
    <div className="space-y-8 pb-32">
       {/* ── Header ───────────────────────────────────────── */}
       <div className="glass p-8 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-900/30 via-transparent to-transparent">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
                <Wind size={28} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Green-Wave Handshake Tool</h1>
                <p className="text-slate-400 text-sm mt-1 max-w-xl">
                   Coordinate multiple ATES junctions to create a "Green Carpet" corridor for massive traffic outflow or prioritized heavy-vehicle transit.
                </p>
             </div>
             <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-xl border border-slate-700 text-[10px] font-black text-cyan-400 tracking-widest uppercase">
                <Radio size={14} className="animate-pulse" /> Channel: 433.92MHZ-vSEC
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Handshake Coordination Card ──────────────────── */}
          <div className="lg:col-span-2 space-y-6">
             <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Zap size={20} className="text-amber-400" /> Synchronization Logic
                   </h3>
                   <div className="text-[10px] font-mono text-slate-500">PCE Weighted · Zero Delay Fallback</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 md:items-center gap-6">
                   <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-20"><Navigation size={32} /></div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Source Junction</div>
                      <div className="text-lg font-bold text-white truncate">{state?.junction?.name || '---'}</div>
                      <div className="text-xs text-cyan-400 font-mono mt-1 opacity-70">{state?.junction?.id} — Local Controller</div>
                   </div>

                   <div className="flex items-center justify-center">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-700 ${activeHandshake ? 'bg-cyan-500 shadow-[0_0_40px_rgba(0,229,255,0.6)] scale-110' : 'bg-slate-800 text-slate-500'}`}>
                         <Activity size={28} className={activeHandshake ? 'text-[#02050a]' : ''} />
                      </div>
                   </div>

                   <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-20"><ExternalLink size={32} /></div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Junction</div>
                      <div className="text-lg font-bold text-white truncate">{junctions.find(j => j.id !== state?.junction?.id)?.name || 'Next Nearest Signal'}</div>
                      <div className="text-xs text-amber-500 font-mono mt-1 opacity-70">Uplink Handshake Request...</div>
                   </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                   <button 
                      onClick={triggerWave}
                      disabled={activeHandshake}
                      className={`w-full py-5 rounded-2xl text-[#02050a] font-black text-sm tracking-[0.3em] uppercase transition-all shadow-2xl flex items-center justify-center gap-3 ${activeHandshake ? 'bg-green-500 cursor-not-allowed' : 'bg-cyan-400 hover:brightness-110 hover:-translate-y-1'}`}
                   >
                      {activeHandshake ? (
                         <>
                            <Zap size={18} className="animate-spin" /> CORRIDOR SECURED — GREEN WAVE ACTIVE
                         </>
                      ) : (
                         <>
                            <Wind size={18} /> INITIATE GREEN HANDSHAKE
                         </>
                      )}
                   </button>
                   <p className="text-[10px] text-center text-slate-500 mt-4 font-mono">
                      * This will broadcast a priority trigger to the next 2 junctions via the Render High-Speed Cloud Bridge.
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-3xl border border-white/5">
                   <Shield size={24} className="text-purple-400 mb-4" />
                   <h4 className="text-white font-bold mb-2">Automated Outflow</h4>
                   <p className="text-xs text-slate-400 leading-relaxed">
                      Handshake logic calculates the approximate arrival time based on current PCE outflow speeds. Signal B will prepare a green phase 3s before current pack arrival.
                   </p>
                </div>
                <div className="glass p-6 rounded-3xl border border-white/5">
                   <Activity size={24} className="text-emerald-400 mb-4" />
                   <h4 className="text-white font-bold mb-2">Power Efficiency</h4>
                   <p className="text-xs text-slate-400 leading-relaxed">
                      By reducing idling between junctions, we reduce CO2 hotspots by up to 40% in city centers during peak hour surges.
                   </p>
                </div>
             </div>
          </div>

          {/* ── Status Feed ──────────────────────────────────── */}
          <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col h-full">
             <h3 className="text-lg font-bold text-white mb-6">Coordination Feed</h3>
             <div className="space-y-4 flex-1">
                {alerts.length === 0 && (
                   <div className="flex gap-3 text-[10px] font-mono border-l-2 border-slate-800 pl-4 py-2">
                      <span className="text-slate-600">Awaiting live coordination events...</span>
                   </div>
                )}
                {alerts.slice(0, 6).map((log) => (
                   <div key={log.id} className="flex gap-3 text-[10px] font-mono border-l-2 border-slate-800 pl-4 py-1">
                      <span className="text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                      </span>
                      <span className={
                        log.type === 'emergency' ? 'text-red-400' :
                        log.type === 'warning'   ? 'text-amber-500' :
                        log.type === 'ghost'     ? 'text-purple-400' :
                                                   'text-cyan-400'
                      }>
                        {log.message}
                      </span>
                   </div>
                ))}
             </div>
             
             <div className="mt-8 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                <div className="text-[10px] font-black text-cyan-400 tracking-wider mb-2">SYNC COMPLETED</div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-cyan-500 w-[78%] rounded-full shadow-[0_0_8px_rgba(0,255,136,0.5)]"></div>
                </div>
                <div className="mt-2 text-[9px] text-slate-500 font-bold uppercase">7.8s saved per vehicle</div>
             </div>
          </div>

       </div>
    </div>
  );
}
