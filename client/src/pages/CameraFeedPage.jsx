import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, Play, Square, Camera, Radio, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

const COCO_MAP = { 
  'car': 'car', 'bus': 'bus', 'truck': 'truck', 'motorcycle': 'motorcycle',
  // Toy Car / Demo Fallbacks (Maps anything you hold to a 'Car' for the demo)
  'cell phone': 'car', 'mouse': 'car', 'remote': 'car', 'bottle': 'car', 
  'person': 'car', 'book': 'car', 'cup': 'car', 'apple': 'car', 'teddy bear': 'car'
};

export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};
  const [modelLoaded, setModelLoaded] = useState(false);
  const modelRef = useRef(null);

  // Master Camera State
  const [isDetecting, setIsDetecting] = useState(false);
  const [targetLane, setTargetLane] = useState('1');
  const [liveDetections, setLiveDetections] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

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

  const startVision = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsDetecting(true);
    } catch (e) { 
      console.warn('Environment camera failed, falling back to default.');
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = fallbackStream;
        setIsDetecting(true);
      } catch (err) {
        console.error('All camera access failed:', err);
      }
    }
  };

  const stopVision = () => {
    setIsDetecting(false);
    setLiveDetections(0);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const runDetection = useCallback(async () => {
    if (!modelRef.current || !isDetecting || !videoRef.current) return;
    
    // Lower threshold to 20% for Toy Cars during demo
    const preds = await modelRef.current.detect(videoRef.current, 20, 0.20);
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let counts = { car: 0, bus: 0, truck: 0, motorcycle: 0 };
    let totalFound = 0;

    preds.forEach(p => {
      if (COCO_MAP[p.class]) {
        counts[COCO_MAP[p.class]]++;
        totalFound++;
        const [x, y, w, h] = p.bbox;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);
        
        // Explicit Visual Feedback: Draw Text Label
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y > 20 ? y - 20 : y, 120, 20);
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`, x + 4, y > 20 ? y - 6 : y + 14);
      }
    });

    setLiveDetections(totalFound);

    if (preds.length > 0) {
      // Send data ONLY to the currently targeted lane
      fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId: targetLane,
          junctionId: 'JN-001',
          secret: 'GIVEWAY_NODE_KEY',
          vehicles: { car: counts.car, bus: counts.bus, lorry: counts.truck, bike: counts.motorcycle, ambulance: 0 }
        })
      }).catch(() => {});
    }
    
    rafRef.current = requestAnimationFrame(runDetection);
  }, [isDetecting, targetLane, modelRef]);

  useEffect(() => {
    if (isDetecting) runDetection();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDetecting, runDetection]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-32">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Signal Monitoring System</h1>
        <p className="text-[10px] font-black text-cyan-400 tracking-[0.4em] uppercase">Master AI Sensor Mode Active</p>
      </div>

      {/* ── MASTER CAMERA MODULE ── */}
      <div className="bg-glass-card border border-cyan-500/30 rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)] relative overflow-hidden">
         <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
               <Camera className="text-cyan-400" />
               <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Master AI Sensor</h2>
            </div>
            {isDetecting ? (
               <button onClick={stopVision} className="px-6 py-2 bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-red-500/40 transition-all">
                  <Square size={14} fill="currentColor" /> Stop Sensor
               </button>
            ) : (
               <button onClick={startVision} disabled={!modelLoaded} className="px-6 py-2 bg-cyan-500 text-black rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-cyan-500/20 disabled:opacity-50">
                  <Play size={14} fill="currentColor" /> Enable Master AI
               </button>
            )}
         </div>

         <div className="relative aspect-video max-h-[400px] w-full bg-[#050505] rounded-[2rem] border border-white/10 overflow-hidden shadow-inner mb-6 mx-auto group">
             <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover opacity-80 ${!isDetecting ? 'hidden' : ''}`} />
             <canvas ref={canvasRef} width={1280} height={720} className={`absolute inset-0 w-full h-full pointer-events-none ${!isDetecting ? 'hidden' : ''}`} />
             
             {isDetecting && (
                 <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Feed
                    </div>
                    <div className="text-white font-mono text-sm">
                      Detections: <span className="font-black text-2xl text-cyan-400">{liveDetections}</span>
                    </div>
                    {liveDetections > 0 && (
                      <div className="text-[8px] font-black text-green-400 uppercase tracking-widest mt-1">
                        Sending data to Lane {targetLane}...
                      </div>
                    )}
                 </div>
             )}

             {!isDetecting && (
               <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-950/20 to-black text-center border-dashed border-2 border-white/5 m-4 rounded-3xl" style={{ width: 'calc(100% - 2rem)', height: 'calc(100% - 2rem)' }}>
                  <Zap size={48} className="text-cyan-500/20 mb-4 animate-pulse" />
                  <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Sensor Offline</span>
                  <p className="text-[10px] text-white/30 mt-2 max-w-sm">Click 'Enable Master AI' to start the continuous object detection engine for the presentation.</p>
               </div>
             )}
         </div>

         <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center mb-4 flex items-center justify-center gap-2">
               <Target size={14} className="text-cyan-500" /> Select Target Lane to Feed AI Data
            </p>
            <div className="grid grid-cols-3 gap-4">
               {['1', '2', '3'].map(id => (
                  <button
                     key={id}
                     onClick={() => setTargetLane(id)}
                     className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                        targetLane === id 
                           ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105' 
                           : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                     }`}
                  >
                     Target Lane {id}
                  </button>
               ))}
            </div>
         </div>
      </div>

      {/* ── HARDWARE STATUS CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['1', '2', '3'].map(id => (
          <LaneStatusCard 
            key={id} 
            id={id} 
            lane={lanes[id]} 
            isTarget={targetLane === id}
          />
        ))}
      </div>
    </motion.div>
  );
}

function LaneStatusCard({ id, lane, isTarget }) {
  const sig = lane?.signal || 'red';

  return (
    <div className={`glass-card bg-black/60 border rounded-[2.5rem] p-6 flex flex-col gap-5 shadow-2xl transition-all ${isTarget ? 'border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'border-white/5'}`}>
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-black text-white uppercase tracking-tighter">LANE {id}</h2>
         {isTarget && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse border border-cyan-500/30">Receiving Data</span>}
      </div>

      <div className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-[2rem] border border-white/5 shadow-inner mt-2">
         {/* Vertical Hardware-Style Traffic Light */}
         <div className="flex flex-col gap-2 bg-black/80 p-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
            <div className={`w-8 h-8 rounded-full border-4 border-black/60 transition-all duration-300 ${sig === 'red' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-red-950/20'}`} />
            <div className={`w-8 h-8 rounded-full border-4 border-black/60 transition-all duration-300 ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)]' : 'bg-yellow-950/20'}`} />
            <div className={`w-8 h-8 rounded-full border-4 border-black/60 transition-all duration-300 ${sig === 'green' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]' : 'bg-green-950/20'}`} />
         </div>
         
         <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Current Phase</span>
            <div className={`text-xl font-black uppercase tracking-widest ${sig === 'green' ? 'text-green-400' : sig === 'yellow' ? 'text-yellow-400' : 'text-red-500'}`}>{sig}</div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Traffic Density</div>
            <div className="text-xl font-black text-white tabular-nums">{Math.round(lane?.pceScore || 0)}</div>
         </div>
         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Signal Wait</div>
            <div className="text-xl font-black text-white tabular-nums">{lane?.waitTime || 0}s</div>
         </div>
      </div>
    </div>
  );
}
