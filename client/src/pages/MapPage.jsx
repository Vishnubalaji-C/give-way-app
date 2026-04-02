import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useWs } from '../context/WsContext';
import { Navigation, Wifi, Shield, Zap } from 'lucide-react';
import L from 'leaflet';
import { useEffect } from 'react';

// Custom Marker for ATES Junctions
const junctionIcon = (status) => L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 ${status === 'online' ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_15px_rgba(0,229,255,0.6)]' : 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(255,59,59,0.5)]'}">
      <div class="w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-cyan-500 animate-pulse' : 'bg-red-500'}"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapRecenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 14, { animate: true });
  }, [coords]);
  return null;
}

export default function MapPage({ user }) {
  const { junctions, state, switchJunction } = useWs();

  const activePos = state?.junction ? [state.junction.lat, state.junction.lng] : [13.0604, 80.2496];

  return (
    <div className="h-[calc(100vh-200px)] w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
      
      {/* Search & Overlay Controls */}
      <div className="absolute top-6 left-6 z-[1000] w-72 space-y-3">
         <div className="glass p-4 rounded-3xl border border-white/5 shadow-2xl">
            <h2 className="text-sm font-black text-white mb-1 uppercase tracking-widest flex items-center gap-2">
               <Navigation size={14} className="text-cyan-400" /> Live Grid Matrix
            </h2>
            <p className="text-[10px] text-slate-400 leading-tight">
               Real-time monitoring of all GiveWay ATES nodes across Chennai.
            </p>
         </div>

         <div className="glass p-2 rounded-2xl border border-white/5 shadow-2xl max-h-[300px] overflow-y-auto no-scrollbar">
            {junctions.map(j => (
               <button 
                  key={j.id} 
                  onClick={() => switchJunction(j.id, user?.token)}
                  className={`w-full text-left p-3 rounded-xl transition-all mb-1 flex items-start gap-3 group ${state?.junction?.id === j.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/5 border border-transparent'}`}
               >
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${j.status === 'online' ? 'bg-cyan-500' : 'bg-red-500'}`}></div>
                  <div className="min-w-0">
                     <div className="text-xs font-bold text-slate-200 truncate">{j.name}</div>
                     <div className="text-[10px] text-slate-500 font-mono italic">{j.id}</div>
                  </div>
                  {state?.junction?.id === j.id && <Zap size={12} className="ml-auto text-cyan-400 animate-pulse" />}
               </button>
            ))}
         </div>
      </div>

      <MapContainer center={activePos} zoom={14} scrollWheelZoom={true} className="h-full w-full grayscale-[0.8] brightness-[0.9] contrast-[1.1]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapRecenter coords={activePos} />
        
        {junctions.map(j => (
           <Marker key={j.id} position={[j.lat, j.lng]} icon={junctionIcon(j.status)}>
              <Popup className="ates-popup">
                 <div className="p-1 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                       <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${j.status === 'online' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
                          {j.status.toUpperCase()}
                       </span>
                       <span className="text-[10px] text-slate-500 font-mono">{j.id}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-100">{j.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 mb-2">{j.address}</p>
                    
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 mb-3">
                       <div className="flex items-center gap-1.5">
                          <Wifi size={12} className="text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-300">{j.cameraNodes} Nodes</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <Shield size={12} className="text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-300">PCE Ready</span>
                       </div>
                    </div>

                    <button 
                       onClick={() => switchJunction(j.id, user?.token)}
                       disabled={state?.junction?.id === j.id}
                       className="w-full py-2 rounded-lg bg-cyan-500 text-[#02050a] text-xs font-black tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                    >
                       {state?.junction?.id === j.id ? 'CURRENTLY MONITORING' : 'CONNECT TO UPLINK'}
                    </button>
                 </div>
              </Popup>
           </Marker>
        ))}
      </MapContainer>

      {/* Map Branding Overlay */}
      <div className="absolute bottom-6 right-6 z-[1000] glass px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-4">
         <div className="text-right">
            <div className="text-[10px] font-black text-cyan-400 tracking-[0.2em] uppercase">GiveWay Matrix v2.6</div>
            <div className="text-[9px] text-slate-500 font-bold uppercase">Dynamic Location Handshake Active</div>
         </div>
         <div className="w-10 h-10 rounded-xl bg-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.4)]">
            <Shield size={20} className="text-[#02050a]" />
         </div>
      </div>
    </div>
  );
}
