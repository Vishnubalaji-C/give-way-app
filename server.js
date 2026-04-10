/**
 * GiveWay — Adaptive Traffic Equity System
 * Backend: Node.js + Express + ws (WebSocket)
 */

const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const cors   = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const path    = require('path');
const fs      = require('fs');
const dgram   = require('dgram');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve Production React PWA (client/dist) unconditionally
app.use(express.static(path.join(__dirname, 'client/dist')));

// ─── Zero-Cost File-Sync Persistence Layer ─────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');
let db = {
  users: [],
  auditLog: [],
  analytics: {
    hourly: Array.from({length: 12}, (_, i) => ({
      hour: `${String(8 + i).padStart(2, '0')}:00`, throughput: 0, giveway: 0, fixed: 0
    })),
    fuelSaved: 0, co2Reduced: 0, totalServed: 0,
    vehicleMix: { ambulance: 0, bus: 0, car: 0, bike: 0 }
  }
};

try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (err) { console.error('Could not read db.json:', err); }

let saveTimeout = null;
function saveToDisk() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const tempFile = DB_FILE + '.tmp';
    try {
      fs.writeFileSync(tempFile, JSON.stringify(db, null, 2));
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('CRITICAL: Database Atomic Save Failed:', err);
    }
  }, 3000);
}

// Ensure MongoDB Persistence dynamically activates to prevent Cloud Data Loss
if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[DATABASE] Securely connected to MongoDB Atlas!'))
    .catch(console.error);
    
  const GenericDbModel = mongoose.model('MakewayData', new mongoose.Schema({ _id: String, value: Object }, { strict: false }));
  
  // Load state from Mongo if exists
  GenericDbModel.findById('makeway_db').then(doc => {
    if (doc && doc.value) {
      db = doc.value;
      console.log('[DATABASE] Loaded persisted logic from MongoDB Atlas.');
    }
  });

  // Override standard filesystem save with MongoDB Upsert
  saveToDisk = function() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      GenericDbModel.updateOne({ _id: 'makeway_db' }, { value: db }, { upsert: true })
        .catch(err => console.error('CRITICAL: Mongoose Cloud Save Failed:', err));
    }, 3000);
  };
}

// ─── Middleware: Secure Mobile & Web Access ──────────────────────────────────
// Require valid Bearer token for API operations
async function requireAuth(req, res, next) {
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

const PCE = { ambulance: 100, bus: 20, car: 1, bike: 0.5 };

// ─── Multi-Junction Location Registry ─────────────────────────────────────────
// Each deployed hardware set gets a unique junction entry with location metadata
const junctions = {
  'JN-001': {
    id: 'JN-001',
    name: 'Anna Salai - Mount Road',
    zone: 'Zone A — Central Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0604,
    lng: 80.2496,
    poleId: 'POLE-04',
    address: 'Anna Salai & Cathedral Rd Junction, Teynampet',
    status: 'online',
    lastPing: Date.now(),
    deployedAt: '2026-01-15',
    cameraNodes: 4,
  },
  'JN-002': {
    id: 'JN-002',
    name: 'Kathipara Junction',
    zone: 'Zone B — South Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0109,
    lng: 80.2078,
    poleId: 'POLE-12',
    address: 'Kathipara Flyover Junction, Alandur',
    status: 'online',
    lastPing: Date.now(),
    deployedAt: '2026-02-20',
    cameraNodes: 4,
  },
  'JN-003': {
    id: 'JN-003',
    name: 'Tidel Park Signal',
    zone: 'Zone C — IT Corridor',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 12.9878,
    lng: 80.2465,
    poleId: 'POLE-07',
    address: 'Rajiv Gandhi Salai (OMR), Taramani',
    status: 'online',
    lastPing: Date.now(),
    deployedAt: '2026-03-10',
    cameraNodes: 4,
  },
  'JN-004': {
    id: 'JN-004',
    name: 'Koyambedu Junction',
    zone: 'Zone D — West Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0694,
    lng: 80.1948,
    poleId: 'POLE-02',
    address: 'Koyambedu CMBT Signal, Koyambedu',
    status: 'offline',
    lastPing: Date.now() - 600000,
    deployedAt: '2026-03-25',
    cameraNodes: 4,
  },
};

let activeJunction = 'JN-001'; // Currently viewed junction

// ─── State ────────────────────────────────────────────────────────────────────
let simulationRunning = false;
let overrideMode = 'auto'; // auto | vip | festival | emergency

let uplinkToken = uuidv4().substring(0, 8).toUpperCase(); // 8-character secure sync token
setInterval(() => {
  uplinkToken = uuidv4().substring(0, 8).toUpperCase();
}, 300000); // Rotates every 5 minutes

let state = buildInitialState();
let auditLog = db.auditLog;
let worldTimer = null;
let snapTimer = null;

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
      isEmergency: false,
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
    junction: junctions[activeJunction] || junctions['JN-001'],
    simulationRunning,
    overrideMode,
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
      state.lanes[id].isEmergency = true;
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
    state.lanes[nextId].isEmergency = false; // Reset on green entry
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
   lane.isEmergency = vehicles.ambulance > 0;
   
   computePriorities();
   broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
}

// ─── Traffic Simulation Generator (Demo / Dashboard Testing) ──────────────────
function generateTraffic() {
  if (!simulationRunning) return;

  LANES.forEach(id => {
    const lane = state.lanes[id];
    // Generate realistic random vehicle counts for simulation
    const vehicles = {
      ambulance: Math.random() < 0.03 ? 1 : 0,   // 3% chance of ambulance
      bus:       Math.floor(Math.random() * 3),     // 0-2 buses
      car:       Math.floor(Math.random() * 12 + 1),// 1-12 cars
      bike:      Math.floor(Math.random() * 8),     // 0-7 bikes
    };
    processEdgeData(id, vehicles);
  });
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
      if (!simulationRunning) {
        simulationRunning = true;
        clearInterval(snapTimer);
        clearInterval(worldTimer);
        snapTimer  = setInterval(generateTraffic, SNAP_INTERVAL);
        worldTimer = setInterval(tick, TICK_INTERVAL);
        generateTraffic();
        addAlert('info', '▶ Simulation started — GiveWay engine active.', null);
      }
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

    case 'REQUEST_PED_CROSSING': {
      overrideMode = 'pedestrian';
      logAudit('PED_CROSSING_REQ', 'Virtual Pedestrian request activated via Mobile Edge.');
      addAlert('ghost', '🚶‍♂️ Pedestrian Crossing Requested. Forcing All-Red Phase safely (15s).', null);
      
      LANES.forEach(id => {
        state.lanes[id].signal = 'red';
        state.lanes[id].phase = 'red';
      });
      broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });

      // Automatically release back to AI after 15 seconds
      setTimeout(() => {
        if (overrideMode === 'pedestrian') {
          overrideMode = 'auto';
          addAlert('info', '🤖 Pedestrian Phase Over. GiveWay AI resumed control.', null);
          broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
        }
      }, 15000);
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
  
  // Save to persistent file DB asynchronously
  db.auditLog.unshift(entry);
  if (db.auditLog.length > 500) db.auditLog.pop();
  saveToDisk();
}

function sanitizeState() {
  return {
    ...JSON.parse(JSON.stringify(state)),
    simulationRunning,
    overrideMode
  };
}

// ─── Secure Mobile/Web Auth APIs (JSON System) ────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { id, pin, role, badge, station, dept, access, fullName } = req.body;
  if (!id || !pin || !role) return res.status(400).json({ error: 'Missing core credentials' });
  
  if (db.users.find(u => u.id === id)) {
    return res.status(409).json({ error: 'This Unique ID is already registered. Please choose a different Officer/Admin ID.' });
  }

  if (role === 'police' && badge && db.users.find(u => u.meta?.badge === badge)) {
    return res.status(409).json({ error: 'This Badge Number is already assigned to another active officer.' });
  }

  const token = uuidv4() + '-' + Date.now().toString(36);
  const newUserParams = {
    id, pin, role, token,
    name: fullName ? fullName : (role === 'police' ? `Officer ${id}` : `${dept} Admin`),
    meta: role === 'police' ? { badge, station } : { dept, access },
    createdAt: new Date().toISOString()
  };

  db.users.push(newUserParams);
  saveToDisk();
  
  logAudit('USER_REGISTER', `${newUserParams.name} registered into the system via ${role} terminal.`);
  const { pin: _p, ...safeUser } = newUserParams;
  res.json({ success: true, user: safeUser, token });
});

app.post('/api/auth/login', async (req, res) => {
  const { id, pin } = req.body;
  const user = db.users.find(u => u.id === id && u.pin === pin);
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication Failed: Invalid ID or PIN.' });
  }

  user.token = uuidv4() + '-' + Date.now().toString(36);
  saveToDisk();

  logAudit('USER_LOGIN', `${user.name} established a secure uplink.`);
  const { pin: _p, ...safeUser } = user;
  res.json({ success: true, user: safeUser, token: user.token });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
  const { pin, ...safeUser } = req.user;
  res.json({ success: true, user: safeUser });
});

// ─── Secure QR Discovery API ──────────────────────────────────────────────────
app.get('/api/sync/token', (req, res) => {
  // Returns current IP (detected or from env) and the active uplink token
  const os = require('os');
  const networks = os.networkInterfaces();
  let localIp = '127.0.0.1';
  
  // Find typical local WiFi/Ethernet IP
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }

  res.json({
    success: true,
    ip: localIp,
    port: PORT,
    token: uplinkToken,
    sig: Buffer.from(process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY').toString('base64')
  });
});

// ─── REST APIs ────────────────────────────────────────────────────────────────
app.get('/api/state', requireAuth, (req, res) => res.json(sanitizeState()));
app.get('/api/alerts', requireAuth, (req, res) => res.json(state.alerts));
app.get('/api/audit', requireAuth, (req, res) => res.json(auditLog));

app.get('/api/analytics', (req, res) => {
  res.json({
    hourly: db.analytics.hourly,
    vehicleMix: {
      ambulance: state.totalAmbulances + (db.analytics.vehicleMix?.ambulance || 0),
      bus: state.totalBuses + (db.analytics.vehicleMix?.bus || 0),
      car: Math.floor(state.totalVehiclesServed * 0.6) + (db.analytics.vehicleMix?.car || 0),
      bike: Math.floor(state.totalVehiclesServed * 0.3) + (db.analytics.vehicleMix?.bike || 0),
    },
    fuelSaved: state.fuelSaved + (db.analytics.fuelSaved || 0),
    co2Reduced: state.co2Reduced + (db.analytics.co2Reduced || 0),
    totalServed: state.totalVehiclesServed + (db.analytics.totalServed || 0),
  });
});

// ─── Secure Edge Data Rate Limiting ───────────────────────────────────────────
const edgeRequestLog = new Map(); // tracks last request per junction/lane

app.post('/api/edge-data', (req, res) => {
  // Expected payload: { laneId: 'N', secret: 'GIVEWAY_NODE_KEY', junctionId: 'JN-001', vehicles: { ambulance:0, bus:1, car:4, bike:3 } }
  const { laneId, secret, vehicles, junctionId } = req.body;
  
  if (secret !== (process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY')) {
    return res.status(401).json({ error: 'Unauthorized Node Access' });
  }
  
  const now = Date.now();
  const requestId = `${junctionId}-${laneId}`;
  
  // Rate-limiting: Max 1 request per 1.5 seconds per node
  if (edgeRequestLog.has(requestId) && (now - edgeRequestLog.get(requestId)) < 1500) {
    return res.status(429).json({ error: 'System busy: Node rate limit exceeded' });
  }
  edgeRequestLog.set(requestId, now);

  if (!state.lanes[laneId]) return res.status(400).json({ error: 'Invalid Lane ID' });
  
  // Update junction heartbeat if junctionId provided
  if (junctionId && junctions[junctionId]) {
    junctions[junctionId].lastPing = now;
    junctions[junctionId].status = 'online';
  }
  
  // Real-world integration logic routed through Antigravity Processor
  processEdgeData(laneId, vehicles);
  
  res.json({ success: true, newScore: state.lanes[laneId].pceScore, junction: junctionId });
});

// ─── Junction Location APIs ───────────────────────────────────────────────────
app.get('/api/junctions', (req, res) => {
  // Mark junctions as offline if no ping in 5 minutes
  Object.values(junctions).forEach(j => {
    if (Date.now() - j.lastPing > 300000) j.status = 'offline';
  });
  res.json(Object.values(junctions));
});

app.get('/api/junctions/:id', (req, res) => {
  const junction = junctions[req.params.id];
  if (!junction) return res.status(404).json({ error: 'Junction not found' });
  res.json(junction);
});

app.post('/api/junctions/switch', requireAuth, (req, res) => {
  const { junctionId } = req.body;
  if (!junctions[junctionId]) return res.status(404).json({ error: 'Junction not found' });
  activeJunction = junctionId;
  state.junction = junctions[activeJunction];
  broadcast({ type: 'JUNCTION_SWITCH', payload: { junction: junctions[activeJunction], state: sanitizeState() } });
  logAudit('JUNCTION_SWITCH', `Switched monitoring to ${junctions[activeJunction].name} (${junctionId})`);
  res.json({ success: true, junction: junctions[activeJunction] });
});

// ─── Frontend React Navigation Fallback ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 MakeWay Advanced ATES Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket Gateway: ws://localhost:${PORT}`);
});

// ─── Secure Auto-Discovery Heartbeat (Software-Side) ──────────────────────────
const DISCOVERY_PORT = 5000;
const udpSocket = dgram.createSocket('udp4');

udpSocket.on('error', (err) => {
  console.error(`[UDP] Discovery Socket Error: ${err.message}`);
});

setInterval(() => {
  try {
    const heartbeat = JSON.stringify({
      service: 'GIVEWAY_MASTER',
      port: PORT,
      // The "Signature" for privacy/security
      sig: Buffer.from(process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY').toString('base64'),
      timestamp: Date.now()
    });
    const message = Buffer.from(heartbeat);
    udpSocket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255');
  } catch (e) { /* ignore broadcast errors */ }
}, 3000);

udpSocket.on('listening', () => {
  udpSocket.setBroadcast(true);
  console.log(`📡 Secure Heartbeat Active on UDP Port ${DISCOVERY_PORT}`);
});

udpSocket.bind(DISCOVERY_PORT);
