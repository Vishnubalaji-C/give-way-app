import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Play, Square, Zap, AlertTriangle, ChevronDown, Activity, Radio, Cpu, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

// ── Constants ─────────────────────────────────────────────────────────────────
const PCE_WEIGHTS  = { ambulance: 500, bus: 15, car: 1, bike: 0.5, lorry: 8 };
const NODE_SECRET  = 'GIVEWAY_NODE_KEY';
const POST_INTERVAL = 5000; // ms — how often counts are sent to PCE engine

// COCO-SSD label → GiveWay vehicle type
const COCO_MAP = {
  car:        'car',
  bus:        'bus',
  truck:      'lorry',
  motorcycle: 'bike',
  bicycle:    'bike',
  person:     'person', // pedestrian — not a PCE vehicle but tracked
};

// Colour per type (bounding box + UI)
const V_COLORS = {
  car:       '#10b981',
  bus:       '#06b6d4',
  lorry:     '#f59e0b',
  bike:      '#8b5cf6',
  ambulance: '#ef4444',
  person:    '#ec4899',
};

const LANE_LABELS = { '1': 'South Approach', '2': 'East Approach', '3': 'West Approach' };
const EMPTY_COUNTS = { ambulance: 0, bus: 0, car: 0, bike: 0, lorry: 0, person: 0 };

// ── Main Component ────────────────────────────────────────────────────────────
export default function CameraFeedPage() {
  const { state, send } = useWs();
  const lanes = state?.lanes || {};

  // Refs
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const modelRef     = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const postTimerRef = useRef(null);
  const countsRef    = useRef(EMPTY_COUNTS); // always-current counts for the post timer

  // State
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded,  setModelLoaded]  = useState(false);
  const [camActive,    setCamActive]    = useState(false);
  const [detecting,    setDetecting]    = useState(false);
  const [selectedLane, setSelectedLane] = useState('1');
  const [threshold,    setThreshold]    = useState(0.45);
  const [fps,          setFps]          = useState(0);
  const [lastSent,     setLastSent]     = useState(null);
  const [error,        setError]        = useState(null);
  const [counts,       setCounts]       = useState(EMPTY_COUNTS);
  const [pceScore,     setPceScore]     = useState(0);
  const [totalFrames,  setTotalFrames]  = useState(0);

  // Keep countsRef in sync for the interval
  useEffect(() => { countsRef.current = counts; }, [counts]);

  // ── Load COCO-SSD model lazily ──────────────────────────────────────────────
  const loadModel = useCallback(async () => {
    if (modelRef.current || modelLoading) return;
    setModelLoading(true);
    setError(null);
    try {
      // Dynamic imports so TF.js doesn't block the initial page load
      const tf   = await import('@tensorflow/tfjs');
      await tf.ready();
      const coco = await import('@tensorflow-models/coco-ssd');
      modelRef.current = await coco.load({ base: 'lite_mobilenet_v2' });
      setModelLoaded(true);
      console.log('[AI] ✅ COCO-SSD model loaded & ready');
    } catch (err) {
      setError('AI model failed to load: ' + err.message);
    } finally {
      setModelLoading(false);
    }
  }, [modelLoading]);

  // ── Start webcam ────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 1280 },
          height:     { ideal: 720 },
          facingMode: 'environment', // back camera on phones, webcam on laptop
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamActive(true);
      await loadModel(); // load model as soon as camera is ready
    } catch (err) {
      setError('Camera access denied — please allow camera permissions in browser settings.');
    }
  };

  // ── Stop webcam ──────────────────────────────────────────────────────────────
  const stopCamera = () => {
    setDetecting(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCamActive(false);
    setCounts({ ...EMPTY_COUNTS });
    setPceScore(0);
    setFps(0);
  };

  // ── Detection loop (runs every animation frame) ───────────────────────────
  const detect = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!modelRef.current || !video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    // Sync canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const t0   = performance.now();
    const preds = await modelRef.current.detect(video);
    const elapsed = performance.now() - t0;
    setFps(Math.round(1000 / Math.max(elapsed, 10)));
    setTotalFrames(f => f + 1);

    // Filter by confidence threshold
    const filtered = preds.filter(p => (COCO_MAP[p.class] !== undefined) && p.score >= threshold);

    // Count per type
    const newCounts = { ...EMPTY_COUNTS };
    filtered.forEach(p => {
      const mapped = COCO_MAP[p.class];
      if (mapped) newCounts[mapped] = (newCounts[mapped] || 0) + 1;
    });

    // Compute PCE
    const score = Object.entries(PCE_WEIGHTS).reduce(
      (acc, [k, w]) => acc + (newCounts[k] || 0) * w, 0
    );

    setCounts(newCounts);
    setPceScore(Math.round(score));

    // Draw canvas bounding boxes
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    filtered.forEach(({ bbox, class: cls, score: conf }) => {
      const [x, y, w, h] = bbox;
      const mapped = COCO_MAP[cls] || 'car';
      const color  = V_COLORS[mapped] || '#ffffff';

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Corner accents
      const cs = 12;
      ctx.lineWidth = 4;
      [
        [x, y, cs, 0, 0, cs], [x + w, y, -cs, 0, 0, cs],
        [x, y + h, cs, 0, 0, -cs], [x + w, y + h, -cs, 0, 0, -cs],
      ].forEach(([ox, oy, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath(); ctx.moveTo(ox + dx1, oy + dy1);
        ctx.lineTo(ox, oy); ctx.lineTo(ox + dx2, oy + dy2);
        ctx.strokeStyle = color; ctx.stroke();
      });

      // Label background
      const label = `${cls}  ${(conf * 100).toFixed(0)}%`;
      ctx.font = 'bold 12px monospace';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color + 'dd';
      ctx.fillRect(x, y - 22, textW + 14, 22);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 7, y - 6);
    });

    rafRef.current = requestAnimationFrame(detect);
  }, [threshold]);

  // ── Start / Stop detection loop ────────────────────────────────────────────
  useEffect(() => {
    if (detecting && modelLoaded && camActive) {
      detect();
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [detecting, modelLoaded, camActive, detect]);

  // ── Auto-POST counts to server every 5 seconds ──────────────────────────────
  useEffect(() => {
    if (!detecting) { clearInterval(postTimerRef.current); return; }

    const push = async () => {
      const c = countsRef.current;
      try {
        await fetch(`${API_BASE_URL}/api/edge-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            laneId:     selectedLane,
            secret:     NODE_SECRET,
            junctionId: state?.junction?.id || 'JN-001',
            vehicles: {
              ambulance: c.ambulance,
              bus:       c.bus,
              car:       c.car,
              bike:      c.bike,
              lorry:     c.lorry,
            },
            pedestrian: c.person > 0,
          }),
        });
        setLastSent(Date.now());
      } catch (_) { /* server may be offline */ }
    };

    push(); // send immediately on start
    
    // REGISTER VIRTUAL NODE ON SERVER
    if (detecting && state?.junction?.id) {
       send('NODE_ONLINE', { junctionId: state.junction.id });
    }

    postTimerRef.current = setInterval(push, POST_INTERVAL);
    return () => clearInterval(postTimerRef.current);
  }, [detecting, selectedLane, state?.junction?.id, send]);

  // ── Emergency inject (manual button) ─────────────────────────────────────
  const injectEmergency = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/edge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laneId:          selectedLane,
          secret:          NODE_SECRET,
          junctionId:      state?.junction?.id || 'JN-001',
          vehicles:        { ...countsRef.current, ambulance: 1 },
          priorityTrigger: true,
        }),
      });
      setLastSent(Date.now());
    } catch (_) {}
  };

  const pct = Math.min(pceScore / 120, 1) * 100;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }} className="space-y-6 pb-32">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">AI Vision Terminal</h1>
          <p className="text-white/40 mt-1 text-sm">
            Live Edge Intelligence · <span className="text-cyan-400 font-bold uppercase tracking-tight">Propless Showcase Mode</span> ·
            Active on Laptop Webcam & Mobile Lens
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <StatusBadge
            label={modelLoading ? 'Loading Model...' : modelLoaded ? 'COCO-SSD ✓ READY' : 'MODEL OFFLINE'}
            color={modelLoaded ? 'green' : modelLoading ? 'amber' : 'slate'}
            pulse={modelLoading}
          />
          <StatusBadge
            label={detecting ? `● ${fps} FPS · DETECTING` : camActive ? 'CAM ON · PAUSED' : 'OFFLINE'}
            color={detecting ? 'cyan' : camActive ? 'amber' : 'slate'}
            pulse={detecting}
          />
        </div>
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      <div className="grid xl:grid-cols-[1fr_340px] gap-6">

        {/* ── Camera Feed Panel ──────────────────────────────────────────── */}
        <div className="glass border border-cyan-500/10 rounded-2xl overflow-hidden">

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.02]">

            {/* Lane Selector */}
            <div className="relative">
              <select
                value={selectedLane}
                onChange={e => setSelectedLane(e.target.value)}
                className="appearance-none bg-slate-800 border border-slate-600/40 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-cyan-400 cursor-pointer focus:outline-none focus:border-cyan-500/50 transition-all"
              >
                {['1', '2', '3'].map(id => (
                  <option key={id} value={id}>
                    Lane {id} — {LANE_LABELS[id]}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Confidence slider */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-mono">Confidence</span>
              <input
                type="range" min="0.2" max="0.85" step="0.05"
                value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))}
                className="w-20 accent-cyan-400"
              />
              <span className="font-mono font-black text-cyan-400 w-8">
                {Math.round(threshold * 100)}%
              </span>
            </div>

            {/* Camera buttons */}
            <div className="ml-auto flex gap-2">
              {!camActive ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-xl text-sm font-bold hover:bg-cyan-500/25 transition-all active:scale-95"
                >
                  <Camera size={14} /> Enable Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setDetecting(d => !d)}
                    disabled={!modelLoaded}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 disabled:opacity-40 ${
                      detecting
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                        : 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25'
                    }`}
                  >
                    {detecting
                      ? <><Square size={12} fill="currentColor" /> Stop</>
                      : <><Play  size={12} fill="currentColor" /> {modelLoaded ? 'Detect' : 'Loading...'}</>
                    }
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all active:scale-95"
                  >
                    <CameraOff size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Video + Canvas overlay */}
          <div className="relative w-full aspect-video bg-black">

            {/* Empty state */}
            {!camActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-600">
                <Camera size={52} strokeWidth={1} />
                <p className="text-sm font-bold text-slate-500">Click "Enable Camera" to start AI detection</p>
                <p className="text-xs opacity-60">Laptop webcam or mobile phone camera · No extra hardware</p>
              </div>
            )}

            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* Tactical overlays */}
            {camActive && (
              <>
                {/* Top-left: location */}
                <div className="absolute top-3 left-3 z-20">
                  <div className="px-3 py-2 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 space-y-0.5">
                    <div className="text-[8px] font-black text-cyan-400 tracking-[0.2em]">LANE {selectedLane} · {LANE_LABELS[selectedLane].toUpperCase()}</div>
                    <div className="text-[10px] font-bold text-white truncate max-w-[160px]">{state?.junction?.name || 'Active Junction'}</div>
                    <div className="text-[7px] font-mono text-white/30">
                      {state?.junction?.lat}°N · {state?.junction?.lng}°E
                    </div>
                  </div>
                </div>

                {/* Top-right: detection status */}
                <div className="absolute top-3 right-3 z-20">
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[10px] font-black transition-all ${
                    detecting
                      ? 'bg-green-500/20 border-green-500/40 text-green-400'
                      : 'bg-black/70 border-white/10 text-slate-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${detecting ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                    {detecting ? `AI LIVE · ${fps} FPS` : 'PAUSED'}
                  </div>
                </div>

                {/* Bottom-left: Hardware Sensor Sync (Unified) */}
                <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2">
                  <div className={`px-3 py-1.5 backdrop-blur-xl rounded-xl border flex items-center gap-2 text-[9px] font-black tracking-widest transition-all ${
                    lanes[selectedLane]?.priorityTrigger 
                      ? 'bg-red-500/20 border-red-500/40 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' 
                      : 'bg-black/60 border-white/10 text-white/40'
                  }`}>
                    <ShieldCheck size={12} className={lanes[selectedLane]?.priorityTrigger ? 'text-red-400' : 'text-white/20'} />
                    EM-18 RFID: {lanes[selectedLane]?.priorityTrigger ? 'AUTHORIZED PRIORITY' : 'SCANNING...'}
                  </div>
                  
                  <div className={`px-3 py-1.5 backdrop-blur-xl rounded-xl border flex items-center gap-2 text-[9px] font-black tracking-widest transition-all ${
                    lanes[selectedLane]?.density > 0 
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-100' 
                      : 'bg-black/60 border-white/10 text-white/40'
                  }`}>
                    <Cpu size={12} className={lanes[selectedLane]?.density > 0 ? 'text-cyan-400' : 'text-white/20'} />
                    ESP32 PULSE: {lanes[selectedLane]?.density > 0 ? `LEVEL ${Math.ceil(lanes[selectedLane].density / 10)} ACTIVE` : 'IDLE'}
                  </div>

                  {lastSent && (
                    <div className="px-3 py-1.5 bg-black/70 backdrop-blur rounded-xl border border-cyan-500/20 text-[8px] font-mono text-cyan-400/60">
                      ✓ PUSHED TO PCE ENGINE · {new Date(lastSent).toLocaleTimeString('en-IN', { hour12: false })}
                    </div>
                  )}
                </div>

                {/* Bottom-right: frame counter */}
                {detecting && (
                  <div className="absolute bottom-3 right-3 z-20">
                    <div className="px-2 py-1 bg-black/60 rounded-lg border border-white/5 text-[8px] font-mono text-white/30">
                      {totalFrames} frames processed
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Model loading overlay */}
            {modelLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30 backdrop-blur-sm">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-cyan-400 font-black text-sm tracking-widest">LOADING AI MODEL</p>
                  <p className="text-white/30 text-xs">Downloading COCO-SSD (~5 MB) · One time only</p>
                </div>
              </div>
            )}
          </div>

          {/* Error bar */}
          {error && (
            <div className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs font-bold">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* ── Right Panel ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Live PCE Score */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-amber-400" />
              <h3 className="font-bold text-slate-200 text-sm">Live PCE Score — Lane {selectedLane}</h3>
            </div>
            <div className={`text-5xl font-black tabular-nums mb-3 transition-colors ${
              pceScore > 100 ? 'text-red-400' : pceScore > 40 ? 'text-amber-400' : 'text-cyan-400'
            }`}>
              {pceScore}
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: pceScore > 100
                    ? 'linear-gradient(90deg, #ef4444, #ff6b6b)'
                    : pceScore > 40
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #00e5ff, #00ff88)',
                  boxShadow: `0 0 8px ${pceScore > 100 ? '#ef444488' : '#00e5ff88'}`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
              <span>LOW</span><span>MEDIUM</span><span>CRITICAL</span>
            </div>
          </div>

          {/* Detected Vehicle Counts */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={15} className="text-cyan-400" />
              <h3 className="font-bold text-slate-200 text-sm">Detected Vehicles</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { key: 'car',       emoji: '🚗', label: 'Cars',        pce: 1    },
                { key: 'bus',       emoji: '🚌', label: 'Buses',       pce: 15   },
                { key: 'lorry',     emoji: '🚛', label: 'Lorries',     pce: 8    },
                { key: 'bike',      emoji: '🏍️', label: 'Bikes',       pce: 0.5  },
                { key: 'ambulance', emoji: '🚑', label: 'Ambulance',   pce: 500  },
                { key: 'person',    emoji: '🚶', label: 'Pedestrians', pce: '—'  },
              ].map(({ key, emoji, label, pce }) => {
                const n = counts[key] || 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-base w-6">{emoji}</span>
                    <span className="text-slate-400 text-xs flex-1">{label}</span>
                    <span className="text-[9px] text-slate-600 font-mono w-10">×{pce}</span>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(n / 8, 1) * 100}%`,
                          background: V_COLORS[key] || '#64748b',
                        }}
                      />
                    </div>
                    <span className={`text-sm font-black tabular-nums w-5 text-right ${n > 0 ? 'text-white' : 'text-slate-700'}`}>
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emergency Inject */}
          <div className="glass border border-red-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Radio size={14} className="text-red-400" />
              <h3 className="font-bold text-slate-200 text-sm">Emergency Override</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Instantly flag an ambulance on the active lane, triggering priority green regardless of camera detection.
            </p>
            <button
              onClick={injectEmergency}
              className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm font-bold transition-all active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
            >
              🚑 Inject Emergency — Lane {selectedLane}
            </button>
          </div>

          {/* Model Info */}
          <div className="glass border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={13} className="text-purple-400" />
              <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">AI Model Info</h3>
            </div>
            <div className="space-y-1.5 text-[10px] font-mono">
              {[
                ['Model',     'COCO-SSD MobileNet v2'],
                ['Backend',   'TensorFlow.js WebGL'],
                ['Classes',   'car, bus, truck, motorcycle, person'],
                ['Threshold', `${Math.round(threshold * 100)}% confidence`],
                ['Interval',  `Posts every ${POST_INTERVAL / 1000}s to PCE engine`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-300 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: 3 Lane Status Cards ──────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Junction Signal Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['1', '2', '3'].map(id => {
            const l       = lanes[id] || {};
            const sig     = l.signal || 'red';
            const isActive = id === selectedLane;

            return (
              <button
                key={id}
                onClick={() => setSelectedLane(id)}
                className={`glass border rounded-2xl p-5 text-left cursor-pointer transition-all hover:-translate-y-1 duration-300 ${
                  isActive
                    ? 'border-cyan-500/40 shadow-[0_4px_24px_rgba(0,229,255,0.12)]'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Lane {id} — {LANE_LABELS[id]}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${
                    sig === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    sig === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                       'bg-red-500/10   text-red-400   border-red-500/30'
                  }`}>{sig.toUpperCase()}</span>
                </div>
                <div className={`text-3xl font-black tabular-nums ${
                  sig === 'green' ? 'text-green-400' : 'text-cyan-400'
                }`}>{Math.round(l.pceScore || 0)}</div>
                <div className="text-[10px] text-slate-600 font-mono mt-1">
                  PCE · Wait: {l.waitTime || 0}s · Priority: {Math.round(l.finalPriority || 0)}
                </div>
                {isActive && (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] text-cyan-400 font-black">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    CAMERA ACTIVE
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────────
function StatusBadge({ label, color, pulse }) {
  const styles = {
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    cyan:  'bg-cyan-500/10  border-cyan-500/30  text-cyan-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    slate: 'bg-slate-800    border-slate-700/30  text-slate-500',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-wider uppercase ${styles[color] || styles.slate}`}>
      <div className={`w-1.5 h-1.5 rounded-full bg-current ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  );
}
