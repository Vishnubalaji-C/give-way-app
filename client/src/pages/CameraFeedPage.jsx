import { useWs } from '../context/WsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Cpu, Camera, Globe, Monitor, Settings, RefreshCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Optimized PCE Logic for Demo Mode
const PCE_WEIGHTS = { ambulance: 500, bus: 15, car: 1 };

export default function CameraFeedPage() {
  const { state, send } = useWs();
  const lanes = state?.lanes || {};
  const [visionMode, setVisionMode] = useState('none'); // 'none', 'hardware', 'demo'
  const [espIp, setEspIp] = useState('192.168.1.10');
  const [camActive, setCamActive] = useState(false);
  const videoRef = useRef(null);

  // Stop camera when switching modes
  useEffect(() => {
    return () => stopDemoCam();
  }, []);

  const startDemoCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamActive(true);
    } catch (e) { alert('Camera access denied'); }
  };

  const stopDemoCam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-32">
      {/* --- Tactical Header --- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Signal Intelligence Monitor</h1>
          <p className="text-white/40 mt-1 text-sm font-bold uppercase tracking-widest">
            <span className="text-cyan-400">Junction Proof-of-Concept</span> · Hardware & AI Validation
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setVisionMode('hardware'); stopDemoCam(); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${visionMode === 'hardware' ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
            <Globe size={12} className="inline mr-2"/> Plan A: ESP32-CAM
          </button>
          <button onClick={() => { setVisionMode('demo'); startDemoCam(); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${visionMode === 'demo' ? 'bg-purple-500 text-white border-purple-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
            <Monitor size={12} className="inline mr-2"/> Plan B: Laptop AI
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_400px] gap-8">
        
        {/* --- Vision Panel --- */}
        <div className="glass-card bg-black/60 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
             <div className="flex items-center gap-3">
                <Camera size={18} className="text-cyan-400" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Live Visual Evidence</span>
             </div>
             {visionMode === 'hardware' && (
               <div className="flex items-center gap-2">
                  <input 
                    type="text" value={espIp} onChange={e => setEspIp(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-400 w-32 focus:outline-none focus:border-cyan-500"
                  />
                  <button className="p-1 hover:bg-white/5 rounded text-white/40"><RefreshCw size={12}/></button>
               </div>
             )}
          </div>

          <div className="aspect-video bg-[#050505] relative flex items-center justify-center">
             <AnimatePresence mode="wait">
                {visionMode === 'none' && (
                  <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-4">
                     <Monitor size={48} strokeWidth={1} className="text-white/10 mx-auto" />
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Select Vision Mode to Start Demo</p>
                  </motion.div>
                )}

                {visionMode === 'hardware' && (
                  <motion.div key="hardware" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
                     <img 
                        src={`http://${espIp}/stream`} 
                        alt="ESP32-CAM Stream"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = 'https://placehold.co/640x360/000000/00E5FF?text=ESP32-CAM+OFFLINE'; }}
                     />
                     <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/80 backdrop-blur-xl rounded-lg border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                        PLAN A · EXTERNAL HARDWARE EYE
                     </div>
                  </motion.div>
                )}

                {visionMode === 'demo' && (
                  <motion.div key="demo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full relative">
                     <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale opacity-50" />
                     <div className="absolute inset-0 border-2 border-purple-500/20 pointer-events-none" />
                     <div className="absolute top-4 left-4 px-3 py-1.5 bg-purple-500/20 backdrop-blur-xl rounded-lg border border-purple-500/30 text-[9px] font-black text-purple-400 uppercase tracking-widest">
                        PLAN B · INTERNAL REFERENCE AI
                     </div>
                     <div className="absolute bottom-4 right-4 text-center">
                        <div className="text-[8px] font-black text-purple-400/60 uppercase tracking-widest mb-1">Inference Engine</div>
                        <div className="flex gap-1">
                           {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 bg-purple-500/40 rounded-full animate-pulse" style={{ animationDelay: `${i*0.1}s` }} />)}
                        </div>
                     </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        </div>

        {/* --- Signal Replication Panel --- */}
        <div className="space-y-6">
           {['1', '2', '3'].map(id => (
             <div key={id} className="glass-card bg-black/40 border border-white/5 rounded-3xl p-6 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                   <div className="bg-[#111] p-2 rounded-2xl border border-white/5 flex flex-col gap-2">
                      <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'red' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-950/20'}`} />
                      <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'yellow' ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-yellow-950/20'}`} />
                      <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'green' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-green-950/20'}`} />
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Lane {id} Signal</h4>
                      <div className={`text-xl font-black uppercase ${lanes[id]?.signal === 'green' ? 'text-green-500' : 'text-white'}`}>
                         {lanes[id]?.signal || 'RED'}
                      </div>
                   </div>
                </div>

                <div className="text-right">
                   <div className="text-[8px] font-black text-cyan-500/40 uppercase tracking-widest mb-1">Density (PCE)</div>
                   <div className="text-2xl font-black text-white tabular-nums">
                      {Math.round(lanes[id]?.pceScore || 0)}
                   </div>
                </div>
             </div>
           ))}

           {/* Hardware Status */}
           <div className="p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-cyan-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Controller Hub</span>
                 </div>
                 <div className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[8px] font-black uppercase">Online</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <div className="text-[8px] text-white/30 font-bold uppercase">Mega Rx</div>
                    <div className="text-xs font-mono text-cyan-400">115.2k bps</div>
                 </div>
                 <div className="space-y-1">
                    <div className="text-[8px] text-white/30 font-bold uppercase">WebSocket</div>
                    <div className="text-xs font-mono text-cyan-400">Encrypted</div>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </motion.div>
  );
}
