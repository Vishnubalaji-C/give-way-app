import { useWs } from '../context/WsContext';
import { Fingerprint, Zap, ShieldCheck, Target, Monitor, Download, Play, RefreshCcw } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function TrainingPage() {
  const { state } = useWs();
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([
     { id: 1, type: 'Ambulance', conf: 0.99, pce: 999, status: 'Verified' },
     { id: 2, type: 'Public Bus', conf: 0.94, pce: 20, status: 'Verified' },
     { id: 3, type: 'Private Car', conf: 0.88, pce: 1, status: 'Verified' },
     { id: 4, type: 'Two Wheeler', conf: 0.82, pce: 0.5, status: 'Verified' },
  ]);

  const simulateTraining = () => {
    setIsTraining(true);
    setProgress(0);
  };

  useEffect(() => {
    if (isTraining && progress < 100) {
      const id = setTimeout(() => setProgress(p => p + 2), 50);
      return () => clearTimeout(id);
    } else if (progress >= 100) {
      setIsTraining(false);
    }
  }, [isTraining, progress]);

  return (
    <div className="space-y-8 pb-32">
       {/* ── Training Header ───────────────────────────────── */}
       <div className="glass p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-900/30 via-transparent to-transparent">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <Target size={28} />
             </div>
             <div className="flex-1">
                <h1 className="text-3xl font-black text-white tracking-tight leading-none">Vehicle Edge Vision Trainer</h1>
                <p className="text-slate-400 text-sm mt-1 max-w-xl">
                   Calibrate the ESP32-CAM "Tiny-YOLO" engine. Force training weights for local Indian road conditions (Auto-rickshaws, Buses, Ambulances).
                </p>
             </div>
             <div className="flex flex-col items-end">
                <div className="text-[10px] font-black text-amber-400 opacity-60 uppercase mb-1">AI CORE v4.11</div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-white/5 text-[9px] font-bold text-slate-300">
                   <Fingerprint size={12} className="text-amber-500" /> PCE Weights Verified
                </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Active Training Simulator ────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
             <div className="glass p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                {/* Simulated Camera Feed Viewport */}
                <div className="aspect-video bg-black rounded-2xl border border-slate-800 relative flex items-center justify-center group overflow-hidden">
                   <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center backdrop-blur-sm">
                      <button onClick={simulateTraining} className="p-4 rounded-full bg-white text-black hover:scale-110 transition-all font-bold flex items-center gap-2 text-xs">
                         <Play size={16} fill="black" /> RE-TRAIN WEIGHTS
                      </button>
                   </div>
                   
                   <div className="text-center p-8 space-y-4">
                      <Monitor size={48} className="text-slate-700 mx-auto" />
                      <p className="text-slate-500 font-mono text-xs uppercase tracking-tighter">WAITING FOR RE-TRAIN COMMAND... <br/> [CURRENT WEIGHTS LOADED FROM LOCAL FLASH]</p>
                   </div>

                   {/* Scanning Overlay */}
                   {isTraining && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-amber-400 shadow-[0_0_20px_#f59e0b] animate-[scan_2s_ease-in-out_infinite] z-20"></div>
                   )}
                   
                   {/* Detection Bounding Boxes (Static Simulation) */}
                   {!isTraining && (
                      <>
                        <div className="absolute top-1/4 left-1/4 w-[120px] h-[80px] border-2 border-cyan-400 rounded-sm z-10 flex flex-col justify-start">
                           <span className="bg-cyan-400 text-black text-[8px] font-black px-1 py-0.5 self-start uppercase">BUS: 94% CONF</span>
                        </div>
                        <div className="absolute bottom-1/4 right-1/3 w-[60px] h-[40px] border-2 border-red-500 rounded-sm z-10 flex flex-col justify-end">
                           <span className="bg-red-500 text-white text-[8px] font-black px-1 py-0.5 self-end uppercase">AMBULANCE: 99% CONF</span>
                        </div>
                      </>
                   )}
                </div>

                {isTraining && (
                   <div className="mt-8 space-y-4 animate-pulse">
                      <div className="flex justify-between items-center text-xs font-bold text-amber-400 uppercase tracking-widest">
                         <span>Optimizing Inference Model...</span>
                         <span>{progress}% COMPLETED</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono italic">
                        Injecting local datasets for: Lane B / Southern Approach Junction...
                      </p>
                   </div>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                   { label: 'Inference Speed', val: '45ms', sub: 'On-Edge Chip' },
                   { label: 'Accuracy', val: '98.2%', sub: 'PCE-Validated' },
                   { label: 'Classes', val: '6 Objects', sub: 'Heavy & Light' },
                   { label: 'Hardware', val: 'ESP32-CAM', sub: 'Low Wattage' },
                ].map((stat, i) => (
                   <div key={i} className="glass p-5 rounded-2xl border border-white/5 text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{stat.label}</div>
                      <div className="text-xl font-black text-white">{stat.val}</div>
                      <div className="text-[9px] text-slate-500 mt-1 uppercase">{stat.sub}</div>
                   </div>
                ))}
             </div>
          </div>

          {/* ── Model History / Validation ─────────────────── */}
          <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">Recognition Log</h3>
                <RefreshCcw size={16} className="text-slate-500 cursor-pointer hover:text-white transition-colors" />
             </div>
             
             <div className="space-y-4 flex-1">
                {history.map(item => (
                   <div key={item.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                            <ShieldCheck size={20} />
                         </div>
                         <div>
                            <div className="text-xs font-bold text-white uppercase">{item.type}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">PCE Value: {item.pce}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs font-black text-cyan-400">{item.conf * 100}%</div>
                         <div className="text-[9px] text-slate-600 uppercase font-bold">CONFIDENCE</div>
                      </div>
                   </div>
                ))}
             </div>

             <div className="mt-8 border-t border-white/5 pt-6 space-y-3">
                <button className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all">
                   <Download size={14} /> EXPORT TRAINING WEIGHTS (.BIN)
                </button>
                <div className="text-[9px] text-slate-600 text-center uppercase tracking-tighter">
                   Upload this file to your ESP32 Hardware via Arduino OTA to apply changes.
                </div>
             </div>
          </div>

       </div>
    </div>
  );
}
