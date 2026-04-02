// API Configuration
// If development: Use localhost:4000
// If production: Use the specific Render backend URL

const isProd = import.meta.env.PROD;

export const API_BASE_URL = isProd 
  ? 'https://give-way-app.onrender.com' 
  : 'http://localhost:4000';

export const WS_URL = isProd
  ? 'wss://give-way-app.onrender.com'
  : 'ws://localhost:4000';
