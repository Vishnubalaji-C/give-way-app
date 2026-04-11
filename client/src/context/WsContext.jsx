import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL, WS_URL } from '../config';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const ws          = useRef(null);
  const reconnectRef = useRef(null);

  const [state,     setState]     = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [auditLog,  setAuditLog]  = useState([]);
  const [connected, setConnected] = useState(false);
  const [junctions, setJunctions] = useState([]);
  const [sendQueue, setSendQueue] = useState([]); // queue messages sent before connection

  // ── Auto-detect real location and update the active junction ─────────────────
  // 1. Fetch junctions list from backend on mount
  // 2. Request browser GPS (silently – no UI block)
  // 3. Reverse-geocode via OpenStreetMap Nominatim (free, no API key)
  // 4. PATCH the active junction with real on-the-ground coordinates
  useEffect(() => {
    // Step 1: Load existing junctions from server
    fetch(`${API_BASE_URL}/api/junctions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJunctions(data); })
      .catch(() => {});

    // Step 2: Request GPS from browser
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng, accuracy } = coords;
        if (accuracy > 5000) return; // skip if wildly inaccurate

        try {
          // Step 3: Reverse-geocode with Nominatim (OpenStreetMap)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const geo = await geoRes.json();
          const road      = geo.address?.road || geo.address?.suburb || '';
          const suburb    = geo.address?.suburb || geo.address?.neighbourhood || '';
          const city      = geo.address?.city || geo.address?.town || geo.address?.county || '';
          const stateVal  = geo.address?.state || '';
          const district  = geo.address?.state_district || city;

          const dynamicName    = road ? `${road} Junction` : `${city} Junction`;
          const dynamicAddress = geo.display_name?.split(',').slice(0, 3).join(',') || `${road}, ${suburb}`;
          const dynamicZone    = `${district} — ${stateVal}`;

          // Step 4: Retrieve stored token and PATCH the active junction (JN-001)
          const stored = localStorage.getItem('makeway_user');
          const token  = stored ? JSON.parse(stored)?.token : null;
          if (!token) return;

          await fetch(`${API_BASE_URL}/api/junctions/JN-001`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: dynamicName, address: dynamicAddress, zone: dynamicZone, lat, lng, city, state: stateVal }),
          });

          // Refresh junction list after update
          const refreshed = await fetch(`${API_BASE_URL}/api/junctions`).then(r => r.json());
          if (Array.isArray(refreshed)) setJunctions(refreshed);

          console.log(`📍 [GEO] Junction auto-located: ${dynamicName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } catch (e) {
          console.warn('[GEO] Reverse-geocode failed, keeping existing junction data.', e);
        }
      },
      () => { /* User denied GPS — silently keep existing junction data */ },
      { timeout: 8000, maximumAge: 300000 } // 5 min cache, 8s timeout
    );
  }, []);

  const connect = useCallback(() => {
    // Clean up any pending reconnect timers
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      // Flush any queued messages
      setSendQueue(q => {
        q.forEach(item => socket.send(JSON.stringify(item)));
        return [];
      });
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000); // auto-reconnect
    };

    socket.onerror = () => socket.close();

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'INIT':
          case 'STATE_UPDATE':
          case 'RESET':
            setState(msg.payload);
            break;
          case 'JUNCTION_SWITCH':
            setState(msg.payload.state);
            break;
          case 'ALERT':
            setAlerts(prev => [msg.payload, ...prev].slice(0, 50));
            break;
          case 'AUDIT_LOG':
            setAuditLog(msg.payload);
            break;
        }
      } catch (err) { /* ignore malformed messages */ }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws.current?.close();
    };
  }, [connect]);

  // Robust send: if socket is open, send immediately; otherwise queue it
  const send = useCallback((type, payload = {}) => {
    const msg = { type, payload };
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    } else {
      // Queue and retry when reconnected
      setSendQueue(q => [...q, msg]);
      // Also try to trigger a reconnect if completely closed
      if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }
  }, [connect]);

  const switchJunction = useCallback(async (junctionId, token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/junctions/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ junctionId }),
      });
      const data = await res.json();
      if (data.success) {
        fetch(`${API_BASE_URL}/api/junctions`)
          .then(r => r.json())
          .then(d => { if (Array.isArray(d)) setJunctions(d); });
      }
      return data;
    } catch { return null; }
  }, []);

  return (
    <WsContext.Provider value={{ state, alerts, auditLog, connected, junctions, send, switchJunction }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWs = () => useContext(WsContext);
