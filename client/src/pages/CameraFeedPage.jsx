import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, Play, Square, Crosshair, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

const COCO_MAP = { car: 'car', bus: 'bus', truck: 'truck', motorcycle: 'motorcycle' };

export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [targetLane, setTargetLane] = useState('1');
  const [hardwareMode, setHardwareMode] = useState(false);
  
  const modelRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Load TensorFlow Model
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

  // Master Camera Logic
  const startVision = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsDetecting(true);
    } catch (e) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = fallbackStream;
        setIsDetecting(true);
      } catch (err) {
        console.error('Camera access failed:', err);
      }
    }
  };

  const stopVision = () => {
    setIsDetecting(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // The AI Detection Loop
  const runDetection = useCallback(async () => {
    if (!modelRef.current || !isDetecting || !videoRef.current) return;
    
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

    if (preds.length >= 0) {
      // Send data to the TARGETED lane
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

      // Clear the other lanes automatically for a smooth demo
      ['1', '2', '3'].filter(id => id !== targetLane).forEach(otherLane => {
          fetch(`${API_BASE_URL}/api/edge-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              laneId: otherLane,
              junctionId: 'JN-001',
              secret: 'GIVEWAY_NODE_KEY',
              vehicles: { car: 0, bus: 0, lorry: 0, bike: 0, ambulance: 0 }
            })
          }).catch(() => {});
      });
    }

    rafRef.current = requestAnimationFrame(runDetection);
  }, [isDetecting, targetLane, modelRef]);

  useEffect(() => {
    if (isDetecting) runDetection();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDetecting, runDetection]);


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Master AI Sensor</h1>
          <p className="text-[10px] font-black text-cyan-400 tracking-[0.4em] uppercase">Automated Single-Device Demonstration Mode</p>
        </div>
        <button 
          onClick={() => {
             stopVision();
             setHardwareMode(!hardwareMode);
          }}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${hardwareMode ? 'bg-cyan-500 text-black' : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'}`}
        >
          <Radio size={14} /> Hardware ESP32 Mode
        </button>
      </div>

      {/* MASTER CAMERA VIEW */}
      {!hardwareMode && (
        <div className="bg-glass-card border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col lg:flex-row gap-6">
          {/* Camera Frame */}
          <div className="relative aspect-video lg:w-2/3 bg-[#050505] rounded-[2rem] border border-white/5 overflow-hidden shadow-inner group">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-60" />
            <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full pointer-events-none" />
            
            {!isDetecting ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                 <Zap size={32} className="text-white/20 mb-4" />
                 <button 
                   onClick={startVision} 
                   disabled={!modelLoaded}
                   className="px-8 py-4 bg-cyan-500 text-black font-black text-xs rounded-2xl shadow-xl hover:scale-105 transition-all uppercase tracking-widest flex items-center gap-3 disabled:opacity-50"
                 >
                    {modelLoaded ? <><Play size={16}/> Start Master Sensor</> : 'Loading AI Engine...'}
                 </button>
               </div>
            ) : (
               <button onClick={stopVision} className="absolute top-4 right-4 p-3 bg-red-500 text-black rounded-2xl hover:scale-110 transition-all shadow-lg z-10">
                  <Square size={16} fill="currentColor" />
               </button>
            )}
          </div>

          {/* Target Selectors */}
          <div className="lg:w-1/3 flex flex-col gap-4">
             <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Select Target Lane</div>
             {['1', '2', '3'].map(id => (
                <button
                  key={id}
                  onClick={() => setTargetLane(id)}
                  disabled={!isDetecting}
                  className={`relative p-5 rounded-2xl border transition-all text-left flex items-center justify-between ${
                    targetLane === id && isDetecting
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  } ${!isDetecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div>
                     <div className={`text-xs font-black uppercase tracking-widest ${targetLane === id && isDetecting ? 'text-cyan-400' : 'text-white'}`}>Feed to Lane {id}</div>
                     <div className="text-[10px] font-medium text-white/40 mt-1">Directs camera logic to Node {id}</div>
                  </div>
                  {targetLane === id && isDetecting && (
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                      <Crosshair size={16} className="text-cyan-400" />
                    </div>
                  )}
                </button>
             ))}
          </div>
        </div>
      )}

      {hardwareMode && (
        <div className="bg-glass-card border border-cyan-500/20 rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center text-center">
           <Radio size={48} className="text-cyan-500 mb-6 animate-pulse" />
           <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">ESP32-CAM Mode Active</h2>
           <p className="text-white/40 max-w-lg mb-8">The system is currently listening exclusively to real hardware ESP32 cameras over the network. Laptop/Phone camera is disabled.</p>
        </div>
      )}

      {/* LANE STATUS CARDS (Display Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['1', '2', '3'].map(id => (
          <LaneStatusCard 
            key={id} 
            id={id} 
            lane={lanes[id]} 
            isActiveTarget={targetLane === id && isDetecting && !hardwareMode}
          />
        ))}
      </div>
    </motion.div>
  );
}

function LaneStatusCard({ id, lane, isActiveTarget }) {
  const sig = lane?.signal || 'red';

  return (
    <div className={`glass-card bg-black/60 border rounded-[2.5rem] p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden transition-all ${isActiveTarget ? 'border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'border-white/5'}`}>
      
      {isActiveTarget && (
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 animate-pulse" />
      )}

      <div className="flex justify-between items-center">
         <h2 className="text-xl font-black text-white uppercase tracking-tighter">LANE {id} NODE</h2>
         {isActiveTarget && <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest animate-pulse flex items-center gap-2"><Crosshair size={12}/> Receiving Data</span>}
      </div>

      <div className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-[2rem] border border-white/5 shadow-inner mt-4">
         <div className="flex gap-4">
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'red' ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'bg-red-950/20'}`} />
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)]' : 'bg-yellow-950/20'}`} />
            <div className={`w-10 h-10 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'green' ? 'bg-green-500 shadow-[0_0_30px_rgba(34,197,94,0.6)]' : 'bg-green-950/20'}`} />
         </div>
         <div className={`text-sm font-black uppercase tracking-widest ${sig === 'green' ? 'text-green-400' : 'text-cyan-400'}`}>{sig}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">PCE Density</div>
            <div className="text-2xl font-black text-white tabular-nums">{Math.round(lane?.density || 0)}</div>
         </div>
         <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
            <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Signal Wait</div>
            <div className="text-2xl font-black text-white tabular-nums">{lane?.waitTime || 0}s</div>
         </div>
      </div>
    </div>
  );
}
