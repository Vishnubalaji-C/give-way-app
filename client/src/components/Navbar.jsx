import { useState, useEffect } from 'react';
import SyncPortal from './SyncPortal';
import { useWs } from '../context/WsContext';
import { Tablet, Wifi, WifiOff, CloudRain, ShieldAlert, Video, AlertTriangle, Siren, Search, Radio, LayoutGrid, Wind, FileBarChart, ChevronLeft, User, Activity, AlertCircle, Sun, Moon, Sparkles, LogOut } from 'lucide-react';

export default function Navbar({ tab, setTab, user, onLogout, theme, onChangeTheme, isMobile }) {
  const { connected, state, junctions, switchJunction } = useWs();
  const [latency, setLatency] = useState(0);

  // Simulate latency
  useEffect(() => {
    const id = setInterval(() => {
      setLatency(Math.floor(Math.random() * (150 - 45 + 1) + 45)); // random between 45ms and 150ms
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const cycleTheme = () => {
    if (theme === 'auto') onChangeTheme('light');
    else if (theme === 'light') onChangeTheme('dark');
    else onChangeTheme('auto');
  };

  const ThemeIcon = theme === 'light' ? Sun : (theme === 'dark' ? Moon : Sparkles);
  const [showSync, setShowSync] = useState(false);

  return (
    <>
      {/* ----------------------------------------------------- */}
      {/* 1. MOBILE APP NAVIGATION BAR (For On-Ground Police) */}
      {/* ----------------------------------------------------- */}
      {isMobile && (
      <nav className="sticky top-0 z-50 bg-[#02050a]/95 backdrop-blur-2xl border-b border-cyan-500/10">
        {/* A. Status & Identity Bar (The Top Header) */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left Side: Circular Avatar + Pulse Indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shadow-inner">
              <User size={20} className="text-slate-400" />
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#02050a] flex items-center justify-center ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(0,255,136,0.6)]' : 'bg-red-500'}`}>
                {connected && <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
              </div>
            </div>
          </div>

          {/* Center: Junction Name (Dynamic from Server State) */}
          <div className="text-center mx-2 flex-1">
            <div className="text-sm font-black text-white tracking-wide">{state?.junction?.name || 'Connecting...'}</div>
            <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5 flex items-center justify-center gap-1">
              <Activity size={10} /> Latency: {latency}ms
            </div>
            <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">OPERATOR · {state?.junction?.poleId || ''}</div>
          </div>

          {/* Right Side: Theme, Config & Status */}
          <div className="flex items-center gap-2">
            {/* WS Connection Status */}
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse' : 'bg-red-500'}`} title={connected ? 'WebSocket Connected' : 'Disconnected'} />
            <button onClick={() => setShowSync(true)} className="p-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-full transition-colors text-cyan-400 border border-cyan-500/20" title="Link Mobile Device">
              <Tablet size={14} />
            </button>
            <button onClick={cycleTheme} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors text-amber-400">
              <ThemeIcon size={14} />
            </button>
            <button onClick={onLogout} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors text-red-500 border border-red-500/20">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* B. The "Action Quick-Bar" */}
        <div className="flex items-center justify-around px-3 pb-3 gap-2">
          {tab !== 'dashboard' && (
            <button onClick={() => setTab('dashboard')} className="nav-dashboard flex flex-col items-center justify-center py-2.5 px-3 rounded-xl bg-slate-800/50 hover:bg-slate-700 hover:scale-105 transition-all border border-transparent">
              <ChevronLeft size={18} className="text-cyan-400" />
              <span className="text-[10px] font-black mt-1 text-slate-300">BACK</span>
            </button>
          )}



          {/* Camera tab removed */}
          
          <button onClick={() => setTab('control')} className={`nav-control flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all md:hover:-translate-y-1 relative overflow-hidden group ${tab === 'control' ? 'bg-red-500/30 border-red-500 text-red-400 shadow-lg' : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500'}`}>
            <div className="absolute inset-0 bg-red-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <AlertTriangle size={18} className="relative z-10 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black mt-1 relative z-10">OVERRIDE</span>
          </button>
          
          <button onClick={() => setTab('incidents')} className={`nav-incidents flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border relative transition-all md:hover:-translate-y-1 relative overflow-hidden group ${tab === 'incidents' ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg' : 'bg-slate-800/50 hover:bg-slate-800 hover:border-amber-500/30 border-transparent text-slate-300'}`}>
            <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-black min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.8)] z-20 group-hover:scale-110 transition-transform">
              2
            </div>
            <Siren size={18} className={`relative z-10 ${tab === 'incidents' ? 'text-amber-400' : 'text-slate-400'} group-hover:scale-110 transition-transform`} />
            <span className="text-[10px] font-black mt-1 relative z-10">INCIDENTS</span>
          </button>
          
          <button onClick={() => setTab('analytics')} className={`nav-analytics flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all md:hover:-translate-y-1 relative overflow-hidden group ${tab === 'analytics' ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] text-purple-300' : 'bg-slate-800/50 hover:bg-slate-800 hover:border-purple-500/30 border-transparent text-slate-300'}`}>
            <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <FileBarChart size={18} className={`relative z-10 ${tab === 'analytics' ? 'text-purple-400' : 'text-slate-400'} group-hover:scale-110 transition-transform`} />
            <span className="text-[10px] font-black mt-1 relative z-10">ANALYTICS</span>
          </button>
        </div>
      </nav>
      )}

      {/* ----------------------------------------------------- */}
      {/* 2. WEB DASHBOARD NAVIGATION BAR (For Central Control Room) */}
      {/* ----------------------------------------------------- */}
      {!isMobile && (
      <nav className="sticky top-0 z-50 flex flex-col bg-[#02050a]/90 backdrop-blur-2xl border-b border-cyan-500/10 shadow-2xl">
        {/* A. The Global Utility Bar (Top-Most) */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/50 bg-black/40 xl:gap-8 overflow-x-auto no-scrollbar">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-green-500 p-0.5 shadow-[0_0_15px_rgba(0,255,136,0.3)]">
              <div className="w-full h-full bg-[#02050a] rounded-[10px] flex items-center justify-center overflow-hidden">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="GiveWay Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl brand-gradient tracking-tight leading-none uppercase">GiveWay</span>
              <span className="text-[10px] font-bold text-cyan-400/60 tracking-[0.2em] uppercase mt-1">ATES Framework</span>
            </div>
          </div>

          {/* Vision Title (Desktop Only) */}
          <div className="hidden 2xl:block text-[10px] font-black text-cyan-400 opacity-60 uppercase tracking-widest border-l border-slate-800 pl-4">
             Adaptive Traffic Equity System <br/> 2026 Vision Framework
          </div>

          {/* Global Search - REMOVED for clean UI */}

          {/* Wireless Hardware Sync Indicator - REMOVED for clean UI */}

          {/* Emergency Broadcast & Role Switcher */}
          <div className="flex items-center gap-4 xl:gap-6 shrink-0">
            <button 
              onClick={() => setShowSync(true)}
              className="flex items-center gap-2 text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 px-3 xl:px-4 py-2 rounded-full border border-cyan-400/30 transition-all text-[10px] xl:text-xs font-black tracking-wide shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.1)] group"
            >
              <Tablet size={14} className="group-hover:scale-110 transition-transform" /> 
              LINK MOBILE
            </button>
            <button onClick={() => setTab('control')} className="flex items-center gap-2 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-3 xl:px-4 py-2 rounded-full border border-amber-500/30 transition-all text-[10px] xl:text-xs font-black tracking-wide shrink-0 animate-[pulse_2s_ease-in-out_infinite]">
              <Radio size={14} /> EMERGENCY BROADCAST
            </button>
            <div className="flex items-center gap-3 border-l border-slate-700/80 pl-4 xl:pl-6">
              <div className="text-right leading-tight">
                <div className="text-xs xl:text-sm font-bold text-slate-200">OPERATOR</div>
                <div className="text-[9px] xl:text-[10px] text-cyan-400 font-bold uppercase tracking-widest">{user?.id || 'ID-OFFLINE'} ▾</div>
              </div>
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 shadow-inner group relative cursor-pointer">
                <ShieldAlert size={16} className="text-cyan-400 xl:w-[18px]" />
                <div className="absolute right-0 top-12 bg-slate-900 border border-cyan-500/20 rounded-xl p-2 hidden group-hover:flex flex-col gap-1 min-w-[200px] shadow-2xl">
                    <button onClick={cycleTheme} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-300 transition-colors">
                      {theme === 'auto' ? 'Auto Theme (Time Sync)' : (theme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active')}
                      <ThemeIcon size={14} className="text-amber-400"/>
                    </button>
                    <button onClick={onLogout} className="flex items-center justify-between px-3 py-2 hover:bg-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors">
                      Log Out Securely
                      <LogOut size={14} />
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Junction Location Strip */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-800/50 bg-gradient-to-r from-cyan-950/30 via-transparent to-emerald-950/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${state?.junction?.status === 'online' ? 'bg-green-400 shadow-[0_0_8px_rgba(0,255,136,0.6)] animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-black text-slate-100">{state?.junction?.name || 'No Junction'}</span>
            </div>
            <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-slate-500">
              <span className="px-2 py-0.5 bg-slate-800/60 rounded border border-slate-700/40">{state?.junction?.id || '---'}</span>
              <span>📍 {state?.junction?.address || '---'}</span>
              <span className="text-cyan-400/60">{state?.junction?.zone || ''}</span>
            </div>
          </div>

        </div>

        {/* B. The "View-Mode" Tab Bar (Contextual Navigation) */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id:'dashboard', icon: <LayoutGrid size={16}/>, label: 'Live Monitor' },
              { id:'analytics', icon: <FileBarChart size={16}/>, label: 'Analytics' },
              { id:'control', icon: <AlertTriangle size={16}/>, label: 'Override' },
              { id: 'monitor', label: 'Signal Monitor', icon: <Activity size={18} /> },
              { id:'incidents', icon: <Siren size={16}/>, label: 'Incidents' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`nav-${t.id} flex items-center gap-2 px-3 xl:px-5 py-2 rounded-lg text-xs xl:text-sm font-bold transition-all ${
                  tab === t.id
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          
          {/* Universal UX Safety Features */}
          <div className="flex items-center gap-4 ml-auto">
            {tab !== 'dashboard' && (
              <button onClick={() => setTab('dashboard')} className="flex items-center gap-1.5 text-[10px] xl:text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-md bg-slate-800/50 border border-slate-700 hover:border-slate-500 transition-all">
                <ChevronLeft size={14}/> BACK TO SIGNAL CONTROL
              </button>
            )}
            
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 gap-4">
               <div className="flex items-center gap-1.5 text-[9px] xl:text-[10px] text-slate-400 font-mono tracking-wider">
                 <AlertCircle size={10} className="text-slate-500 xl:w-3 xl:h-3"/>
                 LATENCY: <span className={latency > 150 ? 'text-amber-500 font-bold' : 'text-emerald-400 font-bold'}>{latency}ms</span>
               </div>
               <div className={`flex items-center gap-1.5 text-[9px] xl:text-[10px] font-bold font-mono tracking-widest ${connected ? 'text-green-400' : 'text-red-400'}`}>
                 {connected ? <span className="w-1.5 h-1.5 xl:w-2 xl:h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(0,255,136,0.8)] animate-[pulse_1.5s_ease-in-out_infinite]"/> : <WifiOff size={10} className="xl:w-3 xl:h-3"/>}
                 {connected ? 'ACTIVE' : 'OFFLINE'}
               </div>
            </div>
          </div>
        </div>
      </nav>
      )}
      
      <SyncPortal isOpen={showSync} onClose={() => setShowSync(false)} />
    </>
  );
}
