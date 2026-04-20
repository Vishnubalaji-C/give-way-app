import { useState } from 'react';
import { useWs } from '../context/WsContext';
import { Shield, Zap, Radio, Book } from 'lucide-react';
import TacticalMap from '../components/TacticalMap';

const LANES = ['1', '2', '3'];
const LANE_LABELS = { '1': 'Primary', '2': 'Secondary', '3': 'Transverse' };

export default function ControlRoomPage({ user }) {
  const { state, alerts, auditLog, send } = useWs();
  const [activeMode, setActiveMode] = useState('auto');
  const [ghostLane, setGhostLane] = useState(null);
  const [waveActive, setWaveActive] = useState(false);
  const [waveProgress, setWaveProgress] = useState(0);

  const forceGreen = (id) => { send('FORCE_GREEN', { laneId: id }); };
  const forceRed   = (id) => { send('FORCE_RED',   { laneId: id }); };

  const switchMode = (mode) => {
    setActiveMode(mode);
    send('SET_OVERRIDE_MODE', { mode });
  };

  const triggerGhost = () => {
    const lane = LANES[Math.floor(Math.random() * 4)];
    setGhostLane(lane);
    setTimeout(() => setGhostLane(null), 6000);
  };

  const triggerGreenWave = () => {
    send('TRIGGER_GREEN_WAVE');
    setWaveActive(true);
    setWaveProgress(0);
    let p = 0;
    const id = setInterval(() => {
      p += 2;
      setWaveProgress(p);
      if (p >= 100) { clearInterval(id); setWaveActive(false); }
    }, 80);
  };

  const lanes = state?.lanes ?? {};

  const OVERRIDE_MODES = [
    { id: 'auto',      label: '🤖 GiveWay AI',    desc: 'Full autonomous adaptive traffic control' },
    { id: 'vip',       label: '👑 VIP Corridor',    desc: 'Priority escort mode' },
    { id: 'festival',  label: '🎉 Festival Mode',   desc: 'Balanced load sharing' },
    { id: 'emergency', label: '🚨 All-Stop',         desc: 'Emergency halt all lanes' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Shield size={22} className="text-cyan-400" />
        <div className="mr-auto">
          <h2 className="text-2xl font-black text-slate-100">Police Control Room</h2>
          <div className="text-[10px] font-black text-cyan-400 tracking-[0.2em] uppercase">GiveWay Matrix v2.6</div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2">
            <span>📍 {state?.junction?.name || 'Junction'}</span>
            <span className="text-slate-700">|</span>
            <span>{state?.junction?.zone || ''}</span>
            <span className="text-slate-700">|</span>
            <span className="text-cyan-400/60">{state?.junction?.id || ''}</span>
          </div>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 font-mono">✅ BIOMETRIC: {user?.name?.toUpperCase() || 'OFFICER'} {user?.id}</span>
      </div>

      {/* ── Tactical Live Map Integration ──────────────────── */}
      <div className="h-72 w-full rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl relative mb-6">
         <TacticalMap user={user} showControls={false} />
         <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
            <div className="glass px-4 py-2 rounded-xl border border-cyan-500/30 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
               <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Live Tactical Grid</span>
            </div>
         </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Manual Override ─────────────────────────────────── */}
        <div className="glass border border-cyan-500/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
             <CardTitle icon={<Zap size={16} className="text-yellow-400"/>} title="Manual Lane Override" />
             <div className="text-[10px] text-red-400 font-mono font-bold border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded">30s PRIORITY GREEN</div>
          </div>
          <p className="text-xs text-slate-400 mb-4">Real-time monitoring of all GiveWay ATES nodes.</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {LANES.map(id => {
              const l = lanes[id] ?? {};
              const sig = l.signal ?? 'red';
              return (
                <div key={id} className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-200 text-sm">{LANE_LABELS[id]}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                      sig === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                      sig === 'yellow'? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                        'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>{sig.toUpperCase()}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mb-3">
                    PCE: {Math.round(l.pceScore??0)} · Wait: {l.waitTime??0}s
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => forceGreen(id)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-all active:scale-95">
                      🟢 Green
                    </button>
                    <button onClick={() => forceRed(id)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all active:scale-95">
                      🔴 Red
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* System Mode Selector */}
          <div className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-3">System Mode</div>
          <div className="grid grid-cols-2 gap-2">
            {OVERRIDE_MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)}
                className={`text-left p-3 rounded-xl border transition-all text-sm ${
                  activeMode === m.id
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-700/30 text-slate-400 hover:border-slate-600/50'
                }`}>
                <div className="font-semibold">{m.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Alerts + Ghost Detection ─────────────────────────── */}
        <div className="space-y-4">
          <div className="glass border border-cyan-500/10 rounded-2xl p-6">
            <CardTitle icon={<Radio size={16} className="text-red-400"/>} title="Active Alerts" />
            <div className="log-scroll space-y-2">
              {alerts.slice(0, 8).map(a => (
                <AlertRow key={a.id} alert={a} />
              ))}
              {alerts.length === 0 && (
                <div className="text-xs text-slate-600 font-mono py-2">No alerts. System nominal.</div>
              )}
            </div>
          </div>

          {/* Ghost Lane Monitor */}
          <div className="glass border border-purple-500/10 rounded-2xl p-6">
            <CardTitle icon="👻" title="Ghost Lane Monitor" />
            <div className="grid grid-cols-2 gap-2 mb-4">
              {LANES.map(id => {
                const isGhost = ghostLane === id;
                return (
                  <div key={id} className={`p-3 rounded-xl border text-sm transition-all duration-500 ${
                    isGhost
                      ? 'border-purple-500/50 bg-purple-500/10 animate-pulse'
                      : 'border-slate-700/30 bg-slate-900/60'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">{LANE_LABELS[id]}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                        isGhost
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-green-500/10 text-green-500 border-green-500/20'
                      }`}>
                        {isGhost ? '⚠ GHOST' : '✓ OK'}
                      </span>
                    </div>
                    {isGhost && (
                      <div className="text-[10px] text-purple-400 mt-1">
                        High density + no movement detected!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={triggerGhost}
              className="w-full py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 text-sm font-semibold transition-all">
              ⚠️ Simulate Ghost Lane
            </button>
          </div>
        </div>
      </div>

      {/* ── Green Wave Network ───────────────────────────────── */}
      <div className="glass border border-cyan-500/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <CardTitle icon="🌊" title="Green-Wave Network" />
          <button onClick={triggerGreenWave} disabled={waveActive}
            className="px-4 py-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-50 text-sm font-semibold transition-all">
            {waveActive ? `Propagating... ${waveProgress}%` : '🌊 Trigger Green Wave'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          {['A', 'B', 'C'].map((j, i) => (
            <div key={j} className="flex items-center gap-4 flex-1">
              <div className={`flex-none text-center p-4 rounded-2xl border transition-all duration-500 ${
                waveProgress >= i * 50
                  ? 'border-green-500/40 bg-green-500/10 shadow shadow-green-500/20'
                  : 'border-slate-700/30 bg-slate-900/60'
              }`} style={{ minWidth: 100 }}>
                <div className={`text-xs font-mono font-bold mb-1 ${waveProgress >= i*50 ? 'text-green-400' : 'text-slate-500'}`}>
                  JUNCTION {j}
                </div>
                <div className={`text-xs ${waveProgress >= i*50 ? 'text-green-300' : 'text-slate-600'}`}>
                  {waveProgress >= i * 50 ? '🟢 GREEN READY' : '⏸ STANDBY'}
                </div>
              </div>
              {i < 2 && (
                <div className="flex-1 relative h-2 bg-slate-800 rounded-full overflow-hidden mx-2">
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, (waveProgress - i * 50) * 2))}%`,
                      background: 'linear-gradient(90deg, #00ff88, #00e5ff)',
                      boxShadow: '0 0 8px #00ff8866',
                    }}
                  />
                  <div className="absolute top-0 text-[9px] text-slate-600 -mt-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {i === 0 ? '1 km' : '1.2 km'}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Audit Log ────────────────────────────────────────── */}
      <div className="glass border border-cyan-500/10 rounded-2xl p-6">
        <CardTitle icon={<Book size={16} className="text-slate-400"/>} title="Audit Log — Officer Actions" />
        <div className="log-scroll space-y-1.5">
          {auditLog.length === 0 && (
            <div className="text-xs text-slate-600 font-mono py-2">No manual actions logged yet.</div>
          )}
          {auditLog.map(e => (
            <div key={e.id} className="flex gap-3 text-xs px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-800/40">
              <span className="font-mono text-slate-600 tabular-nums min-w-max">
                {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
              </span>
              <p className="text-slate-400 text-sm mt-2">Connecting to GiveWay Matrix...</p>
              <span className="text-amber-400 font-mono min-w-max">{e.action}</span>
              <span className="text-slate-400">{e.details}</span>
            </div>
          ))}
        </div>
        <button className="mt-3 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors"
          onClick={() => send('GET_AUDIT')}>
          ↻ Refresh Audit Log
        </button>
      </div>
    </div>
  );
}

const ALERT_STYLES = {
  emergency: 'border-red-500/30 bg-red-500/5 text-red-300',
  warning:   'border-amber-500/30 bg-amber-500/5 text-amber-200',
  ghost:     'border-purple-500/30 bg-purple-500/5 text-purple-300',
  info:      'border-cyan-500/20 bg-cyan-500/5 text-cyan-300',
};

function AlertRow({ alert }) {
  const cls = ALERT_STYLES[alert.type] ?? ALERT_STYLES.info;
  const ts = new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false });
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${cls}`}>
      <span className="font-mono text-slate-600 tabular-nums min-w-max">{ts}</span>
      <span className="leading-relaxed">{alert.message}</span>
    </div>
  );
}

function CardTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{icon}</span>
      <h3 className="font-bold text-slate-200 text-sm">{title}</h3>
    </div>
  );
}
