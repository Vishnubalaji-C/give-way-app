import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, Play, Square, Camera, Upload, Film, Target, Eye, Car, Bike, Bus, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

// Only real vehicle classes — no toy fallbacks
const VEHICLE_CLASSES = new Set(['car', 'bus', 'truck', 'motorcycle', 'bicycle']);

// Zone colors for visual overlay
const ZONE_COLORS = {
  '1': { fill: 'rgba(59,130,246,0.12)', stroke: 'rgba(59,130,246,0.6)', label: '#3B82F6' },
  '2': { fill: 'rgba(34,197,94,0.12)', stroke: 'rgba(34,197,94,0.6)', label: '#22C55E' },
  '3': { fill: 'rgba(239,68,68,0.12)', stroke: 'rgba(239,68,68,0.6)', label: '#EF4444' },
};

export default function CameraFeedPage() {
  const { state } = useWs();
  const lanes = state?.lanes || {};
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Loading AI Model...');
  const modelRef = useRef(null);

  // Input mode: 'live' | 'image' | 'video'
  const [inputMode, setInputMode] = useState('live');
  const [isDetecting, setIsDetecting] = useState(false);
  const [laneCounts, setLaneCounts] = useState({
    '1': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
    '2': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
    '3': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const uploadVideoRef = useRef(null);
  const rafRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Load COCO-SSD model
  useEffect(() => {
    const load = async () => {
      setLoadingMsg('Loading TensorFlow.js...');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      setLoadingMsg('Loading COCO-SSD Detection Model...');
      const coco = await import('@tensorflow-models/coco-ssd');
      modelRef.current = await coco.load();
      setModelLoaded(true);
      setLoadingMsg('');
    };
    load();
  }, []);

  // ── LIVE CAMERA ──
  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsDetecting(true);
    } catch (e) {
      console.warn('Environment camera failed, trying default...');
      try {
        const fb = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) { videoRef.current.srcObject = fb; videoRef.current.play(); }
        setIsDetecting(true);
      } catch (err) { console.error('Camera access denied:', err); }
    }
  };

  const stopDetection = () => {
    setIsDetecting(false);
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (uploadVideoRef.current) { uploadVideoRef.current.pause(); }
    setLaneCounts({
      '1': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '2': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '3': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
    });
  };

  // ── IMAGE UPLOAD ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stopDetection();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Draw image on canvas and run detection once
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      runSingleDetection(img, img.width, img.height);
    };
    img.src = url;
    setInputMode('image');
  };

  // ── VIDEO UPLOAD ──
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stopDetection();
    const url = URL.createObjectURL(file);
    if (uploadVideoRef.current) {
      uploadVideoRef.current.src = url;
      uploadVideoRef.current.play();
      setInputMode('video');
      setIsDetecting(true);
    }
  };

  // ── ROI ZONE MAPPING ──
  function getZoneForPosition(y, frameHeight) {
    const third = frameHeight / 3;
    if (y < third) return '1';
    if (y < third * 2) return '2';
    return '3';
  }

  // ── DRAW ZONE OVERLAYS ──
  function drawZoneOverlays(ctx, w, h) {
    const third = h / 3;
    ['1', '2', '3'].forEach((id, i) => {
      const zone = ZONE_COLORS[id];
      const y = i * third;
      // Fill zone
      ctx.fillStyle = zone.fill;
      ctx.fillRect(0, y, w, third);
      // Zone border
      ctx.strokeStyle = zone.stroke;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(2, y + 2, w - 4, third - 4);
      ctx.setLineDash([]);
      // Zone label
      ctx.fillStyle = zone.label;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`LANE ${id} ZONE`, 10, y + 22);
    });
  }

  // ── SINGLE FRAME DETECTION (for images) ──
  const runSingleDetection = async (source, w, h) => {
    if (!modelRef.current) return;
    const preds = await modelRef.current.detect(source, 20, 0.50);
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);

    // Draw zone overlays
    drawZoneOverlays(ctx, w, h);

    const counts = {
      '1': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '2': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '3': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
    };

    preds.forEach(p => {
      if (!VEHICLE_CLASSES.has(p.class)) return;
      const [x, y, bw, bh] = p.bbox;
      const centerY = y + bh / 2;
      const laneId = getZoneForPosition(centerY, h);
      const vType = p.class === 'bicycle' ? 'motorcycle' : (p.class === 'truck' ? 'truck' : p.class);
      if (counts[laneId][vType] !== undefined) counts[laneId][vType]++;
      counts[laneId].total++;

      // Draw bounding box with lane color
      const zone = ZONE_COLORS[laneId];
      ctx.strokeStyle = zone.stroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bw, bh);
      // Label
      const label = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}% → L${laneId}`;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(x, y > 22 ? y - 22 : y, label.length * 8.5, 22);
      ctx.fillStyle = zone.label;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(label, x + 4, y > 22 ? y - 6 : y + 14);
    });

    setLaneCounts(counts);

    // Send all 3 lanes to backend simultaneously
    ['1', '2', '3'].forEach(laneId => {
      const c = counts[laneId];
      fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId, junctionId: 'JN-001', secret: 'GIVEWAY_NODE_KEY',
          vehicles: { car: c.car, bus: c.bus, lorry: c.truck, bike: c.motorcycle, ambulance: 0 }
        })
      }).catch(() => {});
    });
  };

  // ── CONTINUOUS DETECTION (for live camera & video) ──
  const runContinuousDetection = useCallback(async () => {
    if (!modelRef.current || !isDetecting) return;

    const source = inputMode === 'video' ? uploadVideoRef.current : videoRef.current;
    if (!source || (source.paused && inputMode === 'video')) return;

    const w = source.videoWidth || source.width || 640;
    const h = source.videoHeight || source.height || 480;
    if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(runContinuousDetection); return; }

    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);

    // Draw zone overlays
    drawZoneOverlays(ctx, w, h);

    const preds = await modelRef.current.detect(source, 20, 0.50);

    const counts = {
      '1': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '2': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
      '3': { car: 0, bus: 0, truck: 0, motorcycle: 0, total: 0 },
    };

    preds.forEach(p => {
      if (!VEHICLE_CLASSES.has(p.class)) return;
      const [x, y, bw, bh] = p.bbox;
      const centerY = y + bh / 2;
      const laneId = getZoneForPosition(centerY, h);
      const vType = p.class === 'bicycle' ? 'motorcycle' : (p.class === 'truck' ? 'truck' : p.class);
      if (counts[laneId][vType] !== undefined) counts[laneId][vType]++;
      counts[laneId].total++;

      const zone = ZONE_COLORS[laneId];
      ctx.strokeStyle = zone.stroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bw, bh);
      const label = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}% → L${laneId}`;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(x, y > 22 ? y - 22 : y, label.length * 8.5, 22);
      ctx.fillStyle = zone.label;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(label, x + 4, y > 22 ? y - 6 : y + 14);
    });

    setLaneCounts(counts);

    // Send all 3 lanes simultaneously
    ['1', '2', '3'].forEach(laneId => {
      const c = counts[laneId];
      fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId, junctionId: 'JN-001', secret: 'GIVEWAY_NODE_KEY',
          vehicles: { car: c.car, bus: c.bus, lorry: c.truck, bike: c.motorcycle, ambulance: 0 }
        })
      }).catch(() => {});
    });

    rafRef.current = requestAnimationFrame(runContinuousDetection);
  }, [isDetecting, inputMode, modelRef]);

  useEffect(() => {
    if (isDetecting && (inputMode === 'live' || inputMode === 'video')) runContinuousDetection();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDetecting, runContinuousDetection]);

  const totalDetections = laneCounts['1'].total + laneCounts['2'].total + laneCounts['3'].total;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-32">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Signal Monitoring System</h1>
        <p className="text-[10px] font-black text-cyan-400 tracking-[0.4em] uppercase">
          {isDetecting ? '● AI Detection Active — All 3 Lanes Monitored' : 'Unified AI Detection Pipeline'}
        </p>
      </div>

      {/* ── INPUT MODE SELECTOR ── */}
      <div className="glass-card bg-black/60 border border-cyan-500/30 rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        
        {/* Header with input tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Eye className="text-cyan-400" size={24} />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Detection Engine</h2>
          </div>
          
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 gap-1">
            <button onClick={() => { stopDetection(); setInputMode('live'); }}
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${inputMode === 'live' ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white/70'}`}>
              <Camera size={14}/> Live Camera
            </button>
            <button onClick={() => { stopDetection(); setInputMode('image'); fileInputRef.current?.click(); }}
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${inputMode === 'image' ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white/70'}`}>
              <Upload size={14}/> Image
            </button>
            <button onClick={() => { stopDetection(); setInputMode('video'); videoInputRef.current?.click(); }}
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${inputMode === 'video' ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white/70'}`}>
              <Film size={14}/> Video
            </button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

        {/* Detection Viewport */}
        <div className="relative w-full bg-[#050505] rounded-[2rem] border border-white/10 overflow-hidden shadow-inner mb-6" style={{ minHeight: '300px' }}>
          
          {/* Live camera video (hidden when not live mode) */}
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-contain ${inputMode !== 'live' || !isDetecting ? 'hidden' : ''}`} />
          
          {/* Uploaded video (hidden when not video mode) */}
          <video ref={uploadVideoRef} muted playsInline loop className={`w-full h-full object-contain ${inputMode !== 'video' || !isDetecting ? 'hidden' : ''}`} />
          
          {/* Detection canvas overlay */}
          <canvas ref={canvasRef} className={`${inputMode === 'live' || inputMode === 'video' ? 'absolute inset-0' : ''} w-full h-full object-contain ${!isDetecting && inputMode !== 'image' ? 'hidden' : ''}`} />

          {/* Live HUD */}
          {(isDetecting || inputMode === 'image') && (
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3 shadow-lg">
              <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> {inputMode === 'image' ? 'Image Scan' : 'Live Feed'}
              </div>
              <div className="text-white font-mono text-sm">
                Total: <span className="font-black text-2xl text-cyan-400">{totalDetections}</span>
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-[9px] font-bold" style={{color: ZONE_COLORS['1'].label}}>L1: {laneCounts['1'].total}</span>
                <span className="text-[9px] font-bold" style={{color: ZONE_COLORS['2'].label}}>L2: {laneCounts['2'].total}</span>
                <span className="text-[9px] font-bold" style={{color: ZONE_COLORS['3'].label}}>L3: {laneCounts['3'].total}</span>
              </div>
            </div>
          )}

          {/* Idle state */}
          {!isDetecting && inputMode !== 'image' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-cyan-950/20 to-black text-center p-8">
              <Zap size={48} className="text-cyan-500/20 mb-4 animate-pulse" />
              {!modelLoaded ? (
                <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">{loadingMsg}</span>
              ) : (
                <>
                  <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Sensor Offline</span>
                  <p className="text-[10px] text-white/30 mt-2 max-w-md">
                    Choose an input mode above. Mount your camera above the junction to auto-detect all 3 lanes simultaneously.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          {inputMode === 'live' && !isDetecting && (
            <button onClick={startLiveCamera} disabled={!modelLoaded}
              className="px-8 py-3 bg-cyan-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-cyan-500/20 disabled:opacity-50">
              <Play size={16} fill="currentColor" /> Start Live Detection
            </button>
          )}
          {isDetecting && (
            <button onClick={stopDetection}
              className="px-8 py-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/30 transition-all">
              <Square size={16} fill="currentColor" /> Stop Detection
            </button>
          )}
          {inputMode === 'image' && !isDetecting && (
            <button onClick={() => fileInputRef.current?.click()} disabled={!modelLoaded}
              className="px-8 py-3 bg-cyan-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl disabled:opacity-50">
              <Upload size={16} /> Upload Traffic Image
            </button>
          )}
          {inputMode === 'video' && !isDetecting && (
            <button onClick={() => videoInputRef.current?.click()} disabled={!modelLoaded}
              className="px-8 py-3 bg-cyan-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl disabled:opacity-50">
              <Film size={16} /> Upload Traffic Video
            </button>
          )}
        </div>

        {/* Zone Legend */}
        <div className="flex justify-center gap-6 mt-4">
          {['1','2','3'].map(id => (
            <div key={id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZONE_COLORS[id].label }} />
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Lane {id} Zone</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── LANE STATUS CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['1', '2', '3'].map(id => (
          <LaneStatusCard key={id} id={id} lane={lanes[id]} counts={laneCounts[id]} zoneColor={ZONE_COLORS[id]} />
        ))}
      </div>
    </motion.div>
  );
}

function LaneStatusCard({ id, lane, counts, zoneColor }) {
  const sig = lane?.signal || 'red';

  return (
    <div className="glass-card bg-black/60 border rounded-[2.5rem] p-6 flex flex-col gap-4 shadow-2xl transition-all"
         style={{ borderColor: zoneColor.stroke }}>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">LANE {id}</h2>
        {counts.total > 0 && (
          <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse border"
                style={{ backgroundColor: zoneColor.fill, color: zoneColor.label, borderColor: zoneColor.stroke }}>
            {counts.total} Detected
          </span>
        )}
      </div>

      {/* Traffic Light */}
      <div className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-[2rem] border border-white/5 shadow-inner">
        <div className="flex gap-4">
          <div className={`w-9 h-9 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'red' ? 'bg-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)]' : 'bg-red-950/20'}`} />
          <div className={`w-9 h-9 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'yellow' ? 'bg-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.6)]' : 'bg-yellow-950/20'}`} />
          <div className={`w-9 h-9 rounded-full border-4 border-black/40 transition-all duration-300 ${sig === 'green' ? 'bg-green-500 shadow-[0_0_25px_rgba(34,197,94,0.6)]' : 'bg-green-950/20'}`} />
        </div>
        <div className={`text-xs font-black uppercase tracking-widest ${sig === 'green' ? 'text-green-400' : sig === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>{sig}</div>
      </div>

      {/* Vehicle Breakdown */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
          <Car size={14} className="text-white/30 mb-1" />
          <div className="text-[8px] font-black text-white/30 uppercase">Cars</div>
          <div className="text-sm font-black text-white tabular-nums">{counts.car}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
          <Bike size={14} className="text-white/30 mb-1" />
          <div className="text-[8px] font-black text-white/30 uppercase">Bikes</div>
          <div className="text-sm font-black text-white tabular-nums">{counts.motorcycle}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
          <Bus size={14} className="text-white/30 mb-1" />
          <div className="text-[8px] font-black text-white/30 uppercase">Buses</div>
          <div className="text-sm font-black text-white tabular-nums">{counts.bus}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
          <Truck size={14} className="text-white/30 mb-1" />
          <div className="text-[8px] font-black text-white/30 uppercase">Trucks</div>
          <div className="text-sm font-black text-white tabular-nums">{counts.truck}</div>
        </div>
      </div>

      {/* Density & Wait */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex flex-col items-center">
          <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Traffic Density</div>
          <div className="text-xl font-black text-white tabular-nums">{Math.round(lane?.pceScore || 0)}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex flex-col items-center">
          <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Signal Wait</div>
          <div className="text-xl font-black text-white tabular-nums">{lane?.waitTime || 0}s</div>
        </div>
      </div>
    </div>
  );
}
