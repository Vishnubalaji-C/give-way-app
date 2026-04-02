import { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500);  // light 1
    const t2 = setTimeout(() => setStage(2), 1200); // light 2
    const t3 = setTimeout(() => setStage(3), 1900); // light 3 + glow
    const t4 = setTimeout(() => setStage(4), 3000); // fade out
    const t5 = setTimeout(() => onComplete(), 3500); // unmount

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-[#050a14] flex flex-col items-center justify-center transition-opacity duration-500 ${stage === 4 ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* Animated Traffic Light Logo */}
      <div className="relative w-24 h-56 bg-gradient-to-b from-slate-800 to-slate-900 border-4 border-slate-700 rounded-3xl p-4 flex flex-col justify-between items-center shadow-2xl mb-8">
        {/* Red */}
        <div className={`w-14 h-14 rounded-full border-2 transition-all duration-500 ${
          stage >= 1 ? 'bg-red-500 border-red-400 shadow-[0_0_30px_rgba(255,59,59,0.8)]' : 'bg-slate-700 border-slate-600'
        }`} />
        {/* Yellow */}
        <div className={`w-14 h-14 rounded-full border-2 transition-all duration-500 ${
          stage >= 2 ? 'bg-amber-400 border-amber-300 shadow-[0_0_30px_rgba(255,183,0,0.8)]' : 'bg-slate-700 border-slate-600'
        }`} />
        {/* Green */}
        <div className={`w-14 h-14 rounded-full border-2 transition-all duration-500 ${
          stage >= 3 ? 'bg-green-400 border-green-300 shadow-[0_0_40px_rgba(0,255,136,1)]' : 'bg-slate-700 border-slate-600'
        }`} />
      </div>

      {/* Brand Text */}
      <div className={`text-center transition-all duration-700 transform ${stage >= 3 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}`}>
        <h1 className="text-5xl font-black mb-2">
          Give<span className="brand-gradient">Way</span>
        </h1>
        <p className="text-slate-400 font-mono tracking-widest text-sm uppercase">Adaptive Traffic Equity System</p>
        <div className="mt-8 flex justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
