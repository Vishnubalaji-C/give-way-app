import { useWs } from '../context/WsContext';
import { motion } from 'framer-motion';
import { Zap, Activity, ShieldAlert, LayoutGrid, Cpu, Radio, ShieldCheck } from 'lucide-react';

export default function CameraFeedPage() {
  const { state, send } = useWs();
  const lanes = state?.lanes || {};

  const containerVars = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVars = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      variants={containerVars}
      className="space-y-6 pb-32"
    >
      {/* --- Tactical Header --- */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">Tactical Control Room</h1>
          <p className="text-white/40 mt-1 text-sm font-bold uppercase tracking-widest">
            <span className="text-cyan-400">Hardware Mode</span> · Node Synchronization Active
          </p>
        </div>
        <div className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
           <Activity size={14} className="animate-pulse"/> 3-Node Matrix Online
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6">
        
        {/* --- 3-Lane T-Junction Map (Perfect Hardware Replication) --- */}
        <motion.div variants={itemVars} className="glass-card bg-black/40 border border-white/5 rounded-3xl p-8 min-h-[600px] flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
             <LayoutGrid size={400} strokeWidth={0.5} className="text-cyan-500" />
          </div>

          <div className="flex items-center justify-between mb-12 relative z-10">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                   <Cpu size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-black text-white uppercase">Physical Junction Map</h3>
                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Live ATES v5.5 Hardware State</p>
                </div>
             </div>
             <div className="flex gap-2">
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono text-white/40">RX_PACKET_STABLE</div>
             </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center">
              {/* Road Markings */}
              <div className="absolute w-[140px] h-full bg-white/[0.02] border-x border-white/5" /> 
              <div className="absolute w-full h-[140px] bg-white/[0.02] border-y border-white/5" />
              
              {/* Lane 1: South */}
              <JunctionNode id="1" lane={lanes['1']} pos="south" className="bottom-10" />
              
              {/* Lane 2: East */}
              <JunctionNode id="2" lane={lanes['2']} pos="east" className="right-10" />
              
              {/* Lane 3: West */}
              <JunctionNode id="3" lane={lanes['3']} pos="west" className="left-10" />

              {/* Center Controller */}
              <div className="z-20 w-32 h-32 bg-black border border-white/10 rounded-[2rem] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                 <div className="text-[8px] font-black text-cyan-500/40 uppercase tracking-[0.3em] mb-2">ATES Core</div>
                 <div className={`text-2xl font-black ${state?.isSwitching ? 'text-amber-400 animate-pulse' : 'text-green-500'}`}>
                    {state?.activeLane || '0'}
                 </div>
                 <div className="text-[8px] font-black text-white/20 uppercase mt-2">Active Node</div>
              </div>
          </div>
        </motion.div>

        {/* --- Sidebar: Node Control & Hardware Status --- */}
        <div className="space-y-6">
           
           {/* Global Overrides */}
           <motion.div variants={itemVars} className="glass-card p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                 <ShieldAlert size={16} className="text-red-400" />
                 <h3 className="text-xs font-black text-white uppercase tracking-widest">Tactical Overrides</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                 <button 
                   onClick={() => send('SET_OVERRIDE_MODE', { mode: 'emergency' })}
                   className="w-full py-4 rounded-xl bg-red-500 text-black font-black text-xs uppercase tracking-widest hover:bg-red-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                 >
                    🚨 All-Stop: Set All Red
                 </button>
                 <button 
                   onClick={() => send('SET_OVERRIDE_MODE', { mode: 'auto' })}
                   className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                 >
                    🤖 Resume AI Autonomy
                 </button>
              </div>
           </motion.div>

           {/* Hardware Node Status */}
           <div className="space-y-4">
              {['1', '2', '3'].map(id => (
                <motion.div 
                  key={id} 
                  variants={itemVars}
                  className={`p-5 rounded-2xl border transition-all ${lanes[id]?.signal === 'green' ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/5'}`}
                >
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${lanes[id]?.signal === 'green' ? 'bg-green-500 text-black' : 'bg-white/10 text-white/30'}`}>
                            {id}
                         </div>
                         <div className="text-[10px] font-black text-white uppercase">Node {id} Signal</div>
                      </div>
                      <div className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                         lanes[id]?.signal === 'green' ? 'text-green-400 border-green-500/30' : 'text-white/20 border-white/10'
                      }`}>
                         {lanes[id]?.signal?.toUpperCase() || 'RED'}
                      </div>
                   </div>

                   <div className="flex items-center gap-4">
                      <div className="flex-1">
                         <div className="text-[8px] text-white/30 font-black uppercase mb-1">Density (PCE)</div>
                         <div className="text-xl font-black text-white tabular-nums">{Math.round(lanes[id]?.pceScore || 0)}</div>
                      </div>
                      <button 
                        onClick={() => send('FORCE_GREEN', { laneId: id })}
                        className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[10px] font-black text-cyan-400 uppercase hover:bg-cyan-500/20 transition-all"
                      >
                         Force
                      </button>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>

      </div>
    </motion.div>
  );
}

function JunctionNode({ id, lane, pos, className }) {
  const sig = lane?.signal || 'red';
  const rotation = { south: 'rotate-0', east: 'rotate-[-90deg]', west: 'rotate-[90deg]' }[pos];

  return (
    <div className={`absolute flex flex-col items-center gap-4 ${className} ${rotation}`}>
       {/* Virtual Sensor Range */}
       <div className="w-16 h-32 border-x-2 border-white/5 border-dashed relative">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-50" />
       </div>

       {/* Traffic Light Hardware Replica */}
       <div className="p-2 bg-black border border-white/10 rounded-xl flex flex-col gap-1.5 shadow-2xl">
          <div className={`w-3.5 h-3.5 rounded-full ${sig === 'red' ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-red-900/20'}`} />
          <div className={`w-3.5 h-3.5 rounded-full ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_15px_#eab308]' : 'bg-yellow-900/20'}`} />
          <div className={`w-3.5 h-3.5 rounded-full ${sig === 'green' ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-green-900/20'}`} />
       </div>
       
       <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Node {id}</span>
          <div className="px-2 py-0.5 bg-white/5 rounded border border-white/10 text-[8px] font-mono text-cyan-400/60 uppercase">
             {pos === 'south' ? 'Primary' : 'Secondary'}
          </div>
       </div>
    </div>
  );
}
