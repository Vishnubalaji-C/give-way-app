import { Layers, Shield, Zap, Sun, Users, Activity } from 'lucide-react';

export default function FeaturesPage() {
  const specs = [
    {
      icon: <Zap size={28} className="text-amber-400" />,
      title: "Antigravity Weights Engine",
      desc: "Calculates live PCE densities instantly. Ambulances are assigned 999 weights forcing immediate triggers, while wait-times act as exponential multipliers to guarantee fairness caps.",
      color: "from-amber-500/20 to-transparent",
      border: "border-amber-500/30"
    },
    {
      icon: <Layers size={28} className="text-emerald-400" />,
      title: "Stall / Breakdown Detection",
      desc: "Identifies anomalies via stationary density. If vehicles are detected trapped in the start-zone for consecutively static Green phases, the server flags an accident.",
      color: "from-emerald-500/20 to-transparent",
      border: "border-emerald-500/30"
    },
    {
      icon: <Sun size={28} className="text-cyan-400" />,
      title: "Solar-Ready Eco Mode",
      desc: "An integrated Arduino LDR monitors ambient light limits. At night, it automatically strips the ESP32 to Grayscale Low-Res, slashing system battery drain by 30%.",
      color: "from-cyan-500/20 to-transparent",
      border: "border-cyan-500/30"
    },
    {
      icon: <Users size={28} className="text-pink-400" />,
      title: "Pedestrian Extra-Time Engine",
      desc: "Prioritizes vulnerability. If human presence is persistently tracked across zebra crossings as timers fall to zero, the edge node blocks transitions by a flat 5 seconds.",
      color: "from-pink-500/20 to-transparent",
      border: "border-pink-500/30"
    },

    {
      icon: <Shield size={28} className="text-blue-400" />,
      title: "Secure Node Authorization",
      desc: "Protects city infra using unique JWT Tokens and non-passkey IDs. Reconnects are valid for 7 Days via isolated LocalStorage caching before hard terminating access.",
      color: "from-blue-500/20 to-transparent",
      border: "border-blue-500/30"
    }
  ];

  return (
    <div className="space-y-8 pb-24">
      <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
        <h1 className="text-4xl sm:text-5xl font-black text-white">Special Features</h1>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          The Antigravity Engine framework provides a robust suite of adaptive features prioritizing civilian lives and resource intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specs.map((s, idx) => (
          <div key={idx} className={`glass p-8 rounded-3xl border bg-gradient-to-b ${s.color} ${s.border} hover:-translate-y-2 transition-transform duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}>
             <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center mb-6 shadow-inner border border-white/5">
                {s.icon}
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{s.title}</h3>
             <p className="text-slate-400 text-sm leading-loose">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
