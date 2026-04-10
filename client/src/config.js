// API Configuration — Auto-detect backend URL
// When served directly from the Node backend (Render), we can use relative.
// If served from a separate CDN (like Vercel), fall back to the dynamic host or env variable.

const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

// If hosted on Render as a full-stack monolithic express app, use the current host.
const RENDER_BACKEND = isVercel ? 'https://giveway-backend.onrender.com' : '';

// In dev mode, API calls are handled by Vite proxy to 4000, but we can also use relative path safely.
export const API_BASE_URL = RENDER_BACKEND;

const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';

// If in dev mode (Vite), point WS directly to the backend running on port 4000
// Otherwise, dynamically use the current host (works perfectly for Render fullstack deployments)
export const WS_URL = isVercel 
  ? 'wss://giveway-backend.onrender.com' 
  : isDev 
    ? `ws://${window.location.hostname}:4000`
    : `${wsProto}://${typeof window !== 'undefined' ? window.location.host : 'localhost:4000'}`;
