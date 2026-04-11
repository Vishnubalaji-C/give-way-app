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

export default function TacticalMap({ user, height = "100%", showControls = true }) {
  const { junctions, state, switchJunction } = useWs();

  const activePos = state?.junction ? [state.junction.lat, state.junction.lng] : [13.0604, 80.2496];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative" style={{ height }}>
      
      {/* Search & Overlay Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 z-[1000] w-[calc(100%-2rem)] sm:w-64 space-y-2 pointer-events-none">
           <div className="glass p-3 rounded-2xl border border-white/5 shadow-2xl pointer-events-auto">
              <h2 className="text-[10px] font-black text-white mb-0.5 uppercase tracking-widest flex items-center gap-1.5">
                 <Navigation size={12} className="text-cyan-400" /> Tactical Grid
              </h2>
           </div>

           <div className="hidden sm:block glass p-1.5 rounded-xl border border-white/5 shadow-2xl max-h-[200px] overflow-y-auto no-scrollbar pointer-events-auto">
              {junctions.map(j => (
                 <button 
                    key={j.id} 
                    onClick={() => switchJunction(j.id, user?.token)}
                    className={`w-full text-left p-2 rounded-lg transition-all mb-0.5 flex items-start gap-2 group ${state?.junction?.id === j.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                 >
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${j.status === 'online' ? 'bg-cyan-500' : 'bg-red-500'}`}></div>
                    <div className="min-w-0">
                       <div className="text-[10px] font-bold text-slate-200 truncate">{j.name}</div>
                    </div>
                    {state?.junction?.id === j.id && <Zap size={10} className="ml-auto text-cyan-400 animate-pulse" />}
                 </button>
              ))}
           </div>
        </div>
      )}

      <MapContainer center={activePos} zoom={14} scrollWheelZoom={true} className="h-full w-full grayscale-[0.8] brightness-[0.9] contrast-[1.1]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapRecenter coords={activePos} />
        
        {junctions.map(j => (
           <Marker key={j.id} position={[j.lat, j.lng]} icon={junctionIcon(j.status)}>
              <Popup className="ates-popup">
                 <div className="p-1 min-w-[180px]">
                    <h3 className="font-bold text-xs text-slate-100">{j.name}</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5 mb-1.5">{j.address}</p>
                    
                    <button 
                       onClick={() => switchJunction(j.id, user?.token)}
                       disabled={state?.junction?.id === j.id}
                       className="w-full py-1.5 rounded-md bg-cyan-500 text-[#02050a] text-[10px] font-black tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                    >
                       {state?.junction?.id === j.id ? 'ACTIVE' : 'CONNECT'}
                    </button>
                 </div>
              </Popup>
           </Marker>
        ))}
      </MapContainer>

      {/* Map Branding Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000] glass px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
         <div className="text-right">
            <div className="text-[8px] font-black text-cyan-400 tracking-[0.1em] uppercase">Matrix v2.6</div>
         </div>
         <Shield size={12} className="text-cyan-400" />
      </div>
    </div>
  );
}
