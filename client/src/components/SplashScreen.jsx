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
    <div className={`fixed inset-0 z-[100] bg-[#02050a] flex flex-col items-center justify-center transition-opacity duration-500 ${stage === 4 ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* Premium Logo Container */}
      <div className={`relative mb-10 transition-all duration-1000 transform ${stage >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-slate-900 border border-cyan-500/20 shadow-[0_0_50px_rgba(0,229,255,0.2)] overflow-hidden p-1">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="GiveWay Logo" className="w-full h-full object-cover rounded-[2.3rem]" />
        </div>
        <div className="absolute -inset-4 bg-cyan-500/10 blur-2xl -z-10 animate-pulse"></div>
      </div>

      {/* Brand Text */}
      <div className={`text-center transition-all duration-1000 delay-300 transform ${stage >= 2 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}`}>
        <h1 className="text-5xl md:text-7xl font-black mb-3 tracking-tighter">
          GIVE<span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">WAY</span>
        </h1>
        <p className="text-cyan-400/60 font-mono tracking-[0.3em] text-[10px] md:text-xs uppercase">Adaptive Traffic Equity System</p>
        
        {/* Loading Indicator */}
        <div className="mt-12 flex justify-center gap-3">
          {[0, 150, 300].map((delay) => (
            <div 
              key={delay}
              className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(0,229,255,0.8)]" 
              style={{ 
                animation: `bounce 1.2s infinite ease-in-out`,
                animationDelay: `${delay}ms` 
              }} 
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
