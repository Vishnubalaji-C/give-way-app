import { useWs } from '../context/WsContext';
import { Camera, Server, Cpu, Radio, ShieldCheck, Activity, Maximize2, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LANES = ['1', '2', '3'];
const LANE_ROLES = { '1': 'SOUTH APPROACH', '2': 'EAST APPROACH', '3': 'WEST APPROACH' };
const BBOX_COLORS = { ambulance: '#ef4444', bus: '#06b6d4', car: '#10b981', bike: '#8b5cf6' };

const containerVars = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVars = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 400 } }
};

// Simulate random bounding boxes based on state vehicle counts
function generateFakeBboxes(vehicles) {
  const bboxes = [];
  const types = Object.keys(vehicles);
  types.forEach(type => {
    for (let i = 0; i < vehicles[type]; i++) {
      bboxes.push({
        type,
        x: 10 + Math.random() * 70,
        y: 20 + Math.random() * 60,
        w: type === 'bus' || type === 'ambulance' ? 18 : type === 'car' ? 12 : 6,
        h: type === 'bus' || type === 'ambulance' ? 25 : type === 'car' ? 16 : 8,
        conf: (0.8 + Math.random() * 0.18).toFixed(2),
        id: Math.random().toString(36).substr(2, 5),
      });
    }
  });
  return bboxes;
}

export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVars}
      className="space-y-10 pb-32"
    >
      
      {/* ── Page Header ───────────────────────────────────── */}
      <motion.div variants={itemVars} className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Lens-Stream Matrix</h1>
          <p className="text-white/40 text-lg font-medium mt-1">Real-time neural feedback from Edge-AI nodes</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Badge icon={<Cpu size={14}/>} label={`ACTIVE NODES: ${state?.junction?.cameraNodes || 3}/3`} color="amber" />
          <Badge icon={<Server size={14}/>} label={state?.junction?.id || 'MASTER-CONTROL'} color="cyan" />
          <Badge icon={<Radio size={14} className="animate-pulse"/>} label="WEBSOCKET STREAM ACTIVE" color="green" />
        </div>
      </motion.div>

      <motion.p variants={itemVars} className="text-white/40 text-sm max-w-3xl leading-relaxed font-medium">
        Hardware-level telemetry is streamed via secure UDP buffers from <span className="text-white font-bold">{state?.junction?.name || 'Central Matrix'}</span>. 
        Each node processes frames locally using <span className="text-cyan-400 font-black">LiteWeight-YOLO v8</span> to minimize latency and bandwidth overhead.
      </motion.p>

      {/* ── Grid Interface ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {LANES.map(id => {
          const l = lanes[id] || {};
          const bboxes = generateFakeBboxes(l.vehicles || {});
          const isGreen = l.signal === 'green';
          
          return (
            <motion.div 
              key={id} 
              variants={itemVars}
              className="bg-glass-card overflow-hidden group relative"
            >
              {/* Header Alpha Overlay */}
              <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-0.5 rounded font-black text-[10px] tracking-widest ${isGreen ? 'bg-cyan-500 text-black' : 'bg-white/10 text-white/40'}`}>
                    LANE {id}
                  </div>
                  <span className="font-black text-white text-xs uppercase tracking-widest">{LANE_ROLES[id]}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-white/20 font-mono tracking-tighter">{time} · 30 FPS</span>
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[9px] font-black ${isGreen ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isGreen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} /> {isGreen ? 'LIVE' : 'STANDBY'}
                  </div>
                </div>
              </div>

              {/* Matrix Feed Simulation */}
              <div className="relative w-full aspect-video bg-black overflow-hidden cursor-crosshair">
                <div className="absolute inset-0 opacity-10 mix-blend-screen pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
                <div className="absolute inset-0 pointer-events-none z-10 opacity-20 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)]"></div>
                
                {/* AUTOMATIC LOCATION TELEMETRY OVERLAY */}
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
                   <div className="px-3 py-1.5 bg-black/80 backdrop-blur-xl rounded border border-white/10 flex flex-col gap-0.5">
                      <div className="text-[8px] font-black text-cyan-400 tracking-[0.2em] uppercase">Tactical Uplink</div>
                      <div className="text-[10px] font-black text-white uppercase truncate max-w-[140px]">{state?.junction?.name}</div>
                      <div className="text-[7px] font-bold text-white/40 truncate max-w-[140px]">{state?.junction?.address}</div>
                      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/5">
                         <div className="text-[7px] font-mono text-cyan-400/80 tracking-tighter">LAT: {state?.junction?.lat}°N</div>
                         <div className="text-[7px] font-mono text-cyan-400/80 tracking-tighter">LNG: {state?.junction?.lng}°E</div>
                      </div>
                   </div>
                </div>

                {/* Neural Targets (Bounding Boxes) */}
                <AnimatePresence>
                  {bboxes.map((box) => (
                    <motion.div 
                      key={box.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute border-2 flex flex-col justify-end transition-all duration-300 group-hover:bg-white/5"
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.w}%`,
                        height: `${box.h}%`,
                        borderColor: BBOX_COLORS[box.type],
                        boxShadow: `0 0 15px ${BBOX_COLORS[box.type]}44 inset`
                      }}>
                      <div className="absolute bottom-full left-[-2px] px-1.5 py-0.5 bg-black/80 backdrop-blur-md text-[7px] font-black text-white whitespace-nowrap uppercase tracking-widest border border-white/10"
                        style={{ borderBottomColor: BBOX_COLORS[box.type] }}>
                        {box.type} · {box.conf}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* System Diagnostics Overlay */}
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                   <button className="p-2 bg-black/60 backdrop-blur-md rounded border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-white/40 hover:text-cyan-400">
                     <Maximize2 size={14} />
                   </button>
                </div>
              </div>

              {/* Data Interface Bar */}
              <div className="bg-white/[0.02] p-6 grid grid-cols-3 gap-6">
                 <DataStat label="Neural Targets" value={bboxes.length} sub="Active Classification" />
                 <DataStat label="PCE Density" value={Math.round(l.pceScore || 0)} sub="Weighted Load" color="text-cyan-400" />
                 <DataStat label="Buffer Latency" value="12ms" sub="Node Response" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Badge({ icon, label, color }) {
  const colors = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400'
  };
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-black text-[10px] tracking-widest uppercase ${colors[color]}`}>
      {icon} {label}
    </div>
  );
}

function DataStat({ label, value, sub, color = "text-white" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black tabular-nums transition-colors ${color}`}>{value}</span>
      </div>
      <span className="text-[9px] text-white/10 font-bold uppercase">{sub}</span>
    </div>
  );
}
