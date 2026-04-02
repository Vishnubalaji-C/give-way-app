import { useWs } from '../context/WsContext';
import { User, Activity, Navigation, Zap, Cpu, BellRing, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const { state, alerts } = useWs();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const totalWait = Object.values(state?.lanes || {}).reduce((acc, curr) => acc + (curr.waitTime || 0), 0);
  const avgWait = Object.keys(state?.lanes || {}).length > 0 ? (totalWait / 4).toFixed(1) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 pb-32">
      {/* ── Personalized Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-cyan-900/30 to-purple-900/10 border border-cyan-500/20 shadow-[0_8px_32px_rgba(0,229,255,0.05)]">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm tracking-wide mb-2 uppercase">
            <User size={16} /> {state?.junction?.zone || 'GiveWay Network'}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-[var(--text-main)] tracking-tight">
            {greeting}, Officer <span className="text-[var(--cyan)]">942</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-2 text-sm sm:text-base max-w-xl">
            Monitoring <span className="text-cyan-400 font-semibold">{state?.junction?.name || 'junction'}</span> — {state?.junction?.address || 'AI processing is prioritizing emergency and high-throughput lanes.'}
          </p>
          {/* Junction Location Badge */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40 text-slate-400">
              📍 {state?.junction?.city || '---'}, {state?.junction?.state || '---'}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/40 text-slate-400">
              🏷️ {state?.junction?.id || '---'} — {state?.junction?.poleId || '---'}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20 text-cyan-400">
              🛰️ {state?.junction?.lat?.toFixed(4) || '---'}°N, {state?.junction?.lng?.toFixed(4) || '---'}°E
            </div>
          </div>
        </div>
        
        <div className="flex bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-4 gap-6 items-center flex-wrap shadow-sm">
           <div className="flex flex-col">
              <span className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Hardware & Diagnostics</span>
              <div className="flex items-center gap-4 mt-1">
                 <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_#ffb700]"></span>
                    SOLAR-ECO MODE
                 </div>
                 <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#00e5ff]"></span>
                    PEDESTRIAN RADAR
                 </div>
                 <div className="flex items-center gap-1.5 text-xs font-bold text-[#ff3b3b] bg-[#ff3b3b]/10 px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 bg-[#ff3b3b] rounded-full shadow-[0_0_8px_#ff3b3b]"></span>
                    GIVEWAY BUZZER ARM
                 </div>
                 <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#00ff88]"></span>
                    STALL-DETECT AI
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* ── Adaptive Widgets Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        
        <WidgetCard 
          icon={<Zap size={24} className="text-[#ff3b3b]" />} 
          title="Ambulances Cleared" 
          value={state?.totalAmbulances || 0} 
          sub="+0s Delay on Arrival"
          bg="bg-gradient-to-br from-[#ff3b3b]/10 to-transparent"
          border="border-[#ff3b3b]/20"
        />

        <WidgetCard 
          icon={<Navigation size={24} className="text-cyan-400" />} 
          title="Buses Serviced" 
          value={state?.totalBuses || 0} 
          sub="Mass Transit Prioritized"
          bg="bg-gradient-to-br from-cyan-500/10 to-transparent"
          border="border-cyan-500/20"
        />

        <WidgetCard 
          icon={<Cpu size={24} className="text-purple-400" />} 
          title="AI Decisions" 
          value={state?.tick || 0} 
          sub="Computed at Edge Level"
          bg="bg-gradient-to-br from-purple-500/10 to-transparent"
          border="border-purple-500/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Live Flow Overview ────────────────────────────── */}
        <div className="glass lg:col-span-2 p-6 sm:p-8">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-xl bg-[var(--cyan)]/20 flex items-center justify-center text-[var(--cyan)]">
                <Navigation size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-[var(--text-main)]">Live Traffic Densities</h2>
               <p className="text-xs text-[var(--text-muted)]">Current dynamic loads per approach lane</p>
             </div>
           </div>
           
           <div className="space-y-4">
             {Object.keys(state?.lanes || {}).map(id => {
               const lane = state.lanes[id];
               const maxDens = Math.max(...Object.values(state?.lanes || {}).map(l => l.density || 1), 10);
               const w = ((lane.density || 0) / maxDens) * 100;

               return (
                 <div key={id} className="bg-[var(--input-bg)] border border-[var(--input-border)] p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="w-16 font-mono font-bold text-[var(--text-main)]">LANE {id}</div>
                    <div className="flex-1 h-3 bg-[var(--border)] rounded-full overflow-hidden">
                       <div className="h-full rounded-full transition-all duration-700 ease-in-out" 
                            style={{ 
                              width: `${w}%`, 
                              background: lane.signal === 'green' ? 'linear-gradient(90deg, var(--green), var(--cyan))' : 'var(--text-muted)' 
                            }}></div>
                    </div>
                    <div className={`w-12 text-right font-black tabular-nums ${lane.signal === 'green' ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'}`}>
                       {lane.density || 0}
                    </div>
                 </div>
               );
             })}
           </div>
        </div>

        {/* ── Critical Alerts Feed ──────────────────────────── */}
        <div className="glass p-6 sm:p-8 flex flex-col">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-xl bg-[var(--red)]/20 flex items-center justify-center text-[var(--red)]">
                <BellRing size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-[var(--text-main)]">Recent Alerts</h2>
               <p className="text-xs text-[var(--text-muted)]">Emergency & system interrupts</p>
             </div>
           </div>

           <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 scrollbar-hide">
              {alerts?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600">
                   <Activity size={32} className="mb-2 opacity-50" />
                   <p className="text-sm font-medium">All systems nominal.</p>
                </div>
              ) : (
                alerts?.slice(0, 6).map(a => (
                  <div key={a.id} className={`p-4 rounded-2xl border text-sm ${a.type === 'emergency' ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(255,59,59,0.1)]' : 'bg-slate-800/50 border-slate-700/50'}`}>
                    <div className="text-[10px] text-slate-500 font-mono mb-1">{new Date(a.timestamp).toLocaleTimeString()}</div>
                    <div className={a.type === 'emergency' ? 'text-red-300 font-bold' : 'text-slate-300'}>{a.message}</div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function WidgetCard({ icon, title, value, sub, bg, border }) {
  return (
    <div className={`rounded-3xl p-6 border ${border} glass transition-transform hover:-translate-y-1`}>
      <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] flex items-center justify-center mb-6 shadow-md border border-[var(--border)]">
        {icon}
      </div>
      <div className="text-4xl font-black text-[var(--text-main)] tabular-nums tracking-tighter mb-1">
        {value}
      </div>
      <div className="text-sm font-bold text-[var(--text-muted)] mb-1">{title}</div>
      <div className="text-xs text-[var(--text-muted)] opacity-70">{sub}</div>
    </div>
  );
}
