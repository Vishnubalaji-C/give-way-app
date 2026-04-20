import { useState, useEffect } from 'react';
import { WsProvider } from './context/WsContext';
import Navbar          from './components/Navbar';
import BottomNav       from './components/BottomNav';
import SplashScreen    from './components/SplashScreen';
import DashboardPage   from './pages/DashboardPage';
import CameraFeedPage  from './pages/CameraFeedPage';
import AnalyticsPage   from './pages/AnalyticsPage';
import SettingsPage    from './pages/SettingsPage';
import MapPage         from './pages/MapPage';
import ControlRoomPage from './pages/ControlRoomPage';
import { API_BASE_URL } from './config';
import axios           from 'axios';

// One-time migration: wipe old theme so dark mode always loads.
(function migrateTheme() {
  const t = localStorage.getItem('giveway_theme');
  if (!t || t === 'auto' || t === 'light') {
    localStorage.setItem('giveway_theme', 'dark');
  }
  document.documentElement.classList.remove('light-mode');
})();

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab,        setTab]        = useState('dashboard');
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 1024);
  const [theme,      setTheme]      = useState(() => localStorage.getItem('giveway_theme') || 'dark');

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('giveway_user');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { role: 'admin', name: 'Administrator' };
  });

  // Always enforce dark mode – glassmorphism UI is dark-only
  useEffect(() => {
    document.documentElement.classList.remove('light-mode');
  }, [theme]);

  // Responsive layout detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ─── CONDITIONAL RENDERS – after all hooks ─────────────────────────────────
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  const logout = () => {
    // No-op since login is disabled
    setTab('dashboard');
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('giveaway_theme', newTheme);
  };

  const handleUpdateUser = async (updatedUser) => {
    // If role is being changed, sync with persistent backend first
    if (updatedUser.role && updatedUser.role !== user.role) {
      try {
        const res = await axios.patch(`${API_BASE_URL}/api/auth/role`, 
          { role: updatedUser.role }
        );
        if (res.data.success) {
          const newUser = { ...user, ...res.data.user };
          localStorage.setItem('giveaway_user', JSON.stringify(newUser));
          setUser(newUser);
          console.log(`📡 [AUTH] Unified Persona Switch: Active context is now ${updatedUser.role.toUpperCase()}`);
          return;
        }
      } catch (e) {
        console.error('❌ [AUTH] Role Synchronization Failed:', e);
      }
    }

    const newUser = { ...user, ...updatedUser };
    localStorage.setItem('giveaway_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const PAGES = {
    dashboard:  DashboardPage,
    camera:     CameraFeedPage,
    analytics:  AnalyticsPage,
    settings:   SettingsPage,
    map:        MapPage,
    control:    ControlRoomPage,
    override:   () => (
      <div className="text-center mt-20 text-red-500 font-black text-2xl animate-pulse">
        Emergency Override Active
        <br />
        <span className="text-sm opacity-50 mt-4 block text-white/40">All lanes set to RED — GiveWay AI control suspended</span>
      </div>
    ),
    incidents: () => (
      <div className="text-center mt-20 text-amber-500 font-black text-2xl animate-pulse">
        No new Ghost-Lane incidents currently detected.
      </div>
    ),
  };

  const Page = PAGES[tab] || DashboardPage;

  return (
    <WsProvider>
      {/* Deep midnight dark grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: '#030712',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar
          tab={tab}
          setTab={setTab}
          user={user}
          onLogout={logout}
          theme={theme}
          onChangeTheme={handleSetTheme}
          isMobile={isMobile}
        />

        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <Page user={user} onUpdateUser={handleUpdateUser} />
        </main>

        {isMobile && (
          <BottomNav tab={tab} setTab={setTab} />
        )}
      </div>
    </WsProvider>
  );
}
