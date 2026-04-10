import { useState, useEffect } from 'react';
import { WsProvider } from './context/WsContext';
import Navbar          from './components/Navbar';
import BottomNav       from './components/BottomNav';
import SplashScreen    from './components/SplashScreen';
import DashboardPage   from './pages/DashboardPage';
import FeaturesPage    from './pages/FeaturesPage';
import CameraFeedPage  from './pages/CameraFeedPage';
import AnalyticsPage   from './pages/AnalyticsPage';
import SettingsPage    from './pages/SettingsPage';
import MapPage         from './pages/MapPage';
import GreenWavePage   from './pages/GreenWavePage';
import TrainingPage    from './pages/TrainingPage';
import AuthPage        from './pages/AuthPage';
import SimulationPage  from './pages/SimulationPage';
import ControlRoomPage from './pages/ControlRoomPage';

// One-time migration: wipe old 'auto'/'light' theme so dark mode always loads.
(function migrateTheme() {
  const t = localStorage.getItem('giveway_theme');
  if (!t || t === 'auto' || t === 'light') {
    localStorage.setItem('giveway_theme', 'dark');
  }
  document.documentElement.classList.remove('light-mode');
})();

export default function App() {
  // ─── ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS ─────────────────────
  const [showSplash, setShowSplash] = useState(true);
  const [tab,        setTab]        = useState('dashboard');
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 1024);
  const [theme,      setTheme]      = useState(() => localStorage.getItem('giveway_theme') || 'dark');

  const [user, setUser] = useState(() => {
    try {
      const data = localStorage.getItem('giveway_user');
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (parsed.expiresAt > Date.now()) return parsed;
      localStorage.removeItem('giveway_user');
    } catch (e) {
      localStorage.removeItem('giveway_user');
    }
    return null;
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

  if (!user) {
    return (
      <AuthPage onLogin={(userData) => {
        const authObj = { ...userData, expiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000 };
        localStorage.setItem('giveway_user', JSON.stringify(authObj));
        setUser(authObj);
        setTab('dashboard');
      }} />
    );
  }

  const logout = () => {
    localStorage.removeItem('giveway_user');
    setUser(null);
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('giveway_theme', newTheme);
  };

  const PAGES = {
    dashboard:  DashboardPage,
    simulation: SimulationPage,
    features:   FeaturesPage,
    camera:     CameraFeedPage,
    analytics:  AnalyticsPage,
    settings:   SettingsPage,
    map:        MapPage,
    wave:       GreenWavePage,
    training:   TrainingPage,
    control:    ControlRoomPage,
    override:   () => (
      <div className="text-center mt-20 text-red-500 font-black text-2xl animate-pulse">
        Emergency Override Emitting...
        <br />
        <span className="text-sm opacity-50 mt-4 block">Waiting for hardware relay response</span>
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
        />

        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <Page user={user} />
        </main>

        {(user.role === 'police' || isMobile) && (
          <BottomNav tab={tab} setTab={setTab} />
        )}
      </div>
    </WsProvider>
  );
}
