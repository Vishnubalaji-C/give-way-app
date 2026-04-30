import { useWs } from '../context/WsContext';
import { User, Activity, Navigation, Zap, Cpu, BellRing, ShieldCheck, PlayCircle, StopCircle, RotateCcw, Timer, AlertCircle, ShieldAlert, LayoutGrid } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage({ user }) {
  const { state, alerts, send } = useWs();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else if (hour < 21) setGreeting('Good Evening');
    else setGreeting('Good Night');
  }, []);

  const totalWait = Object.values(state?.lanes || {}).reduce((acc, curr) => acc + (curr.waitTime || 0), 0);
  const avgWait = Object.keys(state?.lanes || {}).length > 0 ? (totalWait / 3).toFixed(1) : 0;

  const containerVars = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVars = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 500 } }
  };

  // System Modes (Hardware & Feature Replication)
  const OVERRIDE_MODES = [
    { id: 'auto',      label: '🤖 GiveWay AI',    desc: 'Autonomous adaptive control', icon: <Cpu size={14}/> },
    { id: 'vip',       label: '👑 VIP Corridor',    desc: 'Priority escort mode', icon: <ShieldCheck size={14}/> },
    { id: 'festival',  label: '🎉 Festival Mode',   desc: 'Balanced load sharing', icon: <Activity size={14}/> },
    { id: 'emergency', label: '🚨 All-Stop',         desc: 'Emergency halt all lanes', icon: <ShieldAlert size={14}/> },
  ];

  const activeMode = state?.overrideMode || 'auto';

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVars}
      className="space-y-6 sm:space-y-10 pb-32"
    >
      {/* ── Immersive Header ───────────────────────────────── */}
      <motion.div variants={itemVars} className="relative group">
        <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full -z-10 group-hover:bg-cyan-500/10 transition-colors" />
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 p-8 rounded-[2rem] bg-glass border border-white/5 shadow-2xl">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-cyan-400 font-black text-[10px] tracking-[0.3em] mb-3 uppercase">
              <ShieldCheck size={14} /> System Secure · GiveWay v5.5 (Hardware Mode)
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-none">
              {greeting}, <span className="brand-gradient">{user?.name || 'Operator'}</span>
            </h1>
            <p className="text-white/40 mt-4 text-sm sm:text-lg max-w-2xl font-medium leading-relaxed">
              Monitoring <span className="text-white font-bold">{state?.junction?.name || 'Central Hub'}</span>. Synchronized with <span className="text-cyan-400 font-bold">3-Lane Hardware Node</span>.
            </p>
            
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/50 uppercase">
                Hardware Link: {state?.hardwareOnline ? 'CONNECTED' : 'STANDBY'}
              </div>
              <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                COM5: Active
              </div>
            </div>
          </div>
          
          <div className="flex flex-col bg-black/40 border border-white/5 rounded-2xl p-6 gap-4 min-w-[280px] backdrop-blur-md">
              <span className="text-[10px] text-white/30 uppercase font-black tracking-widest">Global Operations</span>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => send(state?.simulationRunning ? 'STOP_SIM' : 'START_SIM')}
                  className={`px-4 py-3 rounded-xl font-bold text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg uppercase ${
                    state?.simulationRunning 
                      ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30' 
                      : 'bg-green-500 text-black border border-green-400 hover:bg-green-400'
                  }`}
                >
                  {state?.simulationRunning ? <StopCircle size={14}/> : <PlayCircle size={14}/>}
                  {state?.simulationRunning ? 'HALT DEMO' : 'RUN LIVE'}
                </button>
                <button 
                  onClick={() => { if (window.confirm('Reset state?')) send('RESET_SIM'); }}
                  className="flex items-center justify-center p-3 rounded-xl bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white transition-all shadow-xl"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
          </div>
        </div>
      </motion.div>
      
      {/* ── Core Metrics ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          icon={<Zap size={20} className="text-red-500" />} 
          title="Ambulances Cleared" 
          value={state?.totalAmbulances || 0} 
          trend="Direct Emergency Scans"
          delay={0.3}
        />
        <MetricCard 
          icon={<Navigation size={20} className="text-cyan-400" />} 
          title="Buses Serviced" 
          value={state?.totalBuses || 0} 
          trend="Mass Prioritation"
          delay={0.4}
        />
        <MetricCard 
          icon={<Timer size={20} className="text-amber-400" />} 
          title="Avg. Wait Time" 
          value={`${avgWait}s`} 
          trend="Fairness Equilibrator"
          delay={0.5}
        />
        <MetricCard 
          icon={<Activity size={20} className="text-white/20" />} 
          title="Nodes Linked" 
          value={Object.keys(state?.lanes || {}).length} 
          trend="Hardware Presence"
          delay={0.6}
        />
      </div>

      {/* ── System Modes (Feature Replication) ──────────────── */}
      <motion.div variants={itemVars} className="p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
         <div className="flex items-center gap-3 mb-6">
           <Zap size={16} className="text-indigo-400" />
           <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Hardware System Modes</h3>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {OVERRIDE_MODES.map(m => (
              <button 
                key={m.id}
                onClick={() => send('SET_OVERRIDE_MODE', { mode: m.id })}
                className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-2 ${
                  activeMode === m.id 
                    ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeMode === m.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/30'}`}>
                    {m.icon}
                  </div>
                  {activeMode === m.id && <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />}
                </div>
                <div>
                  <div className="text-[10px] font-black text-white uppercase tracking-wider">{m.label}</div>
                  <div className="text-[8px] text-white/30 font-bold uppercase">{m.desc}</div>
                </div>
              </button>
            ))}
         </div>
      </motion.div>

      {/* ── Physical Junction View (Perfect Replication) ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVars} className="lg:col-span-2 bg-glass-card p-8 min-h-[500px] flex flex-col">
           <div className="flex items-center justify-between mb-10">
             <div>
               <h2 className="text-xl font-black text-white uppercase tracking-tight">Physical Junction Map</h2>
               <p className="text-xs text-white/30 font-bold uppercase tracking-widest">3-Node ATES Real-Time Replication</p>
             </div>
             <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid size={12}/> T-JUNCTION SYNC
             </div>
           </div>

           <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/40 rounded-3xl border border-white/5">
              {/* The "Roads" */}
              <div className="absolute w-[120px] h-full bg-slate-900/50" /> {/* Vertical Road */}
              <div className="absolute w-full h-[120px] bg-slate-900/50" /> {/* Horizontal Road (Right side) */}
              
              {/* Lane 1: SOUTH (Coming Up) */}
              <JunctionLane 
                id="1" 
                lane={state?.lanes?.['1']} 
                className="bottom-4" 
                pos="south" 
              />

              {/* Lane 2: EAST (Coming from Right) */}
              <JunctionLane 
                id="2" 
                lane={state?.lanes?.['2']} 
                className="right-4" 
                pos="east" 
              />

              {/* Lane 3: WEST (Coming from Left) */}
              <JunctionLane 
                id="3" 
                lane={state?.lanes?.['3']} 
                className="left-4" 
                pos="west" 
              />

              {/* Center Matrix */}
              <div className="z-10 w-24 h-24 bg-black border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
                 <div className="text-[10px] font-black text-cyan-500/40 uppercase text-center leading-tight">
                    PCE<br/>MATRIX
                 </div>
              </div>
           </div>
        </motion.div>

        {/* ── Lane Details Sidebar ──────────────────────────── */}
        <motion.div variants={itemVars} className="space-y-4 overflow-y-auto no-scrollbar">
           {['1', '2', '3'].map(id => {
             const lane = state?.lanes?.[id] || {};
             const sig = lane.signal || 'red';
             return (
               <div key={id} className={`p-6 rounded-2xl border transition-all ${sig === 'green' ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${sig === 'green' ? 'bg-green-500 text-black' : 'bg-white/10 text-white/40'}`}>
                        {id}
                      </div>
                      <div>
                       <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">Hardware Node</div>
                        <div className="text-xs font-black text-white uppercase tracking-wider">Lane {id} (ESP32-CAM)</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => send('FORCE_GREEN', { laneId: id })}
                         className={`text-[8px] font-black px-2 py-1 rounded border transition-all ${sig === 'green' ? 'bg-green-500 text-black border-green-400' : 'bg-white/5 text-white/40 border-white/10 hover:border-green-500/50'}`}
                       >
                         FORCE GREEN
                       </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-black/20 rounded-xl">
                       <div className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Density</div>
                       <div className="text-xl font-black text-white">{lane.density || 0}</div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-xl">
                       <div className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">PCE Score</div>
                       <div className="text-xl font-black text-cyan-400">{Math.round(lane.pceScore || 0)}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-2">
                     <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (lane.density || 0) * 2)}%` }}
                          className={`h-full ${sig === 'green' ? 'bg-green-500' : 'bg-white/10'}`}
                        />
                     </div>
                     <span className="text-[10px] font-mono font-bold text-white/20 tracking-tighter">NODE_{id}_TX_READY</span>
                  </div>
               </div>
             );
           })}
        </motion.div>
      </div>

      {/* ── System Alerts ─────────────────────────────────── */}
      <div className="bg-glass-card p-8">
         <div className="flex items-center gap-3 mb-8">
            <BellRing size={16} className="text-red-400" />
            <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Operational Audit Log</h2>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts?.slice(0, 6).map(a => (
              <div key={a.id} className={`p-4 rounded-xl border ${a.type === 'emergency' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-white/20">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    {a.type === 'emergency' && <ShieldAlert size={12} className="text-red-400 animate-pulse" />}
                 </div>
                 <p className="text-xs font-medium text-white/60">{a.message}</p>
              </div>
            ))}
         </div>
      </div>
    </motion.div>
  );
}

function JunctionLane({ id, lane, className, pos }) {
  const sig = lane?.signal || 'red';
  const density = lane?.density || 0;
  
  const rotation = {
    south: 'rotate-0',
    east: 'rotate-[-90deg]',
    west: 'rotate-[90deg]'
  }[pos];

  return (
    <div className={`absolute flex flex-col items-center gap-3 ${className} ${rotation}`}>
       {/* Virtual Road Lines */}
       <div className="w-12 h-20 border-x border-white/5 border-dashed relative">
          {/* Animated Vehicle Dots */}
          {[...Array(Math.min(5, Math.ceil(density/10)))].map((_, i) => (
            <motion.div 
              key={i}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: sig === 'green' ? -20 : 20, opacity: 1 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              className="absolute left-1/2 -translate-x-1/2 w-2 h-3 bg-cyan-400/40 rounded-sm"
            />
          ))}
       </div>

       {/* Traffic Light UI (Hardware Match) */}
       <div className="p-1.5 bg-black rounded-lg border border-white/10 flex flex-col gap-1 shadow-2xl">
          <div className={`w-2.5 h-2.5 rounded-full ${sig === 'red' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-500/10'}`} />
          <div className={`w-2.5 h-2.5 rounded-full ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-yellow-500/10'}`} />
          <div className={`w-2.5 h-2.5 rounded-full ${sig === 'green' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-green-500/10'}`} />
       </div>
       
       <span className="text-[10px] font-black text-white uppercase opacity-40">LANE {id}</span>
    </div>
  );
}

function MetricCard({ icon, title, value, trend, delay }) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { delay, type: 'spring' } }
      }}
      className="bg-glass-card p-6 border border-white/5 group hover:border-white/10 transition-colors"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all text-white/50 group-hover:text-cyan-400">
          {icon}
        </div>
        <div className="text-[10px] font-black text-cyan-400/50 uppercase tracking-[0.2em]">{trend}</div>
      </div>
      <div className="text-4xl font-black text-white tabular-nums tracking-tighter mb-1">
        {value}
      </div>
      <div className="text-xs font-bold text-white/30 uppercase tracking-widest">{title}</div>
    </motion.div>
  );
}
