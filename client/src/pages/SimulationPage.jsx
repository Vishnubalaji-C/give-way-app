import { useWs } from '../context/WsContext';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const LANES = ['N', 'S', 'E', 'W'];
const LANE_LABELS = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' };
const LANE_COLORS = { N: '#00e5ff', S: '#00ff88', E: '#a855f7', W: '#ffb700' };
const VEHICLE_EMOJIS = { ambulance: '🚑', bus: '🚌', car: '🚗', bike: '🏍️' };

export default function SimulationPage() {
  const { state, alerts, send } = useWs();
  const [running, setRunning] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [alerts]);

  const handleStart = () => { send('START_SIM'); setRunning(true); };
  const handlePause = () => { send('STOP_SIM'); setRunning(false); };
  const handleReset = () => { send('RESET_SIM'); setRunning(false); };

  const inject = (laneId, vehicleType) => send('INJECT_VEHICLE', { laneId, vehicleType });
  const toggleMode = (mode, val) => send('SET_MODE', { mode, value: val });

  const lanes = state?.lanes || {};

  return (
    <div className="space-y-6">

      {/* ── Top Control Bar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-black text-slate-100 mr-2">Live Junction Connection</h2>
        <div className={`px-3 py-1 rounded-full text-xs font-mono border bg-green-500/10 text-green-400 border-green-500/30`}>
          ● HARDWARE LIVE
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-semibold">
            <RotateCcw size={14} /> Reset State
          </button>
        </div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">

        {/* ── Junction Visualizer ───────────────────────────── */}
        <div className="glass border border-cyan-500/10 rounded-2xl p-6">
          <div className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-4">{state?.junction?.name || 'Junction'} · {state?.junction?.id || '---'} · PCE-Weighted Signal</div>
          <div className="relative w-full max-w-[480px] mx-auto aspect-square">
            {/* Road SVG */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 480">
              {/* Road base */}
              <rect x="200" y="0"   width="80" height="480" fill="#1a2035"/>
              <rect x="0"   y="200" width="480" height="80" fill="#1a2035"/>
              {/* Center box */}
              <rect x="200" y="200" width="80" height="80" fill="#1e2d47"/>
              {/* Lane dashes vertical */}
              {[60,100,140,300,340,380].map(y => (
                <rect key={y} x="237" y={y} width="6" height="20" fill="#475569" rx="2"/>
              ))}
              {/* Lane dashes horizontal */}
              {[60,100,140,300,340,380].map(x => (
                <rect key={x} x={x} y="237" width="20" height="6" fill="#475569" rx="2"/>
              ))}
              {/* Direction arrows */}
              <text x="240" y="185" fill="#334155" fontSize="14" textAnchor="middle">↑</text>
              <text x="240" y="305" fill="#334155" fontSize="14" textAnchor="middle">↓</text>
              <text x="185" y="244" fill="#334155" fontSize="14" textAnchor="middle">←</text>
              <text x="305" y="244" fill="#334155" fontSize="14" textAnchor="middle">→</text>
            </svg>

            {/* Signal Poles */}
            {LANES.map(id => (
              <SignalPole key={id} id={id} laneData={lanes[id]} isActive={state?.activeLane === id} />
            ))}

            {/* Active lane glow */}
            {state?.activeLane && (
              <div className={`absolute inset-0 pointer-events-none rounded-xl transition-all duration-500`}
                style={{
                  background: `radial-gradient(ellipse at center, ${LANE_COLORS[state.activeLane]}08 0%, transparent 70%)`,
                }}
              />
            )}
          </div>

          {/* Lane count strips */}
          <div className="mt-6 grid grid-cols-4 gap-2">
            {LANES.map(id => {
              const l = lanes[id] || {};
              const isGreen = l.signal === 'green';
              return (
                <div key={id}
                  className={`rounded-xl p-3 border text-center transition-all duration-500 ${
                    isGreen
                      ? 'bg-green-500/10 border-green-500/30 shadow shadow-green-500/20'
                      : 'bg-slate-900/60 border-slate-700/30'
                  }`}>
                  <div className={`text-xs font-mono font-bold mb-2 ${isGreen ? 'text-green-400' : 'text-slate-500'}`}>
                    {LANE_LABELS[id]}
                  </div>
                  {Object.entries(VEHICLE_EMOJIS).map(([type, emoji]) => (
                    <div key={type} className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>{emoji}</span>
                      <span className="tabular-nums font-mono">{l.vehicles?.[type] ?? 0}</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-slate-700/40">
                    <div className="text-xs font-bold text-cyan-300 tabular-nums">
                      PCE: {Math.round(l.pceScore ?? 0)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Wait: <span className={l.waitTime > 90 ? 'text-red-400' : 'text-slate-400'}>{l.waitTime ?? 0}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────── */}
        <div className="space-y-4">

          {/* Priority Bars */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📡</span>
              <h3 className="font-bold text-slate-200 text-sm">Final Priority Scores</h3>
            </div>
            <div className="space-y-3">
              {LANES.map(id => {
                const l = lanes[id] || {};
                const max = Math.max(...LANES.map(d => lanes[d]?.finalPriority ?? 0), 1);
                const pct = ((l.finalPriority ?? 0) / max) * 100;
                const isActive = state?.activeLane === id;
                return (
                  <div key={id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-semibold ${isActive ? 'text-green-400' : 'text-slate-400'}`}>
                        {LANE_LABELS[id]} {isActive ? '● GREEN' : ''}
                      </span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {Math.round(l.finalPriority ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: isActive
                            ? 'linear-gradient(90deg, #00ff88, #00e5ff)'
                            : `linear-gradient(90deg, ${LANE_COLORS[id]}88, ${LANE_COLORS[id]})`,
                          boxShadow: isActive ? '0 0 8px #00ff8866' : 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WTP Gauges */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">⏱️</span>
              <h3 className="font-bold text-slate-200 text-sm">Wait-Time Penalty (WTP)</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {LANES.map(id => {
                const l = lanes[id] || {};
                const wait = l.waitTime ?? 0;
                const pct = Math.min(wait / 120, 1);
                const color = wait >= 90 ? '#ff3b3b' : wait >= 60 ? '#ffb700' : '#00e5ff';
                const status = wait >= 120 ? 'CAP HIT' : wait >= 90 ? 'CRITICAL' : wait >= 60 ? 'WARNING' : 'OK';
                return (
                  <div key={id} className="text-center">
                    <div className="text-[10px] text-slate-500 font-mono mb-1">{LANE_LABELS[id]}</div>
                    <div className="relative inline-flex">
                      <svg viewBox="0 0 80 44" className="w-20 h-11">
                        <path d="M6 40 A34 34 0 0 1 74 40" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <path d="M6 40 A34 34 0 0 1 74 40" fill="none" stroke={color}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray="107" strokeDashoffset={107 - pct * 107}
                          style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'all 0.6s ease' }}
                        />
                      </svg>
                    </div>
                    <div className="text-sm font-black tabular-nums" style={{ color }}>{wait}s</div>
                    <div className={`text-[9px] font-mono mt-0.5 ${
                      wait >= 90 ? 'text-red-400' : wait >= 60 ? 'text-amber-400' : 'text-slate-500'
                    }`}>{status}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inject Controls */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🎛️</span>
              <h3 className="font-bold text-slate-200 text-sm">Inject Vehicle</h3>
            </div>
            <div className="space-y-2">
              {LANES.map(id => (
                <div key={id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono w-8">{id}</span>
                  {Object.entries(VEHICLE_EMOJIS).map(([type, emoji]) => (
                    <button key={type} onClick={() => inject(id, type)}
                      title={`Inject ${type} on Lane ${LANE_LABELS[id]}`}
                      className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/30 hover:border-cyan-500/30 transition-all text-base hover:scale-110 active:scale-95">
                      {emoji}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Mode Toggles */}
          <div className="glass border border-cyan-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🌐</span>
              <h3 className="font-bold text-slate-200 text-sm">Simulation Modes</h3>
            </div>
            <div className="space-y-3">
              {[
                { key: 'rain',  label: '🌧️ Rain Mode',       desc: '+2s yellow time' },
                { key: 'night', label: '🌙 Night Mode',       desc: 'Sparse traffic after 11 PM' },
              ].map(m => {
                const active = state?.mode?.[m.key] ?? false;
                return (
                  <div key={m.key} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-300">{m.label}</div>
                      <div className="text-[11px] text-slate-600">{m.desc}</div>
                    </div>
                    <button onClick={() => toggleMode(m.key, !active)}
                      className={`relative w-12 h-6 rounded-full border transition-all duration-300 ${
                        active ? 'bg-green-500/30 border-green-500/50' : 'bg-slate-800 border-slate-600/40'
                      }`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ${
                        active ? 'left-[calc(100%-22px)] bg-green-400' : 'left-0.5 bg-slate-500'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Event Log ───────────────────────────────────────── */}
      <div className="glass border border-cyan-500/10 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span>📋</span>
          <h3 className="font-bold text-slate-200">System Event Log</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-mono ml-auto">● LIVE</span>
        </div>
        <div ref={logRef} className="log-scroll space-y-1.5">
          {alerts.length === 0 && (
            <div className="text-xs text-slate-600 font-mono py-2">System initialized. Awaiting start command...</div>
          )}
          {alerts.map(a => (
            <AlertEntry key={a.id} alert={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalPole({ id, laneData, isActive }) {
  const signal = laneData?.signal ?? 'red';
  const timer  = laneData?.greenTimer ?? 0;

  const posMap = {
    N: { top: '2%',  left: '50%', transform: 'translateX(-50%)' },
    S: { bottom: '2%', left: '50%', transform: 'translateX(-50%)' },
    E: { right: '2%', top: '50%', transform: 'translateY(-50%)' },
    W: { left: '2%',  top: '50%', transform: 'translateY(-50%)' },
  };

  const lights = [
    { state: 'red',    color: '#ff3b3b', off: '#3d0a0a', label: 'R' },
    { state: 'yellow', color: '#ffb700', off: '#3d2a0a', label: 'Y' },
    { state: 'green',  color: '#00ff88', off: '#0a3d15', label: 'G' },
  ];

  return (
    <div className="absolute z-10 transition-all duration-300" style={posMap[id]}>
      <div className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-500 ${
        isActive
          ? 'bg-slate-900/90 border-green-500/40 shadow shadow-green-500/30'
          : 'bg-slate-900/80 border-slate-700/30'
      }`}>
        <div className="text-[9px] text-slate-500 font-mono">{id}</div>
        {lights.map(lt => {
          const active = signal === lt.state;
          return (
            <div key={lt.label}
              className="w-5 h-5 rounded-full border-2 transition-all duration-400"
              style={{
                background: active ? lt.color : lt.off,
                borderColor: active ? lt.color : lt.off,
                boxShadow: active ? `0 0 10px ${lt.color}, 0 0 20px ${lt.color}55` : 'none',
              }}
            />
          );
        })}
        {signal === 'green' && timer > 0 && (
          <div className="text-[9px] text-green-400 font-mono tabular-nums mt-0.5">{timer}s</div>
        )}
      </div>
    </div>
  );
}

const ALERT_STYLES = {
  emergency: 'border-red-500/30 bg-red-500/5 text-red-300',
  warning:   'border-amber-500/30 bg-amber-500/5 text-amber-300',
  ghost:     'border-purple-500/30 bg-purple-500/5 text-purple-300',
  info:      'border-cyan-500/20 bg-cyan-500/5 text-cyan-300',
};

function AlertEntry({ alert }) {
  const cls = ALERT_STYLES[alert.type] ?? ALERT_STYLES.info;
  const ts = new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false });
  return (
    <div className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-xs ${cls} transition-all`}>
      <span className="font-mono text-slate-600 tabular-nums min-w-max">{ts}</span>
      <span className="leading-relaxed">{alert.message}</span>
    </div>
  );
}
