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

  // Fetch available junctions on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/junctions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJunctions(data); })
      .catch(() => {});
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
