// API Configuration — Auto-detect backend and WebSocket endpoints
const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const hostname = window.location.hostname;
  
  // Local Development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  
  // Vercel Deployment -> Detect Correct Render Backend
  // We prioritize 'giveway-backend' but support hyphenated 'give-way-backend' as fallback.
  if (hostname.includes('vercel.app')) {
    // Proxy through Vercel for zero-CORS configuration
    return '';
  }
  
  // Default: Monolithic Render Deployment (use current host)
  return '';
};

const BASE_URL = getBaseUrl();

export const API_BASE_URL = BASE_URL;

// Dynamic WebSocket Protocol detection
const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';

export const WS_URL = hostname === 'localhost' || hostname === '127.0.0.1'
  ? `ws://localhost:4000`
  : `wss://makeway-backend.onrender.com`;
