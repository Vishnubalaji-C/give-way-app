// API Configuration — Auto-detect backend URL
// When served from Express (localhost:4000), use same origin (relative).
// When served from Vercel (different origin), point to Render backend.

const RENDER_BACKEND = 'https://give-way-app.onrender.com';
const VERCEL_HOST = 'give-way-app.vercel.app';

// Detect if the frontend is served by the Express backend itself (same-origin)
const isSameOrigin = typeof window !== 'undefined' && !window.location.hostname.includes(VERCEL_HOST);

// When same-origin (Express serves both API + static), use '' (relative URLs).
// When cross-origin (Vercel frontend ↔ Render backend), use the Render URL.
export const API_BASE_URL = isSameOrigin ? '' : RENDER_BACKEND;

const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
export const WS_URL = isSameOrigin
  ? `${wsProto}://${window.location.host}`
  : 'wss://give-way-app.onrender.com';
