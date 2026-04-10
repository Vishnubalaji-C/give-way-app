// API Configuration — Auto-detect backend URL
// When served directly from the Node backend (Render), we can use relative.
// If served from a separate CDN (like Vercel), fall back to the dynamic host or env variable.

const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
// If hosted on Render as a full-stack monolithic express app, use the current host.
const RENDER_BACKEND = isVercel ? 'https://giveway-backend.onrender.com' : '';

export const API_BASE_URL = RENDER_BACKEND;

const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
export const WS_URL = isVercel 
  ? 'wss://giveway-backend.onrender.com' 
  : `${wsProto}://${typeof window !== 'undefined' ? window.location.host : 'localhost:4000'}`;
