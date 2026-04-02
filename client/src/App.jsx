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

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Authenticate from local storage with 10-days persistence
  const [user, setUser] = useState(() => {
    const data = localStorage.getItem('giveway_user');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.expiresAt > Date.now()) return parsed;
        localStorage.removeItem('giveway_user');
      } catch (e) {
        localStorage.removeItem('giveway_user');
      }
    }
    return null;
  });

  // Light / Dark mode auto-switcher based on user preference or time
  const [theme, setTheme] = useState(() => localStorage.getItem('giveway_theme') || 'auto');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else if (theme === 'dark') {
      root.classList.remove('light-mode');
    } else {
      // Auto: Light from 6 AM to 6 PM, Dark at night
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 18) {
        root.classList.add('light-mode');
      } else {
        root.classList.remove('light-mode');
      }
    }
  }, [theme]);

  const [tab, setTab] = useState('dashboard');

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Intercept routing with Auth Lock
  if (!user) {
    return <AuthPage onLogin={(userData) => {
      // Set validity for 10 days
      const authObj = { ...userData, expiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000 };
      localStorage.setItem('giveway_user', JSON.stringify(authObj));
      setUser(authObj);
      setTab('dashboard'); // Default
    }} />;
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
    dashboard: DashboardPage,    // Mapped as 'Home'
    features:  FeaturesPage,     // Special Features
    camera:    CameraFeedPage,   // Camera Feed
    analytics: AnalyticsPage,    // Analytics/Simulation
    settings:  SettingsPage,     // Settings (was Control Room)
    map:       MapPage,          // NEW Map View
    wave:      GreenWavePage,    // NEW Green-Wave Tool
    training:  TrainingPage,     // NEW AI Trainer
    override:  () => <div className="text-center mt-20 text-red-500 font-black text-2xl animate-pulse delay-100">Emergency Override Emitting... <br/> <span className="text-sm opacity-50 mt-4 block">Waiting for hardware relay response</span></div>,
    incidents: () => <div className="text-center mt-20 text-amber-500 font-black text-2xl animate-pulse delay-100">No new Ghost-Lane incidents currently detected.</div>,
  };

  const Page = PAGES[tab] || DashboardPage;

  return (
    <WsProvider>
      {/* Immersive Background Theme */}
      <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-400 bg-glow-ring">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}/>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col transition-all duration-300">
        <Navbar tab={tab} setTab={setTab} user={user} onLogout={logout} theme={theme} onChangeTheme={handleSetTheme} />

        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          <Page user={user} />
        </main>

        {user.role === 'police' && <BottomNav tab={tab} setTab={setTab} />}
      </div>
    </WsProvider>
  );
}
