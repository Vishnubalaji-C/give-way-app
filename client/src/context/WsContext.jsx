import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL, WS_URL } from '../config';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const ws = useRef(null);
  const [state, setState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [connected, setConnected] = useState(false);
  const [junctions, setJunctions] = useState([]);

  // Fetch available junctions on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/junctions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJunctions(data); })
      .catch(() => {});
  }, []);

  const connect = useCallback(() => {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // auto-reconnect
    };
    socket.onerror = () => socket.close();

    socket.onmessage = (e) => {
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
    };
  }, []);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);

  const send = useCallback((type, payload = {}) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const switchJunction = useCallback(async (junctionId, token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/junctions/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ junctionId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh junctions list
        fetch(`${API_BASE_URL}/api/junctions`).then(r => r.json()).then(d => { if (Array.isArray(d)) setJunctions(d); });
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
