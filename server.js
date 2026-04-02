/**
 * GiveWay — Adaptive Traffic Equity System
 * Backend: Node.js + Express + ws (WebSocket)
 */

const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const cors   = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs      = require('fs');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve Production React PWA (client/dist) unconditionally
app.use(express.static(path.join(__dirname, 'client/dist')));

// ─── Confidential Database Layer ──────────────────────────────────────────────
const DB_FILE = './giveway_secure_db.json';
let db = { users: [], auditLogs: [], systemEvents: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { console.error('DB parse error'); }
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ─── Middleware: Secure Mobile & Web Access ──────────────────────────────────
// Require valid Bearer token for API operations
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Confidential Access: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  const user = db.users.find(u => u.token === token);
  
  if (!user) {
    return res.status(403).json({ error: 'Access Denied: Invalid Unique credentials' });
  }
  req.user = user;
  next();
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANES        = ['N', 'S', 'E', 'W'];
const SNAP_INTERVAL = 5000;   // ms – edge camera snapshot
const TICK_INTERVAL = 1000;   // ms – 1-second world clock
const FAIRNESS_CAP  = 120;    // seconds max wait
const PENALTY_START = 90;     // seconds before exponential penalty
const YELLOW_TIME   = 3;      // seconds (5 in Rain Mode)
const PHASE_GREEN   = 15;     // base green phase duration

const PCE = { ambulance: 999, bus: 10, car: 1, bike: 0.5 };

// ─── State ────────────────────────────────────────────────────────────────────
let state = buildInitialState();
let auditLog = [];
let worldTimer = null;
let overrideMode = 'auto'; // auto | vip | festival | emergency

function buildInitialState() {
  const lanes = {};
  LANES.forEach(id => {
    lanes[id] = {
      id,
      signal: id === 'N' ? 'green' : 'red',
      vehicles: { ambulance: 0, bus: 0, car: 0, bike: 0 },
      density: 0,
      previousDensity: 0,
      staticCycles: 0,
      stagnantGreenCycles: 0,    // Tracks density stagnation across full Green Cycles
      lastRedDensity: 0,         // Snapshot density recorded right as Green ends
      pceScore: 0,
      finalPriority: 0,
      waitTime: 0,
      greenTimer: id === 'N' ? PHASE_GREEN : 0,
      phase: id === 'N' ? 'green' : 'red',
      ghostFlag: false,
    };
  });
  return {
    lanes,
    activeLane: 'N',
    phaseTimer: PHASE_GREEN,
    tick: 0,
    totalVehiclesServed: 0,
    totalAmbulances: 0,
    totalBuses: 0,
    fuelSaved: 0,
    co2Reduced: 0,
    mode: { rain: false, night: false, pedestrian: false },
    alerts: [],
    greenWave: { active: false, source: null, progress: 0 },
  };
}

// ─── PCE Decision Engine ──────────────────────────────────────────────────────
function computePriorities() {
  LANES.forEach(id => {
    const lane = state.lanes[id];
    const { ambulance, bus, car, bike } = lane.vehicles;

    // PCE density score
    lane.density = ambulance * PCE.ambulance + bus * PCE.bus + car * PCE.car + bike * PCE.bike;

    // Wait-Time Penalty (WTP) - Antigravity Logic
    let penalty = 0;
    if (lane.signal === 'red' || lane.signal === 'yellow') {
       penalty = lane.waitTime * 1.5;
    }

    lane.finalPriority = lane.density + penalty;
    lane.pceScore = lane.density;
  });
}

function selectNextLane() {
  // Emergency override: ambulance detected anywhere
  for (const id of LANES) {
    if (state.lanes[id].vehicles.ambulance > 0 && id !== state.activeLane) {
      addAlert('emergency', `🚑 AMBULANCE detected on Lane ${id} — Innuyir Protocol (Instant Green) triggered!`, id);
      state.totalAmbulances++;
      return id;
    }
  }

  // Fairness cap: any lane waiting ≥ FAIRNESS_CAP
  for (const id of LANES) {
    if (id !== state.activeLane && state.lanes[id].waitTime >= FAIRNESS_CAP) {
      addAlert('warning', `⏱️ Fairness Cap (120s) hit for Lane ${id} — forcing Green.`, id);
      return id;
    }
  }

  // Highest final priority
  let best = null, bestScore = -1;
  LANES.forEach(id => {
    if (id !== state.activeLane && state.lanes[id].finalPriority > bestScore) {
      bestScore = state.lanes[id].finalPriority;
      best = id;
    }
  });
  return best || state.activeLane;
}

function switchLane(nextId) {
  if (state.activeLane === nextId) return;

  const yellowTime = state.mode.rain ? 5 : YELLOW_TIME;
  const outgoingId = state.activeLane;
  const outgoingLane = state.lanes[outgoingId];

  // ─── Breakdown/Stall Detection Logic ───
  // If the density hasn't dropped since the LAST time this lane turned Red,
  // vehicles could not pass during this specific Green Phase.
  if (outgoingLane.density > 0 && Math.abs(outgoingLane.density - outgoingLane.lastRedDensity) <= 1) {
    outgoingLane.stagnantGreenCycles++;
    if (outgoingLane.stagnantGreenCycles >= 2) {
       addAlert('breakdown', `🚨 Vehicle Stalled in Lane ${outgoingId}. Engine failure blocking traffic detected. Dispatch assistance to clear junction.`, outgoingId);
       logAudit('STALL_DETECTED', `Vehicle Stall detected on Lane ${outgoingId} over 2 full stagnant green cycles.`);
       outgoingLane.stagnantGreenCycles = 0; // reset to prevent spam
    }
  } else {
    outgoingLane.stagnantGreenCycles = 0;
  }
  outgoingLane.lastRedDensity = outgoingLane.density;
  // ───────────────────────────────────────

  // Set current green → yellow (briefly), then red
  outgoingLane.signal = 'yellow';
  outgoingLane.phase  = 'yellow';

  setTimeout(() => {
    state.lanes[outgoingId].signal = 'red';
    state.lanes[outgoingId].phase  = 'red';
    state.lanes[outgoingId].greenTimer = 0;
    state.lanes[outgoingId].staticCycles = 0;

    // Activate new lane
    state.lanes[nextId].signal    = 'green';
    state.lanes[nextId].phase     = 'green';
    state.lanes[nextId].waitTime  = 0;
    state.lanes[nextId].greenTimer = computeGreenDuration(nextId);
    state.lanes[nextId].staticCycles = 0;
    state.activeLane = nextId;
    state.phaseTimer = state.lanes[nextId].greenTimer;

    broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
  }, yellowTime * 1000);
}

function computeGreenDuration(laneId) {
  const lane = state.lanes[laneId];
  const base = PHASE_GREEN;
  const bonus = Math.min(Math.floor(lane.density / 5), 15);
  return Math.min(base + bonus, 30);
}

// ─── Hardware Data Processor (No Simulation) ───────────────────────────────────
function processEdgeData(laneId, vehicles) {
   const lane = state.lanes[laneId];
   
   // Apply Antigravity Ghost Lane Logic
   const newDensity = vehicles.ambulance * PCE.ambulance + vehicles.bus * PCE.bus + vehicles.car * PCE.car + vehicles.bike * PCE.bike;
   
   if (lane.signal === 'green' && newDensity > 10) {
      if (Math.abs(lane.previousDensity - newDensity) <= 2) {
         lane.staticCycles++;
         if (lane.staticCycles >= 3 && !lane.ghostFlag) { // 3 cycles (e.g. 3 ticks) of same density on green
            lane.ghostFlag = true;
            addAlert('ghost', `👻 Antigravity Ghost Lane detected on Lane ${laneId}! Possible accident/breakdown.`, laneId);
         }
      } else {
         lane.staticCycles = 0;
         lane.ghostFlag = false;
      }
   } else {
      lane.staticCycles = 0;
      lane.ghostFlag = false;
   }
   
   lane.previousDensity = newDensity;
   lane.vehicles = vehicles;
   
   computePriorities();
   broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
}

// ─── World Clock Tick ─────────────────────────────────────────────────────────
function tick() {
  if (!simulationRunning) return;

  state.tick++;
  computePriorities();

  // Update wait times
  LANES.forEach(id => {
    const lane = state.lanes[id];
    if (lane.signal === 'red') {
      lane.waitTime++;
    } else if (lane.signal === 'green') {
      lane.waitTime = 0;
      lane.greenTimer = Math.max(0, lane.greenTimer - 1);
    }
  });

  // Phase management
  state.phaseTimer = Math.max(0, state.phaseTimer - 1);

  if (state.phaseTimer === 0 && overrideMode === 'auto') {
    const nextLane = selectNextLane();
    switchLane(nextLane);
    state.phaseTimer = computeGreenDuration(nextLane);
  }

  // Analytics accumulators (every 5 ticks)
  if (state.tick % 5 === 0) {
    const served = Object.values(state.lanes).reduce((acc, l) => acc + l.vehicles.car + l.vehicles.bus + l.vehicles.bike, 0);
    state.totalVehiclesServed += served;
    state.fuelSaved   = parseFloat((state.totalVehiclesServed * 0.08).toFixed(1));
    state.co2Reduced  = parseFloat((state.fuelSaved * 2.3).toFixed(1));
    state.totalBuses += Object.values(state.lanes).reduce((acc, l) => acc + l.vehicles.bus, 0);
  }

  // Green wave propagation
  if (state.greenWave.active) {
    state.greenWave.progress = Math.min(100, state.greenWave.progress + 2);
    if (state.greenWave.progress >= 100) {
      state.greenWave.active = false;
      addAlert('info', '🌊 Green Wave completed — Junction B prepared.', null);
    }
  }

  broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
}

// ─── Alert Manager ────────────────────────────────────────────────────────────
function addAlert(type, message, laneId) {
  const alert = { id: uuidv4(), type, message, laneId, timestamp: Date.now() };
  state.alerts.unshift(alert);
  if (state.alerts.length > 50) state.alerts.pop();
  broadcast({ type: 'ALERT', payload: alert });
}

// ─── WebSocket Server ─────────────────────────────────────────────────────────
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(data);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'INIT', payload: sanitizeState() }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleClientMessage(msg);
    } catch (e) { /* ignore */ }
  });
});

function handleClientMessage(msg) {
  switch (msg.type) {
    case 'START_SIM':
      simulationRunning = true;
      snapTimer  = setInterval(generateTraffic, SNAP_INTERVAL);
      worldTimer = setInterval(tick, TICK_INTERVAL);
      generateTraffic();
      addAlert('info', '▶ Simulation started — GiveWay engine active.', null);
      break;

    case 'STOP_SIM':
      simulationRunning = false;
      clearInterval(snapTimer);
      clearInterval(worldTimer);
      addAlert('info', '⏸ Simulation paused.', null);
      break;

    case 'RESET_SIM':
      simulationRunning = false;
      clearInterval(snapTimer);
      clearInterval(worldTimer);
      state = buildInitialState();
      auditLog = [];
      overrideMode = 'auto';
      broadcast({ type: 'RESET', payload: sanitizeState() });
      break;

    case 'INJECT_VEHICLE': {
      const { laneId, vehicleType } = msg.payload;
      if (state.lanes[laneId] && PCE[vehicleType] !== undefined) {
        state.lanes[laneId].vehicles[vehicleType]++;
        if (vehicleType === 'ambulance') {
          addAlert('emergency', `🚑 Manual ambulance injected on Lane ${laneId}!`, laneId);
        }
        computePriorities();
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
      break;
    }

    case 'FORCE_GREEN': {
      const { laneId } = msg.payload;
      overrideMode = 'manual';
      switchLane(laneId);
      logAudit('FORCE_GREEN', `Lane ${laneId} forced GREEN by operator.`);
      addAlert('warning', `🎮 Manual override: Lane ${laneId} forced GREEN.`, laneId);
      break;
    }

    case 'FORCE_RED': {
      const { laneId } = msg.payload;
      state.lanes[laneId].signal = 'red';
      state.lanes[laneId].phase  = 'red';
      logAudit('FORCE_RED', `Lane ${laneId} forced RED by operator.`);
      broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      break;
    }

    case 'SET_MODE': {
      const { mode, value } = msg.payload;
      if (mode in state.mode) {
        state.mode[mode] = value;
        addAlert('info', `${value ? '✅ Enabled' : '❌ Disabled'}: ${mode} mode.`, null);
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
      break;
    }

    case 'SET_OVERRIDE_MODE': {
      overrideMode = msg.payload.mode;
      logAudit('MODE_CHANGE', `Override mode set to: ${overrideMode}`);
      if (overrideMode === 'emergency') {
        LANES.forEach(id => { state.lanes[id].signal = 'red'; state.lanes[id].phase = 'red'; });
        addAlert('emergency', '🚨 Emergency All-Stop activated!', null);
      }
      if (overrideMode === 'auto') {
        addAlert('info', '🤖 GiveWay AI control restored.', null);
      }
      broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      break;
    }

    case 'TRIGGER_GREEN_WAVE': {
      state.greenWave = { active: true, source: 'A', progress: 0 };
      addAlert('info', '🌊 Green Wave initiated from Junction A → B → C.', null);
      broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      break;
    }

    case 'GET_AUDIT':
      broadcast({ type: 'AUDIT_LOG', payload: auditLog });
      break;
  }
}

function logAudit(action, details) {
  const entry = { id: uuidv4(), action, details, timestamp: Date.now() };
  auditLog.unshift(entry);
  if (auditLog.length > 200) auditLog.pop();
  
  // Save to persistent secure DB
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 1000) db.auditLogs.pop();
  saveDB();
}

function sanitizeState() {
  return JSON.parse(JSON.stringify(state));
}

// ─── Secure Mobile/Web Auth APIs ──────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { id, pin, role, badge, station, dept, access } = req.body;
  if (!id || !pin || !role) return res.status(400).json({ error: 'Missing core credentials' });
  
  if (db.users.find(u => u.id === id)) {
    return res.status(409).json({ error: 'Unique ID already registered to another officer/admin.' });
  }

  // Generate a confidential access token
  const token = uuidv4() + '-' + Date.now().toString(36);
  
  const newUser = {
    id, pin, role, token,
    name: role === 'police' ? `Officer ${id}` : `${dept} Admin`,
    meta: role === 'police' ? { badge, station } : { dept, access },
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDB();
  
  logAudit('USER_REGISTER', `${newUser.name} registered into the system via ${role} terminal.`);
  
  const { pin: _p, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser, token });
});

app.post('/api/auth/login', (req, res) => {
  const { id, pin } = req.body;
  const user = db.users.find(u => u.id === id && u.pin === pin);
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication Failed: Invalid ID or PIN.' });
  }

  // Rotate token on login for security
  user.token = uuidv4() + '-' + Date.now().toString(36);
  saveDB();

  logAudit('USER_LOGIN', `${user.name} established a secure uplink.`);

  const { pin: _p, ...safeUser } = user;
  res.json({ success: true, user: safeUser, token: user.token });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
  const { pin: _p, ...safeUser } = req.user;
  res.json({ success: true, user: safeUser });
});

// ─── REST APIs ────────────────────────────────────────────────────────────────
app.get('/api/state', requireAuth, (req, res) => res.json(sanitizeState()));
app.get('/api/alerts', requireAuth, (req, res) => res.json(state.alerts));
app.get('/api/audit', requireAuth, (req, res) => res.json(auditLog));

app.get('/api/analytics', (req, res) => {
  const hourly = Array.from({ length: 12 }, (_, i) => ({
    hour: `${String(8 + i).padStart(2, '0')}:00`,
    throughput: Math.floor(Math.random() * 400 + 100 + i * 20),
    giveway: Math.floor(Math.random() * 30 + 15),
    fixed: Math.floor(Math.random() * 50 + 40),
  }));
  res.json({
    hourly,
    vehicleMix: {
      ambulance: state.totalAmbulances,
      bus: state.totalBuses,
      car: Math.floor(state.totalVehiclesServed * 0.6),
      bike: Math.floor(state.totalVehiclesServed * 0.3),
    },
    fuelSaved: state.fuelSaved,
    co2Reduced: state.co2Reduced,
    totalServed: state.totalVehiclesServed,
  });
});

app.post('/api/edge-data', (req, res) => {
  // Expected payload: { laneId: 'N', secret: 'GIVEWAY_NODE_KEY', vehicles: { ambulance:0, bus:1, car:4, bike:3 } }
  const { laneId, secret, vehicles } = req.body;
  if (secret !== 'GIVEWAY_NODE_KEY') return res.status(401).json({ error: 'Unauthorized Node' });
  if (!state.lanes[laneId]) return res.status(400).json({ error: 'Invalid Lane ID' });
  
  // Real-world integration logic routed through Antigravity Processor
  processEdgeData(laneId, vehicles);
  
  res.json({ success: true, newScore: state.lanes[laneId].pceScore });
});

// ─── Frontend React Navigation Fallback ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚦 GiveWay Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
  console.log(`📡 Secure APIs at http://localhost:${PORT}/api\n`);
  console.log(`🌐 Application UI hosted dynamically over the root node path.\n`);
});
