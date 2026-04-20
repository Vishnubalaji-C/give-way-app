import { useWs } from '../context/WsContext';
import { User, Activity, Navigation, Zap, Cpu, BellRing, ShieldCheck, PlayCircle, StopCircle, RotateCcw } from 'lucide-react';
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
              <ShieldCheck size={14} /> System Secure · GiveWay v4.2
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-none">
              {greeting}, <span className="brand-gradient">Officer</span>
            </h1>
            <p className="text-white/40 mt-4 text-sm sm:text-lg max-w-2xl font-medium leading-relaxed">
              Monitoring <span className="text-white font-bold">{state?.junction?.name || 'Central Hub'}</span>. Edge-AI is currently optimizing flow for <span className="text-green-400 font-bold">Priority PCE</span> throughput.
            </p>
            
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/50">
                L-IP: {window.location.hostname}
              </div>
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/50">
                {user?.role?.toUpperCase() || 'GUEST'}
              </div>
              <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                Serial: Online
              </div>
            </div>
          </div>
          
          <div className="flex bg-black/40 border border-white/5 rounded-2xl p-6 gap-6 items-center flex-wrap backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-3">System Control</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => send(state?.simulationRunning ? 'STOP_SIM' : 'START_SIM')}
                  className={`px-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 active:scale-95 shadow-lg ${
                    state?.simulationRunning 
                      ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30' 
                      : 'bg-green-500 text-black border border-green-400 hover:bg-green-400'
                  }`}
                >
                  {state?.simulationRunning ? <StopCircle size={16}/> : <PlayCircle size={16}/>}
                  {state?.simulationRunning ? 'HALT SYSTEM' : 'BOOT SYSTEM'}
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('Reset will wipe all simulation state. Are you sure?')) {
                      send('RESET_SIM');
                    }
                  }}
                  className="p-3 rounded-xl bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white transition-all shadow-xl"
                  title="Purge Global State"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Reviewer Tactical Hub (NEW) ────────────────────── */}
      <motion.div variants={itemVars} className="p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 shadow-inner">
         <div className="flex items-center gap-3 mb-6">
           <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
              <ShieldCheck size={16} />
           </div>
           <div>
             <h3 className="text-sm font-black text-white uppercase tracking-wider">Reviewer Tactical Hub</h3>
             <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Instant Override Control Center</p>
           </div>
           <div className="ml-auto text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
             SAFETY_INTERVAL: 2.0s ACTIVE
           </div>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
              onClick={() => send('SIMULATE_RFID', { laneId: '1', vehicleType: 'ambulance', tagId: 'AMB-EMG-101' })}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 transition-all group flex flex-col gap-2 items-start"
             >
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-red-400 transition-colors">Lane 1 (South)</span>
              <span className="text-xs font-bold text-white group-hover:text-white transition-colors">TRIGGER AMBULANCE</span>
            </button>
            <button 
              onClick={() => send('SIMULATE_RFID', { laneId: '2', vehicleType: 'bus', tagId: 'BUS-PT-402' })}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all group flex flex-col gap-2 items-start"
             >
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-cyan-400 transition-colors">Lane 2 (East)</span>
              <span className="text-xs font-bold text-white group-hover:text-white transition-colors">TRIGGER BUS PRIORITY</span>
            </button>
            <button 
              onClick={() => send('SIMULATE_TRAFFIC_BURST', { laneId: '3' })}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all group flex flex-col gap-2 items-start"
             >
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-amber-400 transition-colors">Lane 3 (ESP32)</span>
              <span className="text-xs font-bold text-white group-hover:text-white transition-colors">SIMULATE HIGH TRAFFIC</span>
            </button>
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
          icon={<Activity size={20} className="text-indigo-400" />} 
          title="Fuel Saved (Est)" 
          value={`${state?.fuelSaved || 0}L`} 
          trend="Efficiency Multiplier"
          delay={0.5}
        />
        <MetricCard 
          icon={<Activity size={20} className="text-amber-400" />} 
          title="Avg. Wait Time" 
          value={`${avgWait}s`} 
          trend="Fairness Equilibrator"
          delay={0.6}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Density Visualization ─────────────────────────── */}
        <motion.div variants={itemVars} className="bg-glass-card lg:col-span-2 p-8">
           <div className="flex items-center justify-between mb-8">
             <div>
               <h2 className="text-xl font-black text-white uppercase tracking-tight">Adaptive Traffic Load</h2>
               <p className="text-sm text-white/30 font-medium">Equitable Resource Allocation per Node</p>
             </div>
             <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">LIVE STREAMING</span>
             </div>
           </div>
           
           <div className="space-y-6">
             {Object.keys(state?.lanes || {}).map(id => {
               const lane = state.lanes[id];
               const maxDens = Math.max(...Object.values(state?.lanes || {}).map(l => l.density || 1), 10);
               const w = ((lane.density || 0) / maxDens) * 100;
               const isEmergency = lane.isEmergency;

               return (
                 <div key={id} className={`group relative p-5 rounded-2xl transition-all border ${lane.signal === 'green' ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-black/20 border-white/5'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${lane.signal === 'green' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/40'}`}>
                          {id}
                        </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-white/60 tracking-wider">LANE {id} NODE</span>
                           <div className="flex items-center gap-1.5">
                             {(id === '1' || id === '2') && <div className="text-[8px] font-black text-cyan-400/60 flex items-center gap-1 uppercase tracking-tighter"><ShieldCheck size={8}/> RFID Secure (EM-18)</div>}
                             {id === '3' && <div className="text-[8px] font-black text-amber-500/60 flex items-center gap-1 uppercase tracking-tighter"><Zap size={8}/> AI Optical (Pulsed)</div>}
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center gap-3">
                         {isEmergency && <span className="text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">EMERGENCY</span>}
                         <span className={`text-xl font-black tabular-nums ${lane.signal === 'green' ? 'text-cyan-400' : 'text-white/30'}`}>
                           {lane.density || 0}
                         </span>
                       </div>
                    </div>
                    
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${w}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${lane.signal === 'green' ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' : 'bg-white/10'}`}
                       />
                    </div>
                 </div>
               );
             })}
           </div>
        </motion.div>

        {/* ── System Alerts ─────────────────────────────────── */}
        <motion.div variants={itemVars} className="bg-glass-card p-8 flex flex-col">
           <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400">
                <BellRing size={20} />
             </div>
             <div>
               <h2 className="text-xl font-black text-white uppercase tracking-tight">System Events</h2>
               <p className="text-sm text-white/30 font-medium">Auto-generated audit logs</p>
             </div>
           </div>

           <div className="flex-1 space-y-4 overflow-y-auto max-h-[360px] pr-2 no-scrollbar">
              <AnimatePresence initial={false}>
                {alerts?.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/10">
                    <Activity size={40} className="mb-4 opacity-50" />
                    <p className="text-sm font-black uppercase tracking-widest">Scanning Network...</p>
                  </div>
                ) : (
                  alerts?.slice(0, 10).map(a => (
                    <motion.div 
                      key={a.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-4 rounded-xl border transition-all ${a.type === 'emergency' ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/5'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] text-white/20 font-mono tracking-tighter">
                          {new Date(a.timestamp).toLocaleTimeString([], { hour12: false })}
                        </span>
                        {a.type === 'emergency' && (
                          <span className="text-[8px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse-soft">CRITICAL</span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed font-medium ${a.type === 'emergency' ? 'text-red-100' : 'text-white/60'}`}>
                        {a.message}
                      </p>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
           </div>
        </motion.div>
      </div>
    </motion.div>
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
