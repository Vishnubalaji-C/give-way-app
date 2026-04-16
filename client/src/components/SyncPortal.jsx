import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tablet, X, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SyncPortal({ isOpen, onClose }) {
  const [syncData, setSyncData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSyncToken = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync/token');
      const data = await res.json();
      if (data.success) {
        setSyncData(data);
        setError(null);
      } else {
        setError('Failed to fetch sync bridge.');
      }
    } catch (e) {
      setError('Connection to Master Hub failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSyncToken();
      // Auto-refresh token every 4 minutes (rotates every 5 on server)
      const interval = setInterval(fetchSyncToken, 240000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Portal Window */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-glass border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-cyan-500/20"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Tablet className="text-cyan-400" />
                Device Sync
              </h2>
              <p className="text-white/50 text-sm mt-1">Uplink mobile terminal to master junction</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="text-white/60" size={20} />
            </button>
          </div>

          <div className="bg-black/40 rounded-2xl p-6 flex flex-col items-center justify-center border border-white/5 relative group">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <RefreshCw size={40} className="text-cyan-400 animate-spin" />
                <span className="text-cyan-400 font-medium animate-pulse">Establishing Bridge...</span>
              </div>
            ) : error ? (
              <div className="h-64 flex flex-col items-center justify-center text-center gap-4">
                <p className="text-red-400 font-medium">{error}</p>
                <button 
                  onClick={fetchSyncToken}
                  className="px-4 py-2 bg-red-500/20 text-red-100 rounded-lg text-sm border border-red-500/30 font-bold hover:bg-red-500/30 transition-all"
                >
                  Retry Uplink
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      i: syncData.ip,
                      p: syncData.port,
                      s: syncData.sig,
                      t: syncData.token
                    })}
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: `${import.meta.env.BASE_URL}logo.png`,
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] text-cyan-400 font-black tracking-widest uppercase mb-3">
                    <ShieldCheck size={12} />
                    Secure Sync Signature Active
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed px-4">
                    Open the GiveWay app on your mobile, tap <span className="text-cyan-400 font-bold italic">Link Device</span>, and scan this code.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[10px] text-white/40 font-bold uppercase block mb-1">Local Address</span>
              <span className="text-white font-mono text-sm">{syncData?.ip || "-"}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[10px] text-white/40 font-bold uppercase block mb-1">Port</span>
              <span className="text-white font-mono text-sm">{syncData?.port || "4000"}</span>
            </div>
          </div>
        </div>

        <div className="bg-cyan-500/10 p-4 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-white/40 font-medium">
          <CheckCircle size={14} className="text-cyan-400/50" />
          Cloud Bridge Verified — Antigravity Protocol 4.2 · No Hardware Required
        </div>
      </motion.div>
    </div>
  );
}
