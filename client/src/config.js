// API Configuration — Auto-detect backend URL
// When served from Express (localhost:4000), use same origin (relative).
// When served from Vercel (different origin), point to Render backend.

const RENDER_BACKEND = 'https://giveway-backend.onrender.com';

// If running locally, you can use relative URLs. Otherwise, always use the Render backend.
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = isLocal ? '' : RENDER_BACKEND;

const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
export const WS_URL = isLocal
  ? `${wsProto}://${window.location.host}`
  : 'wss://giveway-backend.onrender.com';
