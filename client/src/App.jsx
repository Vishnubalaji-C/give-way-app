import { useState, useEffect, Suspense, lazy } from 'react';
import { WsProvider } from './context/WsContext';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar          from './components/Navbar';
import BottomNav       from './components/BottomNav';
import SplashScreen    from './components/SplashScreen';
import AppTutorial     from './components/AppTutorial';
import { API_BASE_URL } from './config';
import axios           from 'axios';

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'red', background: 'black', height: '100vh', zIndex: 99999, position: 'relative' }}>
          <h1>React Crashed</h1>
          <pre style={{ color: 'white' }}>{this.state.error?.toString()}</pre>
          <pre style={{ color: 'gray' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const CameraFeedPage  = lazy(() => import('./pages/CameraFeedPage'));
const AnalyticsPage   = lazy(() => import('./pages/AnalyticsPage'));

const ControlRoomPage = lazy(() => import('./pages/ControlRoomPage'));
const AuthPage        = lazy(() => import('./pages/AuthPage'));

const PageLoader = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return <div className="h-[50vh]"></div>;

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] opacity-80">
      <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
      <span className="mt-5 text-[10px] font-black text-cyan-400 tracking-[0.3em] uppercase animate-pulse">Syncing...</span>
    </div>
  );
};

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

  const logout = () => {
    localStorage.removeItem('giveway_user');
    setUser(null);
    setTab('dashboard');
  };

  const handleLogin = (userData) => {
    localStorage.setItem('giveway_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('giveway_theme', newTheme);
  };

  const handleUpdateUser = async (updatedUser) => {
    const newUser = { ...user, ...updatedUser };
    localStorage.setItem('giveway_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const PAGES = {
    dashboard:  DashboardPage,
    analytics:  AnalyticsPage,
    control:    ControlRoomPage,
    override:   () => (
      <div className="text-center mt-20 text-red-500 font-black text-2xl animate-pulse">
        Emergency Override Active
        <br />
        <span className="text-sm opacity-50 mt-4 block text-white/40">All lanes set to RED — GiveWay AI control suspended</span>
      </div>
    ),
    incidents: () => (
      <div className="text-center mt-20 text-amber-500 font-black text-2xl animate-pulse font-mono tracking-widest">
        GHOST LANE TRACKER: SCANNING FOR BLOCKAGES...
      </div>
    ),
  };

  const Page = PAGES[tab] || DashboardPage;

  return (
    <ErrorBoundary>
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
          {!user ? (
            <Suspense fallback={<PageLoader />}>
              <AuthPage onLogin={handleLogin} />
            </Suspense>
          ) : (
            <>
              <Navbar
                tab={tab}
                setTab={setTab}
                user={user}
                onLogout={logout}
                theme={theme}
                onChangeTheme={handleSetTheme}
                isMobile={isMobile}
              />

              <AppTutorial />

              <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full h-full"
                  >
                    <Suspense fallback={<PageLoader />}>
                      <Page user={user} onUpdateUser={handleUpdateUser} />
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </main>

              {isMobile && (
                <BottomNav tab={tab} setTab={setTab} />
              )}
            </>
          )}
        </div>
      </WsProvider>
    </ErrorBoundary>
  );
}
