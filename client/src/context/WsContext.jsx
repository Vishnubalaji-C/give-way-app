import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WsContext = createContext(null);

const WS_URL = 'wss://give-way-app.onrender.com';

export function WsProvider({ children }) {
  const ws = useRef(null);
  const [state, setState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [connected, setConnected] = useState(false);

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

  return (
    <WsContext.Provider value={{ state, alerts, auditLog, connected, send }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWs = () => useContext(WsContext);
