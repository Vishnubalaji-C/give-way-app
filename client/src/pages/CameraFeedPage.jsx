import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Zap, Activity, Cpu, ShieldCheck, Play, Square, Settings, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config';

// Pre-trained weights for the AI brain
const PCE_WEIGHTS = { car: 1, bus: 15, truck: 8, motorcycle: 0.5, ambulance: 500 };
const COCO_MAP = { car: 'car', bus: 'bus', truck: 'truck', motorcycle: 'motorcycle' };

export default function CameraFeedPage() {
  const { state, send } = useWs();
  const lanes = state?.lanes || {};

  // --- AI & Stream State ---
  const [visionMode, setVisionMode] = useState('demo'); // 'demo' (laptop) or 'hardware' (esp32)
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.10');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [activeLane, setActiveLane] = useState('1');
  const [fps, setFps] = useState(0);

  // --- Refs for TF.js ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  // --- Load AI Brain (Pre-trained COCO-SSD) ---
  const loadModel = async () => {
    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const coco = await import('@tensorflow-models/coco-ssd');
      modelRef.current = await coco.load();
      setModelLoaded(true);
    } catch (e) {
      console.error('AI Model failed to load:', e);
    }
  };

  useEffect(() => { loadModel(); }, []);

  // --- Start Camera (Plan B: Laptop) ---
  const startDemoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { alert('Camera denied'); }
  };

  // --- AI Detection Loop ---
  const runDetection = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !isDetecting) return;
    
    const predictions = await modelRef.current.detect(videoRef.current);
    
    // Draw Bounding Boxes
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let counts = { car: 0, bus: 0, truck: 0, motorcycle: 0 };
    
    predictions.forEach(p => {
      if (COCO_MAP[p.class]) {
        counts[COCO_MAP[p.class]]++;
        const [x, y, w, h] = p.bbox;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#00E5FF';
        ctx.fillText(`${p.class} ${(p.score * 100).toFixed(0)}%`, x, y > 10 ? y - 5 : 10);
      }
    });

    // Send AI Data to Hardware (Arduino Mega)
    if (predictions.length > 0) {
      fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId: activeLane,
          junctionId: 'JN-001',
          secret: 'GIVEWAY_NODE_KEY',
          vehicles: {
            car: counts.car,
            bus: counts.bus,
            lorry: counts.truck,
            bike: counts.motorcycle,
            ambulance: 0
          }
        })
      }).catch(() => {});
    }

    rafRef.current = requestAnimationFrame(runDetection);
  }, [isDetecting, activeLane]);

  useEffect(() => {
    if (isDetecting) runDetection();
    else if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDetecting, runDetection]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">AI Evidence Terminal</h1>
          <p className="text-white/40 mt-1 text-sm font-bold uppercase tracking-widest">
            <span className="text-cyan-400">Inference Engine</span> · Hardware Loop Sync
          </p>
        </div>
        <div className="flex gap-2">
           <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-[10px] font-black ${modelLoaded ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/5 text-white/20'}`}>
              <Activity size={14} className={modelLoaded ? 'animate-pulse' : ''} />
              AI BRAIN: {modelLoaded ? 'READY' : 'LOADING...'}
           </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_400px] gap-6">
        
        {/* --- Main Vision Feed --- */}
        <div className="glass-card bg-black border border-white/5 rounded-3xl overflow-hidden flex flex-col">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex gap-2">
                 <button 
                   onClick={() => { setVisionMode('demo'); startDemoCamera(); }}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${visionMode === 'demo' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/40'}`}
                 >
                    PLAN B: LAPTOP CAM
                 </button>
                 <button 
                   onClick={() => setVisionMode('hardware')}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${visionMode === 'hardware' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/40'}`}
                 >
                    PLAN A: ESP32-CAM
                 </button>
              </div>
              <div className="flex items-center gap-2">
                 <Settings size={14} className="text-white/20" />
                 <select 
                   value={activeLane} 
                   onChange={(e) => setActiveLane(e.target.value)}
                   className="bg-transparent text-[10px] font-black text-cyan-400 outline-none"
                 >
                    <option value="1">LANE 1 (SOUTH)</option>
                    <option value="2">LANE 2 (EAST)</option>
                    <option value="3">LANE 3 (WEST)</option>
                 </select>
              </div>
           </div>

           <div className="relative aspect-video bg-slate-900 overflow-hidden">
              {visionMode === 'demo' ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full pointer-events-none" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                   <div className="text-center p-8 border-2 border-dashed border-white/10 rounded-3xl">
                      <Radio size={48} className="text-white/10 mx-auto mb-4" />
                      <h3 className="text-white font-black text-sm uppercase">ESP32-CAM Link Required</h3>
                      <p className="text-[10px] text-white/30 max-w-xs mt-2">To stream your ESP32-CAM, enter its IP address below. Ensure it is running the "CameraWebServer" example from Arduino IDE.</p>
                      <input 
                        type="text" 
                        value={esp32Ip} 
                        onChange={(e) => setEsp32Ip(e.target.value)}
                        className="mt-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-cyan-400 text-center font-mono text-xs w-full"
                      />
                   </div>
                   <button className="px-8 py-3 bg-cyan-500 text-black font-black text-xs rounded-xl shadow-xl hover:scale-105 transition-all">CONNECT STREAM</button>
                </div>
              )}

              {/* Status HUD */}
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                 <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDetecting ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    Inference: {isDetecting ? 'ACTIVE' : 'IDLE'}
                 </div>
              </div>
           </div>

           <div className="p-6 bg-white/5 flex gap-4">
              <button 
                onClick={() => setIsDetecting(!isDetecting)}
                disabled={!modelLoaded}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDetecting ? 'bg-red-500 text-black shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]'}`}
              >
                 {isDetecting ? <><Square size={16} /> Stop AI Vision</> : <><Play size={16} /> Start AI Sense</>}
              </button>
           </div>
        </div>

        {/* --- Side Panel: Signal Replication --- */}
        <div className="space-y-6">
           <div className="glass-card p-6 bg-black border border-white/5 rounded-3xl">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-6">Hardware Signal Link</h3>
              
              <div className="grid grid-cols-3 gap-4">
                 {['1', '2', '3'].map(id => (
                    <div key={id} className="flex flex-col items-center gap-4">
                       <div className="text-[10px] font-black text-white/30">LANE {id}</div>
                       <div className="bg-[#111] p-3 rounded-2xl border border-white/5 flex flex-col gap-2">
                          <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'red' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-950/20'}`} />
                          <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'yellow' ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-yellow-950/20'}`} />
                          <div className={`w-3 h-3 rounded-full ${lanes[id]?.signal === 'green' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-green-950/20'}`} />
                       </div>
                       <div className={`text-[10px] font-black ${lanes[id]?.signal === 'green' ? 'text-green-400' : 'text-white/20'}`}>
                          {lanes[id]?.signal?.toUpperCase() || 'RED'}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="glass-card p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                 <ShieldCheck size={18} className="text-cyan-400" />
                 <h3 className="text-xs font-black text-white uppercase tracking-widest">Logic Evidence</h3>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed italic mb-4">
                 "Whenever the AI detects a car in the active lane, it calculates the PCE weight and sends a priority packet to the Arduino Mega. This overrides the timer and forces a Green signal to clear traffic."
              </p>
              <div className="space-y-2">
                 <div className="flex justify-between text-[9px] font-black text-white/20 uppercase">
                    <span>Target Lane</span>
                    <span className="text-cyan-400">{activeLane}</span>
                 </div>
                 <div className="flex justify-between text-[9px] font-black text-white/20 uppercase">
                    <span>Processing Device</span>
                    <span className="text-white/60">LOCAL_EDGE_AI</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </motion.div>
  );
}
