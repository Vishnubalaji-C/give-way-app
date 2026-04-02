import { useWs } from '../context/WsContext';
import { Camera, Server, Eye, Cpu, Radio, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

const LANES = ['N', 'S', 'E', 'W'];
const LANE_ROLES = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' };
const BBOX_COLORS = { ambulance: '#ff3b3b', bus: '#00e5ff', car: '#00ff88', bike: '#a855f7' };

// Simulate random bounding boxes based on state vehicle counts
function generateFakeBboxes(vehicles) {
  const bboxes = [];
  const types = Object.keys(vehicles);
  types.forEach(type => {
    for (let i = 0; i < vehicles[type]; i++) {
      // Create random bounding box
      bboxes.push({
        type,
        x: 10 + Math.random() * 70, // percentage string %
        y: 20 + Math.random() * 60,
        w: type === 'bus' || type === 'ambulance' ? 18 : type === 'car' ? 12 : 6,
        h: type === 'bus' || type === 'ambulance' ? 25 : type === 'car' ? 16 : 8,
        conf: (0.8 + Math.random() * 0.18).toFixed(2), // 80-98% confidence
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
    <div className="space-y-6">
      
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Camera size={26} className="text-cyan-400" />
          <h2 className="text-2xl font-black text-slate-100">Live Hardware Feed</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/50 bg-slate-800/60 font-mono text-slate-300">
            <Cpu size={14} className="text-amber-400" />
            ESP32-CAM Nodes: 4/4
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 font-mono text-green-400">
            <Radio size={14} className="blink" />
            Receiving WebSockets
          </div>
        </div>
      </div>

      <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
        Real-time edge computation node visualization. ESP32-CAM devices capture lane data, process it via Tiny-YOLO, and stream <span className="text-cyan-400 font-mono">1KB JSON</span> density scores to the central Arduino Mega decision engine.
      </p>

      {/* ── Four Camera Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {LANES.map(id => {
          const l = lanes[id] || {};
          const bboxes = generateFakeBboxes(l.vehicles || {});
          
          return (
            <div key={id} className="glass border border-cyan-500/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col group relative">
              {/* Camera Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700/40">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-600 font-mono text-[10px] font-bold text-slate-300">
                    {id}
                  </span>
                  <span className="font-bold text-slate-200 text-sm">{LANE_ROLES[id]} NODE</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-[10px] font-mono text-slate-500">{time} · 15fps</div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/15 border border-green-500/20 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 blink inline-block" /> REC
                  </div>
                </div>
              </div>

              {/* Feed simulation area */}
              <div className="relative w-full aspect-video bg-[#0b101c] overflow-hidden">
                {/* Simulated noise/grain for camera effect */}
                <div className="absolute inset-0 opacity-10 mix-blend-screen pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
                
                {/* Horizontal scan line */}
                <div className="absolute inset-0 scan-line pointer-events-none z-10"></div>

                {/* Perspective Road SVG (Mock feed background) */}
                <div className="absolute inset-0 opacity-20 pointer-events-none flex items-end justify-center">
                   <div style={{
                     width: '60%', height: '100%',
                     background: 'linear-gradient(to top, #1a2035 0%, transparent 100%)',
                     clipPath: 'polygon(45% 0%, 55% 0%, 85% 100%, 15% 100%)'
                   }}></div>
                   {/* Dotted center lines */}
                   <div className="absolute h-full w-1 border-r-2 border-dashed border-slate-500/40" style={{ transform: 'rotateX(60deg) scale(1, 1.5)' }}></div>
                </div>

                {/* Bounding Boxes overlay */}
                {bboxes.map((box, idx) => (
                  <div key={box.id} className="absolute border-2 detect-box flex flex-col justify-end transition-all duration-300 pointer-events-none"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.w}%`,
                      height: `${box.h}%`,
                      borderColor: BBOX_COLORS[box.type],
                      boxShadow: `0 0 8px ${BBOX_COLORS[box.type]}66 inset, 0 0 8px ${BBOX_COLORS[box.type]}66`
                    }}>
                    <div className="absolute bottom-full left-[-2px] px-1 bg-black/70 border-t-2 border-l-2 border-r-2 backdrop-blur-sm text-[8px] font-mono text-white whitespace-nowrap"
                      style={{ borderColor: BBOX_COLORS[box.type] }}>
                      {box.type.toUpperCase()} {box.conf}
                    </div>
                  </div>
                ))}

                {/* No vehicles overlay */}
                {bboxes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="px-4 py-2 rounded-lg bg-black/40 border border-slate-700/50 backdrop-blur-md text-slate-500 font-mono text-[10px]">
                       NO TARGETS DETECTED
                     </span>
                  </div>
                )}
              </div>

              {/* Edge Data output footer */}
              <div className="bg-slate-900 border-t border-slate-700/40 p-3 grid grid-cols-3 gap-2">
                 <div className="flex flex-col gap-0.5">
                   <span className="text-[9px] text-slate-500 font-mono uppercase">Detected</span>
                   <span className="text-sm font-bold text-slate-200 tabular-nums">{bboxes.length}</span>
                 </div>
                 <div className="flex flex-col gap-0.5 pl-3 border-l border-slate-700/40">
                   <span className="text-[9px] text-slate-500 font-mono uppercase">PCE Score</span>
                   <span className="text-sm font-bold text-cyan-400 tabular-nums">{Math.round(l.pceScore || 0)}</span>
                 </div>
                 <div className="flex flex-col gap-0.5 pl-3 border-l border-slate-700/40 text-right">
                   <span className="text-[9px] text-slate-500 font-mono uppercase">Memory</span>
                   <span className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">1 KB</span>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
