import { useState } from 'react';
import { ShieldAlert, Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('police');
  const [fullName, setFullName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [pin, setPin] = useState('');
  
  // Police Extra
  const [badge, setBadge] = useState('');
  const [station, setStation] = useState('');
  
  // Admin Extra
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
        throw new Error(data.error || 'Failed to authenticate securely against root server.');
      }

      if (!isLogin) {
        setIsLogin(true);
        setPin('');
        setError('');
        setSuccess('👮 Secure Identity Created! You can now authorize your access below.');
        return;
      }

      onLogin({
        ...data.user,
        token: data.token
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass p-8 relative overflow-hidden">
        
        {/* Decorative Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-green-500"></div>

        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-green-500 p-0.5 shadow-[0_0_20px_rgba(0,255,136,0.2)]">
            <div className="w-full h-full bg-[#02050a] rounded-[14px] flex items-center justify-center overflow-hidden">
               <img src="/logo.png" alt="MakeWay Logo" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-center brand-gradient mb-4">
          {isLogin ? 'System Authentication' : 'Secure Registration'}
        </h1>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-pulse">
            <ShieldAlert size={14} /> {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-300 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-bounce">
            <ShieldCheck size={14} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="flex bg-[var(--input-bg)] rounded-xl p-1 border border-[var(--input-border)]">
            <button type="button" onClick={() => setRole('police')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${role === 'police' ? 'bg-[var(--cyan)]/20 text-[var(--cyan)] border border-[var(--cyan)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
              <ShieldCheck size={14} /> Police Duty
            </button>
            <button type="button" onClick={() => setRole('admin')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${role === 'admin' ? 'bg-[var(--amber)]/20 text-[var(--amber)] border border-[var(--amber)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
              <ShieldAlert size={14} /> Control Room
            </button>
          </div>

          {!isLogin && (
            <div>
              <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Legal Full Name</label>
              <div className="relative mt-1">
                <ShieldCheck size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${role === 'police' ? 'text-[var(--cyan)]' : 'text-[var(--amber)]'}`} />
                <input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. John Doe" className={`w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none transition-colors ${role === 'police' ? 'focus:border-[var(--cyan)]' : 'focus:border-[var(--amber)]'}`} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--text-muted)] font-bold ml-1">{role === 'police' ? 'Officer Unique ID' : 'Admin System ID'}</label>
            <div className="relative mt-1">
              <Fingerprint size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${role === 'police' ? 'text-[var(--cyan)]' : 'text-[var(--amber)]'}`} />
              <input value={uniqueId} onChange={e => setUniqueId(e.target.value)} required placeholder={role === 'police' ? "e.g., PL-8849" : "e.g., ADM-091"} className={`w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none transition-colors ${role === 'police' ? 'focus:border-[var(--cyan)]' : 'focus:border-[var(--amber)]'}`} />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Secure PIN</label>
            <div className="relative mt-1">
              <Lock size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${role === 'police' ? 'text-[var(--cyan)]' : 'text-[var(--amber)]'}`} />
              <input type="password" value={pin} onChange={e => setPin(e.target.value)} required placeholder="••••••" className={`w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-3 pl-10 pr-4 text-sm tracking-widest text-[var(--text-main)] focus:outline-none transition-colors ${role === 'police' ? 'focus:border-[var(--cyan)]' : 'focus:border-[var(--amber)]'}`} />
            </div>
          </div>

          {!isLogin && role === 'police' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--input-border)]">
              <div>
                <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Badge Number</label>
                <input value={badge} onChange={e => setBadge(e.target.value)} required className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2 px-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--cyan)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Station Code</label>
                <input value={station} onChange={e => setStation(e.target.value)} required className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2 px-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--cyan)]" />
              </div>
            </div>
          )}

          {!isLogin && role === 'admin' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--input-border)]">
              <div>
                <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Department Region</label>
                <input value={dept} onChange={e => setDept(e.target.value)} required className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2 px-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--amber)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] font-bold ml-1">Access Level</label>
                <select value={access} onChange={e => setAccess(e.target.value)} className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2 px-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--amber)] appearance-none">
                  <option>Standard</option>
                  <option>Super-User</option>
                </select>
              </div>
            </div>
          )}

          <button disabled={loading} type="submit" className={`w-full py-3 rounded-xl font-black tracking-widest text-sm text-white shadow-lg transition-all ${role === 'police' ? 'bg-[var(--cyan)] hover:brightness-110 shadow-[var(--cyan)]/20' : 'bg-[var(--amber)] hover:brightness-110 shadow-[var(--amber)]/20'} mt-6 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {loading ? 'UPLINKING...' : (isLogin ? 'AUTHORIZE ACCESS' : 'REGISTER ID')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            {isLogin ? "New user? Create a Secure Identity" : "Already have an ID? Proceed to Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
