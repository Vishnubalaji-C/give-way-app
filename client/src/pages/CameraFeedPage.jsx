import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, Play, Square, Camera, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

// Pre-trained AI Logic
const COCO_MAP = { car: 'car', bus: 'bus', truck: 'truck', motorcycle: 'motorcycle' };

export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};
  const [modelLoaded, setModelLoaded] = useState(false);
  const modelRef = useRef(null);

  // Load the AI "Brain" once for the whole page
  useEffect(() => {
    const load = async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const coco = await import('@tensorflow-models/coco-ssd');
      modelRef.current = await coco.load();
      setModelLoaded(true);
    };
    load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-32">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Vision Signal Terminal</h1>
        <p className="text-[10px] font-black text-cyan-400 tracking-[0.4em] uppercase">Hardware Signal Replication · 3-Node Matrix</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['1', '2', '3'].map(id => (
          <LaneControlCard 
            key={id} 
            id={id} 
            lane={lanes[id]} 
            modelRef={modelRef} 
            modelLoaded={modelLoaded} 
          />
        ))}
      </div>
    </motion.div>
  );
}

function LaneControlCard({ id, lane, modelRef, modelLoaded }) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [source, setSource] = useState('demo'); // 'demo' or 'esp32'
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const startVision = async () => {
    if (source === 'demo') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsDetecting(true);
      } catch (e) { alert('Camera access denied'); }
    } else {
      setIsDetecting(true);
    }
  };

  const stopVision = () => {
    setIsDetecting(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  const runDetection = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !isDetecting) return;
    
    const preds = await modelRef.current.detect(videoRef.current);
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let counts = { car: 0, bus: 0, truck: 0, motorcycle: 0 };
    preds.forEach(p => {
      if (COCO_MAP[p.class]) {
        counts[COCO_MAP[p.class]]++;
        const [x, y, w, h] = p.bbox;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);
      }
    });

    if (preds.length > 0) {
      fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId: id,
          junctionId: 'JN-001',
          secret: 'GIVEWAY_NODE_KEY',
          vehicles: { car: counts.car, bus: counts.bus, lorry: counts.truck, bike: counts.motorcycle, ambulance: 0 }
        })
      }).catch(() => {});
    }
    rafRef.current = requestAnimationFrame(runDetection);
  }, [isDetecting, id, modelRef]);

  useEffect(() => {
    if (isDetecting) runDetection();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDetecting, runDetection]);

  const sig = lane?.signal || 'red';

  return (
    <div className="glass-card bg-black/60 border border-white/5 rounded-[2.5rem] p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
      <div className="flex justify-between items-center">
         <div>
            <span className="text-[9px] font-black text-cyan-400/40 uppercase tracking-widest">Approach Node</span>
            <h2 className="text-2xl font-black text-white">LANE {id}</h2>
         </div>
         <div className="flex gap-1">
            <button onClick={() => setSource('demo')} className={`p-1.5 rounded-lg border transition-all ${source === 'demo' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/20'}`}><Camera size={14}/></button>
            <button onClick={() => setSource('esp32')} className={`p-1.5 rounded-lg border transition-all ${source === 'esp32' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/20'}`}><Radio size={14}/></button>
         </div>
      </div>

      {/* Vision Window */}
      <div className="relative aspect-square bg-[#050505] rounded-3xl border border-white/5 overflow-hidden shadow-inner">
         {source === 'demo' ? (
            <>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-60" />
              <canvas ref={canvasRef} width={640} height={640} className="absolute inset-0 w-full h-full pointer-events-none" />
            </>
         ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
               <Radio size={32} className="text-white/10 mb-2" />
               <span className="text-[10px] font-black text-white/20 uppercase">ESP32-CAM Stream</span>
               <span className="text-[8px] text-cyan-500/40 font-mono mt-1">IP_ADDR_LINKED</span>
            </div>
         )}
         
         {!isDetecting && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
               <button 
                 onClick={startVision} 
                 disabled={!modelLoaded}
                 className="px-6 py-3 bg-cyan-500 text-black font-black text-[10px] rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
               >
                  Start Sense
               </button>
            </div>
         )}

         {isDetecting && (
            <button onClick={stopVision} className="absolute bottom-4 right-4 p-3 bg-red-500/20 border border-red-500/40 text-red-500 rounded-2xl hover:bg-red-500 hover:text-black transition-all">
               <Square size={16} fill="currentColor" />
            </button>
         )}
      </div>

      {/* Hardware Replication Lights */}
      <div className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-3xl border border-white/5">
         <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'red' ? 'bg-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)]' : 'bg-red-950/20'}`} />
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.6)]' : 'bg-yellow-950/20'}`} />
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'green' ? 'bg-green-500 shadow-[0_0_25px_rgba(34,197,94,0.6)]' : 'bg-green-950/20'}`} />
         </div>
         <div className="text-right">
            <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">Signal Status</div>
            <div className={`text-sm font-black uppercase tracking-tighter ${sig === 'green' ? 'text-green-400' : 'text-cyan-400'}`}>{sig}</div>
         </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-widest">Density</div>
            <div className="text-lg font-black text-white tabular-nums">{Math.round(lane?.pceScore || 0)}</div>
         </div>
         <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-widest">Wait Time</div>
            <div className="text-lg font-black text-white tabular-nums">{lane?.waitTime || 0}s</div>
         </div>
      </div>
    </div>
  );
}
