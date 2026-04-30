import { useWs } from '../context/WsContext';
import { motion } from 'framer-motion';
import { Zap, Activity, ShieldAlert, LayoutGrid, Cpu, Radio, ShieldCheck } from 'lucide-react';

// This page is now a 1:1 Hardware Monitor
export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-32">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Tactical Signal Monitor</h1>
        <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black tracking-[0.3em] uppercase">
           <Zap size={14} className="animate-pulse" /> Live Hardware Node Sync · T-Junction v5.5
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {['1', '2', '3'].map(id => (
          <div key={id} className="glass-card bg-black/60 border border-white/5 rounded-[2.5rem] p-10 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            
            <div className="text-center">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Hardware Node</span>
              <h2 className="text-3xl font-black text-white mt-1">LANE {id}</h2>
            </div>

            {/* High-Fidelity Signal Replica */}
            <div className="bg-[#111] p-6 rounded-[3rem] border-4 border-white/5 flex flex-col gap-6 shadow-inner">
               <SignalLight color="red" active={lanes[id]?.signal === 'red'} />
               <SignalLight color="yellow" active={lanes[id]?.signal === 'yellow'} />
               <SignalLight color="green" active={lanes[id]?.signal === 'green'} />
            </div>

            <div className="w-full space-y-4">
               <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Active PCE</span>
                  <span className="text-2xl font-black text-cyan-400 tabular-nums">{Math.round(lanes[id]?.pceScore || 0)}</span>
               </div>
               <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Current Wait</span>
                  <span className="text-xl font-black text-white tabular-nums">{lanes[id]?.waitTime || 0}s</span>
               </div>
            </div>
            
            <div className="px-4 py-2 bg-white/5 rounded-full text-[8px] font-mono text-white/20 uppercase tracking-tighter">
               DATA_STREAM_OK · TX_PIN_{21 + (parseInt(id)*3)}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SignalLight({ color, active }) {
  const colors = {
    red:    active ? 'bg-red-500 shadow-[0_0_60px_rgba(239,68,68,0.8)]' : 'bg-red-950/20',
    yellow: active ? 'bg-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.8)]' : 'bg-yellow-950/20',
    green:  active ? 'bg-green-500 shadow-[0_0_60px_rgba(34,197,94,0.8)]' : 'bg-green-950/20'
  };
  return <div className={`w-20 h-20 rounded-full transition-all duration-300 border-4 border-black/40 ${colors[color]}`} />;
}

