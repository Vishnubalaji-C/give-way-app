import { useState } from 'react';
import { ShieldAlert, Fingerprint, Lock, ShieldCheck, User, Globe, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('police');
  const [fullName, setFullName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [pin, setPin] = useState('');
  
  const [badge, setBadge] = useState('');
  const [station, setStation] = useState('');
  
  const [dept, setDept] = useState('');
  const [access, setAccess] = useState('Standard');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uniqueId || !pin) return;
    
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { id: uniqueId, pin }
        : { id: uniqueId, pin, role, badge, station, dept, access, fullName };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Identity verification failed at root level.');
      }

      if (!isLogin) {
        setIsLogin(true);
        setPin('');
        setError('');
        setSuccess('Secure Identity Created. You may now authorize access.');
        return;
      }

      onLogin({ ...data.user, token: data.token });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#030712]">
      {/* Cinematic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        className="w-full max-w-[480px] bg-glass rounded-[2.5rem] p-10 relative border border-white/5 shadow-2xl overflow-hidden"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-24 h-24 rounded-3xl bg-white/[0.03] p-1 border border-white/10 shadow-2xl mb-6 group"
          >
            <div className="w-full h-full bg-[#030712] rounded-[1.4rem] flex items-center justify-center overflow-hidden">
               <img src={`${import.meta.env.BASE_URL}logo.png`} alt="MakeWay Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            MakeWay <span className="brand-gradient">ATES</span>
          </h1>
          <p className="text-white/30 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <Globe size={12} className="text-cyan-400" /> Secure Terminal Authorization
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-4 rounded-2xl flex items-center gap-3 font-bold"
            >
              <ShieldAlert size={16} /> {error}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-green-500/10 border border-green-500/30 text-green-300 text-xs p-4 rounded-2xl flex items-center gap-3 font-bold"
            >
              <ShieldCheck size={16} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="flex bg-white/5 rounded-2xl p-1.5 border border-white/5">
            <button 
              type="button" 
              onClick={() => setRole('police')} 
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${role === 'police' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-white/20 hover:text-white/40'}`}
            >
              <User size={14} /> Police Duty
            </button>
            <button 
              type="button" 
              onClick={() => setRole('admin')} 
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/20 hover:text-white/40'}`}
            >
              <ShieldAlert size={14} /> Control Room
            </button>
          </div>

          <div className="space-y-4">
            {!isLogin && (
              <InputGroup 
                label="Full Legal Name" 
                icon={<User size={18} />} 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="e.g. John Doe"
                role={role}
              />
            )}

            <InputGroup 
              label={role === 'police' ? 'Officer Unique ID' : 'Admin System ID'} 
              icon={<Fingerprint size={18} />} 
              value={uniqueId} 
              onChange={(e) => setUniqueId(e.target.value)} 
              placeholder={role === 'police' ? "e.g., PL-8849" : "e.g., ADM-091"}
              role={role}
            />

            <InputGroup 
              label="Authorization PIN" 
              type="password"
              icon={<Lock size={18} />} 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              placeholder="••••••"
              role={role}
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading} 
            type="submit" 
            className={`w-full py-4 rounded-2xl font-black tracking-[0.2em] text-xs text-white shadow-2xl transition-all ${role === 'police' ? 'bg-cyan-500 shadow-cyan-500/25' : 'bg-amber-500 shadow-amber-500/25'} mt-6 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'SYNCHRONIZING...' : (isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE IDENTITY')}
          </motion.button>
        </form>

        <div className="mt-10 text-center">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isLogin ? "Neural Identity Registration" : "Global Authorization Gateway"} <ChevronRight size={12} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InputGroup({ label, icon, value, onChange, placeholder, role, type = "text" }) {
  const accent = role === 'police' ? 'focus:border-cyan-500' : 'focus:border-amber-500';
  const iconColor = role === 'police' ? 'text-cyan-500' : 'text-amber-500';

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] ml-1">{label}</label>
      <div className="relative group">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconColor} opacity-40 group-focus-within:opacity-100 transition-opacity`}>
          {icon}
        </div>
        <input 
          type={type}
          value={value} 
          onChange={onChange} 
          required 
          placeholder={placeholder} 
          className={`w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm text-white placeholder:text-white/10 focus:outline-none focus:bg-white/[0.04] transition-all ${accent} ${type === 'password' ? 'tracking-[0.5em]' : ''}`} 
        />
      </div>
    </div>
  );
}
