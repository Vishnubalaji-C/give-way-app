import { useWs } from '../context/WsContext';
import TacticalMap from '../components/TacticalMap';

export default function MapPage({ user }) {
  const { connected } = useWs();

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <TacticalMap user={user} showControls={true} />
      
      {!connected && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center rounded-3xl">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Re-establishing Uplink</h3>
            <p className="text-slate-400 text-sm mt-2">Connecting to GiveWay Matrix...</p>
          </div>
        </div>
      )}
    </div>
  );
}
