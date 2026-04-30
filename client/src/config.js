// API Configuration — Auto-detect backend and WebSocket endpoints
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const getBaseUrl = () => {
  // Local Development -> Use relative paths to avoid hostname mismatches
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }
  
  // Vercel Deployment -> Detect Correct Render Backend
  if (hostname.includes('vercel.app')) {
    return ''; // Proxy through Vercel
  }
  
  // Default: Monolithic Render Deployment
  return '';
};

export const API_BASE_URL = getBaseUrl();

// Dynamic WebSocket Protocol detection
const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';

export const WS_URL = hostname === 'localhost' || hostname === '127.0.0.1'
  ? `ws://localhost:4000`
  : `wss://give-way-app.onrender.com`;

