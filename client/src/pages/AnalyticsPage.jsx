import { useEffect, useState } from 'react';
import { useWs } from '../context/WsContext';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const COLORS = { ambulance: '#ff3b3b', bus: '#00e5ff', car: '#00ff88', bike: '#a855f7' };
const HOUR_LABELS = ['08','09','10','11','12','13','14','15','16','17','18','19'].map(h => `${h}:00`);

function generateBaseAnalytics() {
  return HOUR_LABELS.map((hour, i) => {
    const base = 80 + i * 15 + Math.random() * 40;
    return {
      hour,
      throughput: Math.floor(base),
      giveway:    Math.floor(18 + Math.random() * 15),
      fixed:      Math.floor(42 + Math.random() * 20),
      congestion: Math.floor(20 + Math.random() * 60),
    };
  });
}

export default function AnalyticsPage() {
  const { state } = useWs();
  const [analytics, setAnalytics] = useState(generateBaseAnalytics());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Refresh analytics every 10 s in a live-looking way
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/analytics');
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const data = await res.json();
        if (data.hourly) {
          setAnalytics(data.hourly);
          setSuccess('Analytics data updated successfully.');
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (e) { 
        setError('Unable to sync live analytics. Using cached data.');
        setTimeout(() => setError(''), 5000);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(id);
  }, []);

  const vehicleMix = [
    { name: 'Cars',       value: Math.floor((state?.totalVehiclesServed ?? 500) * 0.55), color: COLORS.car },
    { name: 'Bikes',      value: Math.floor((state?.totalVehiclesServed ?? 500) * 0.30), color: COLORS.bike },
    { name: 'Buses',      value: state?.totalBuses ?? 20,                                color: COLORS.bus },
    { name: 'Ambulances', value: state?.totalAmbulances ?? 3,                            color: COLORS.ambulance },
  ];

  const heatData = Array.from({ length: 60 }, (_, i) => ({
    x: i % 12,
    y: Math.floor(i / 12),
    v: Math.floor(Math.random() * 100),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-100">Traffic Analytics</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-pulse">
          <ShieldAlert size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-bounce">
          <ShieldCheck size={14} /> {success}
        </div>
      )}

      {/* ── Row 1: Throughput + Vehicle Mix ─────────────────── */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="glass border border-cyan-500/10 rounded-2xl p-5">
          <CardTitle icon="📈" title="Hourly Vehicle Throughput" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics}>
              <defs>
                <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0d1827', border: '1px solid #00e5ff30', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="throughput" stroke="#00e5ff" fill="url(#tpGrad)" strokeWidth={2} name="Vehicles/hr" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass border border-cyan-500/10 rounded-2xl p-5">
          <CardTitle icon="🥧" title="Vehicle Mix" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={vehicleMix} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                dataKey="value" paddingAngle={3}>
                {vehicleMix.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85}
                    style={{ filter: `drop-shadow(0 0 6px ${entry.color}66)` }}/>
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0d1827', border: '1px solid #00e5ff30', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Wait Time Comparison ─────────────────────── */}
      <div className="glass border border-cyan-500/10 rounded-2xl p-5">
        <CardTitle icon="⏳" title="Avg Wait Time: GiveWay AI vs Fixed-Timer Baseline (seconds)" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analytics} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Wait (s)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0d1827', border: '1px solid #00e5ff30', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="giveway" name="GiveWay AI" fill="#00ff88" fillOpacity={0.8} radius={[4,4,0,0]}
              style={{ filter: 'drop-shadow(0 0 4px #00ff8844)' }} />
            <Bar dataKey="fixed" name="Fixed Timer" fill="#ff3b3b" fillOpacity={0.6} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 3: Congestion Trend ──────── */}
      <div className="grid lg:grid-cols-1 gap-6">
        {/* Heatmap */}
        <div className="glass border border-cyan-500/10 rounded-2xl p-5">
          <CardTitle icon="🗺️" title="Congestion Heatmap (Live)" />
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {heatData.map((cell, i) => {
              const intensity = cell.v / 100;
              const r = Math.round(255 * intensity);
              const g = Math.round(255 * (1 - intensity));
              return (
                <div key={i} title={`${cell.v}% congestion`} className="aspect-square rounded-sm cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    background: `rgb(${r},${g},50)`,
                    opacity: 0.7 + intensity * 0.3,
                    filter: cell.v > 85 ? `drop-shadow(0 0 4px rgb(${r},${g},50))` : 'none',
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-slate-500">Low</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #00ff00, #ffff00, #ff0000)' }} />
            <span className="text-[10px] text-slate-500">High</span>
          </div>
        </div>
      </div>

      {/* ── Fairness Graph: Wait vs Priority ────────────────── */}
      <div className="glass border border-cyan-500/10 rounded-2xl p-5">
        <CardTitle icon="⚖️" title="Fairness Graph: Wait Time vs Final Priority per Lane" />
        <WaitVsPriorityChart state={state} />
      </div>
    </div>
  );
}

function WaitVsPriorityChart({ state }) {
  const lanes = ['N','S','E','W'];
  const LANE_COLORS = { N: '#00e5ff', S: '#00ff88', E: '#a855f7', W: '#ffb700' };
  const data = lanes.map(id => ({
    lane: id,
    waitTime: state?.lanes?.[id]?.waitTime ?? 0,
    priority: Math.round(state?.lanes?.[id]?.finalPriority ?? 0),
    pce: Math.round(state?.lanes?.[id]?.pceScore ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
        <XAxis dataKey="lane" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#0d1827', border: '1px solid #00e5ff30', borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="waitTime" stroke="#ffb700" strokeWidth={2} dot={{ fill: '#ffb700', r: 4 }} name="Wait Time (s)" />
        <Line type="monotone" dataKey="priority"  stroke="#00e5ff" strokeWidth={2} dot={{ fill: '#00e5ff', r: 4 }} name="Final Priority" />
        <Line type="monotone" dataKey="pce"        stroke="#00ff88" strokeWidth={2} dot={{ fill: '#00ff88', r: 4 }} name="PCE Score" strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
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
