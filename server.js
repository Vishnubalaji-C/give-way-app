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
const os      = require('os');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4000',
  'https://give-way-app.onrender.com',
  'https://give-way-app.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all in a frictionless/local setting
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true
}));

app.use(express.json());

// ─── Early Request Logger ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!req.path.includes('assets')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  }
  next();
});

// ─── Status & Connectivity Monitoring ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'GiveWay-ATES-Master',
    build: '2026.04.11',
    junction: activeJunction
  });
});

// Primary and Fallback Health Routes for Production Monitoring
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'online',
    system: 'GiveWay-ATES',
    junction: activeJunction,
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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
    vehicleMix: { ambulance: 0, bus: 0, car: 0, bike: 0, lorry: 0 }
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
    .then(() => console.log('🚀 [DATABASE] Securely connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ [DATABASE] Connection Failure:', err));
    
  const GenericDbModel = mongoose.model('GiveWayData', new mongoose.Schema({ _id: String, value: Object }, { strict: false }));
  
  // Load state from Mongo if exists
  GenericDbModel.findById('giveway_db').then(doc => {
    if (doc && doc.value) {
      db = doc.value;
      console.log('[DATABASE] Loaded persisted logic from MongoDB Atlas.');
    }
  });

  // Override standard filesystem save with MongoDB Upsert
  saveToDisk = function() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      GenericDbModel.updateOne({ _id: 'giveway_db' }, { value: db }, { upsert: true })
        .catch(err => console.error('CRITICAL: Mongoose Cloud Save Failed:', err));
    }, 3000);
  };
}

// Provision Demo/Guest Account if not exists
function ensureGuestAccount() {
  const GUEST_ID = 'admin';
  const GUEST_PIN = '1234';
  if (!db.users.find(u => String(u.id) === GUEST_ID)) {
    const guestUser = {
      id: GUEST_ID,
      pin: GUEST_PIN,
      role: 'admin',
      token: 'demo-guest-token-' + Date.now().toString(36),
      name: 'Guest Admin',
      meta: { dept: 'System Demo', access: 'All' },
      createdAt: new Date().toISOString()
    };
    db.users.push(guestUser);
    console.log('🛡️ [AUTH] Provisioned Guest Admin for seamless demo access.');
    saveToDisk();
  }
}
ensureGuestAccount();

// ─── Identity & Global Authorization API ──────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { id, pin, role, fullName, badge, station, dept, access } = req.body;
  
  if (!id || !pin) {
    return res.status(400).json({ success: false, error: 'Identity ID and PIN are required for authorization.' });
  }

  const existing = db.users.find(u => String(u.id) === String(id));
  if (existing) {
    return res.status(400).json({ success: false, error: 'Identity ID already registered in GiveWay Matrix.' });
  }

  const newUser = {
    id,
    pin,
    role: role || 'police',
    name: fullName || (role === 'admin' ? 'Admin User' : 'Police Officer'),
    meta: { badge, station, dept, access },
    token: uuidv4(),
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveToDisk();

  console.log(`👤 [AUTH] New Identity Initialized: ${newUser.id} (${newUser.role.toUpperCase()})`);
  res.json({ success: true, user: { id: newUser.id, role: newUser.role, name: newUser.name } });
});

app.post('/api/auth/login', (req, res) => {
  const { id, pin } = req.body;
  const user = db.users.find(u => String(u.id) === String(id) && String(u.pin) === String(pin));

  if (!user) {
    return res.status(401).json({ success: false, error: 'Authorization Failed: Identity or PIN invalid.' });
  }

  console.log(`🔓 [AUTH] Terminal Access Granted: ${user.id} (${user.role.toUpperCase()})`);
  res.json({
    success: true,
    token: user.token,
    user: { id: user.id, role: user.role, name: user.name, meta: user.meta }
  });
});

app.patch('/api/auth/role', (req, res) => {
  const { role } = req.body;
  // In a real app, we'd verify the token. Here, we'll just allow the persona switch for the demo.
  if (!['admin', 'police'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid persona context.' });
  }

  console.log(`📡 [AUTH] Persona Context Switched to: ${role.toUpperCase()}`);
  res.json({ success: true, user: { role } });
});

// ─── Middleware: Secure Mobile & Web Access ──────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────
const LANES        = ['1', '2', '3'];
const SNAP_INTERVAL = 5000;   // ms – edge camera snapshot
const TICK_INTERVAL = 1000;   // ms – 1-second world clock
const FAIRNESS_CAP  = 120;    // seconds max wait
const PENALTY_START = 90;     // seconds before exponential penalty
const YELLOW_TIME   = 3;      // seconds (5 in Rain Mode)
const ALL_RED_TIME  = 2;      // professional safety clearance (NEW)
const PHASE_GREEN   = 10;     // base green phase duration (shorter for faster rotation)

const PCE = { ambulance: 500, bus: 15, car: 1, bike: 0.5, lorry: 8 };

// ─── External API Keys & Data Source State ────────────────────────────────────
const TOMTOM_KEY = process.env.TOMTOM_API_KEY || '';
const OWM_KEY    = process.env.OWM_API_KEY    || '';
let   dataSource = 'paused'; // 'live' | 'pattern' | 'paused'
let   apiStatus  = { tomtom: false, weather: false, lastFetch: null };

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
    cameraNodes: 3,
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
    cameraNodes: 3,
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
    cameraNodes: 3,
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
    cameraNodes: 3,
  },
};

// ─── Hardware Architecture (Physical Bridge) ──────────────────────────────────
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
const IS_CLOUD    = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
let arduinoPort   = null;
let parser        = null;

if (!IS_CLOUD) {
  try {
    arduinoPort = new SerialPort({ path: SERIAL_PORT, baudRate: 115200, autoOpen: true });
    parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    console.log(`🔌 [HARDWARE] Physical Bridge Active on ${SERIAL_PORT}`);
  } catch (err) {
    console.warn(`⚠️ [HARDWARE] Serial Bridge disconnected: ${err.message}. Running in Cloud-Virtual mode.`);
  }
} else {
  console.log('☁️ [HARDWARE] Cloud deployment detected. Serial Bridge disabled — running in Virtual mode.');
}

function sendToArduino(lane, action) {
  if (!arduinoPort || !arduinoPort.writable) return;
  const cmd = `${lane}${action}\n`;
  arduinoPort.write(cmd);
}

if (parser) {
  parser.on('data', (data) => {
    const line = data.toString().trim();
    if (!line) return;

    if (line.startsWith('HW_RFID:')) {
      const parts = line.split(':');
      const laneId = parts[1];
      const tagID  = parts[2];
      if (state.lanes[laneId]) {
        state.lanes[laneId].priorityTrigger = true;
        addAlert('emergency', `🚨 [HARDWARE] Authorized Priority Tag: ${tagID} on Lane ${laneId}`, laneId);
        computePriorities();
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
    }

    if (line.startsWith('HW_PULSE:')) {
      const parts = line.split(':');
      const laneId = parts[1];
      const density = parseInt(parts[2]);
      if (state.lanes[laneId]) {
        state.lanes[laneId].density = density;
        state.lanes[laneId].lastHardwareUpdate = Date.now();
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
    }
  });
}

let activeJunction = 'JN-001'; // Currently viewed junction

// ─── State ────────────────────────────────────────────────────────────────────
let simulationRunning = false;
let overrideMode = 'auto'; // auto | vip | festival | emergency

let uplinkToken = uuidv4().substring(0, 8).toUpperCase(); // 8-character secure sync token
setInterval(() => {
  uplinkToken = uuidv4().substring(0, 8).toUpperCase();
}, 300000); 

// ─── Direct Mobile Sync API ───────────────────────────────────────────────────
app.get('/api/sync/token', (req, res) => {
  const localIp = getLocalIp();
  res.json({
    success: true,
    ip: localIp,
    port: PORT,
    sig: process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY',
    token: uplinkToken,
    // Add a Direct Link for phone cameras to scan
    directUrl: `http://${localIp}:${PORT}`
  });
});

let state = buildInitialState(db.analytics);
let auditLog = db.auditLog;
let worldTimer       = null;
let snapTimer        = null;
let weatherPollTimer = null;

// ─── Arduino Physical Bridge ───────────────────────────────────────────────────
let arduinoPort = null;

async function connectArduino() {
  try {
    const ports = await SerialPort.list();
    // Auto-detect Arduino boards based on manufacturer or known USB chips
    const portInfo = ports.find(p => p.manufacturer?.includes('Arduino') || p.manufacturer?.includes('CH340') || p.manufacturer?.includes('FTDI')) || ports[0];
    
    if (portInfo) {
      arduinoPort = new SerialPort({ path: portInfo.path, baudRate: 115200 });
      const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      console.log(`🔌 [HARDWARE] Physical Bridge Active on ${portInfo.path}`);
      
      parser.on('data', (data) => {
        const line = data.trim();
        if (!line) return;

        // --- Handle Physical RFID Scans (Lanes 1 & 2) ---
        if (line.startsWith('HW_RFID:')) {
          const parts = line.split(':');
          const laneId = parts[1];
          const tagId = parts[2];
          
          if (state.lanes[laneId]) {
            state.lanes[laneId].priorityTrigger = true;
            addAlert('emergency', `📇 [HARDWARE RFID] Priority Tag Scanned: ${tagId} on Lane ${laneId}!`, laneId);
            computePriorities();
            broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
            
            // Auto-reset trigger after 10s if not already cleared
            setTimeout(() => {
              if (state.lanes[laneId]) state.lanes[laneId].priorityTrigger = false;
            }, 10000);
          }
        }

        // --- Handle Physical ESP32 Pulses (Lane 3) ---
        if (line.startsWith('HW_PULSE:')) {
          const parts = line.split(':');
          const laneId = parts[1];
          const density = parseInt(parts[2]);

          if (state.lanes[laneId]) {
            // Map pulse to vehicle counts for Lane 3
            // 5 = Low, 15 = Med, 30 = High
            const mockVehicles = {
               ambulance: 0,
               bus: density > 20 ? 2 : (density > 10 ? 1 : 0),
               car: Math.floor(density / 2),
               bike: Math.floor(density / 3),
               lorry: 0
            };
            processEdgeData(laneId, mockVehicles);
          }
        }
      });

      arduinoPort.on('error', err => console.log('Arduino Error: ', err.message));
    } else {
      console.log('🔌 [HARDWARE] No Arduino detected. Running in software-only mode.');
    }
  } catch (err) {
    console.log('🔌 [HARDWARE] Serial probe failed:', err.message);
  }
}
connectArduino();

function sendToArduino(laneId, action) {
  if (arduinoPort && arduinoPort.isOpen) {
    arduinoPort.write(`${laneId}${action}\n`); // e.g., "1G", "2Y", "3R"
  }
}

function buildInitialState(persisted = null) {
  const lanes = {};
  LANES.forEach(id => {
    lanes[id] = {
      id,
      signal: id === '1' ? 'green' : 'red',
      vehicles: { ambulance: 0, bus: 0, car: 0, bike: 0, lorry: 0 },
      density: 0,
      previousDensity: 0,
      staticCycles: 0,
      stagnantGreenCycles: 0,
      lastRedDensity: 0,
      pceScore: 0,
      finalPriority: 0,
      waitTime: 0,
      greenTimer: id === '1' ? PHASE_GREEN : 0,
      phase: id === '1' ? 'green' : 'red',
      ghostFlag: false,
      densityLastChangedAt: Date.now(),
      lastHardwareUpdate: Date.now(),
      fallbackActive: false,
      isEmergency: false,
      isPedestrian: false,
      priorityTrigger: false
    };
  });
  return {
    lanes,
    activeLane: '1',
    phaseTimer: PHASE_GREEN,
    tick: 0,
    totalVehiclesServed: persisted?.totalServed || 0,
    totalAmbulances: persisted?.vehicleMix?.ambulance || 0,
    totalBuses: persisted?.vehicleMix?.bus || 0,
    totalCars: persisted?.vehicleMix?.car || 0,
    totalBikes: persisted?.vehicleMix?.bike || 0,
    totalLorry: persisted?.vehicleMix?.lorry || 0,
    fuelSaved: persisted?.fuelSaved || 0,
    co2Reduced: persisted?.co2Reduced || 0,
    mode: { rain: false, night: false, pedestrian: false },
    alerts: [],
    greenWave: { active: false, source: null, progress: 0 },
    junction: junctions[activeJunction] || junctions['JN-001'],
    simulationRunning,
    overrideMode,
    isCongested: false,
    isSwitching: false, // Prevents signal race conditions
  };
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// ─── GiveWay Decision Engine ──────────────────────────────────────────────────
function computePriorities() {
  LANES.forEach(id => {
    const lane = state.lanes[id];
    const { ambulance, bus, car, bike, lorry } = lane.vehicles;
    
    // PCE density score
    lane.density = ambulance * PCE.ambulance + bus * PCE.bus + car * PCE.car + bike * PCE.bike + (lorry || 0) * PCE.lorry;

    // Wait-Time Penalty (WTP)
    let penalty = 0;
    if (lane.signal === 'red' || lane.signal === 'yellow') {
       penalty = lane.waitTime * 1.5;
    }

    // --- CORNER-TO-CORNER FIX: GHOST LANE RECOVERY ---
    // Penalize priority by 50% if an accident (Ghost Lane) is detected
    // This stops the system from staying green on a blocked lane
    lane.finalPriority = (lane.density + penalty) * (lane.ghostFlag ? 0.3 : 1.0);
    
    lane.pceScore = lane.density;
  });

  // Global Congestion Detection (Threshold: 30 PCE)
  const CONGESTION_LEVEL = 30;
  const allCongested = LANES.every(id => state.lanes[id].density > CONGESTION_LEVEL);
  
  if (allCongested && !state.isCongested) {
    state.isCongested = true;
    addAlert('warning', '🚦 GRIDLOCK: Heavy traffic in all directions. ID-Priority Mode active.', null);
  } else if (!allCongested && state.isCongested) {
    state.isCongested = false;
  }
}

function selectNextLane() {
  // ADAPTIVE PRIORITY: Select the "Top Traffic" lane based on PCE and Wait Time
  const candidates = LANES.filter(id => id !== state.activeLane);
  
  // Sort by finalPriority (Density + Wait Time Penalty)
  // This ensures we give priority to heavy lanes but also prevents starving quiet ones
  candidates.sort((a, b) => state.lanes[b].finalPriority - state.lanes[a].finalPriority);
  
  const winner = candidates[0];
  console.log(`🤖 [AI] Next Priority Selection: Lane ${winner} (Score: ${Math.round(state.lanes[winner].finalPriority)})`);
  
  return winner;
}

function switchLane(nextId) {
  if (state.activeLane === nextId || state.isSwitching) return;

  const yellowTime = state.mode.rain ? 5 : YELLOW_TIME;
  const outgoingId = state.activeLane;
  const outgoingLane = state.lanes[outgoingId];

  // 1. Lock system to prevent race conditions
  state.isSwitching = true;

  // 1. Enter Yellow Transition
  outgoingLane.signal = 'yellow';
  outgoingLane.phase  = 'yellow';
  state.phaseTimer    = yellowTime; 
  sendToArduino(outgoingId, 'Y'); 
  broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });

  setTimeout(() => {
    // 2. CORNER-TO-CORNER FIX: All-Red Safety Clearance
    // Set BOTH lanes to red for a brief moment
    outgoingLane.signal = 'red';
    outgoingLane.phase  = 'red';
    sendToArduino(outgoingId, 'R');
    
    state.phaseTimer = ALL_RED_TIME;
    console.log("🚦 [SAFETY] All-Red Clearance active.");
    broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });

    setTimeout(() => {
      // 3. Activate new lane
      state.lanes[nextId].signal    = 'green';
      state.lanes[nextId].phase     = 'green';
      state.lanes[nextId].waitTime  = 0;
      state.lanes[nextId].greenTimer = computeGreenDuration(nextId);
      state.lanes[nextId].staticCycles = 0;
      state.lanes[nextId].isEmergency = false; 
      state.activeLane = nextId;
      state.phaseTimer = state.lanes[nextId].greenTimer;
      
      // Release the lock
      state.isSwitching = false;

      sendToArduino(nextId, 'G'); 
      broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
    }, ALL_RED_TIME * 1000);

  }, yellowTime * 1000);
}

function computeGreenDuration(laneId) {
  const lane = state.lanes[laneId];
  const base = PHASE_GREEN;
  const pceValue = lane.density || 0;
  
  // Bonus time: 1 second per 2 PCE units, capped strictly.
  const bonus = Math.floor(pceValue / 2);
  const total = base + bonus;
  
  // USER REQUIREMENT: Cut-off must be 30 seconds maximum
  return Math.min(total, 30);
}

// ─── Hardware Data Processor (No Simulation) ───────────────────────────────────
function processEdgeData(laneId, vehicles) {
   const lane = state.lanes[laneId];
   
   // Apply Antigravity Ghost Lane Logic
   const newDensity = vehicles.ambulance * PCE.ambulance + 
                      vehicles.bus * PCE.bus + 
                      vehicles.car * PCE.car + 
                      vehicles.bike * PCE.bike + 
                      (vehicles.lorry || 0) * PCE.lorry;
   
    // Intelligence Resilience Update
    lane.lastHardwareUpdate = Date.now();
    if (Math.abs(lane.density - newDensity) > 2) {
       lane.densityLastChangedAt = Date.now();
    }

    lane.previousDensity = newDensity;
    lane.vehicles = vehicles;
    lane.isEmergency = (vehicles.ambulance > 0);
    
    // Store Pedestrian & Priority state
    if (vehicles.pedestrian && !lane.isPedestrian) {
       addAlert('ghost', `🚶‍♂️ Pedestrian detected on Lane ${laneId}! Entering Safety Mode.`, laneId);
    }
    lane.isPedestrian = vehicles.pedestrian || false;

    computePriorities();
    broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
}

// ─── Time-of-Day Traffic Pattern Engine (Chennai-specific) ───────────────────
// Returns 0.2–1.0 based on real Chennai traffic rhythm — used as fallback/baseline
function getTimeOfDayMultiplier() {
  const hour = new Date().getHours();
  if (hour >= 7  && hour < 10) return 1.0;   // Morning rush
  if (hour >= 10 && hour < 12) return 0.65;  // Mid-morning
  if (hour >= 12 && hour < 14) return 0.75;  // Lunch peak
  if (hour >= 14 && hour < 17) return 0.55;  // Afternoon lull
  if (hour >= 17 && hour < 20) return 1.0;   // Evening rush (heaviest)
  if (hour >= 20 && hour < 23) return 0.45;  // Night wind-down
  return 0.2;                                 // Late night / early morning
}

// ─── Speed Ratio → PCE Vehicle Count Mapper ──────────────────────────────────
// speedRatio = TomTom currentSpeed / freeFlowSpeed  (lower → more congested)
function speedRatioToVehicles(speedRatio, multiplier, laneIndex) {
  const congestion = Math.max(0, Math.min(1, 1 - speedRatio));
  const seed = (laneIndex + 1) * 0.15; // per-lane directional variation
  return {
    ambulance: Math.random() < (congestion > 0.8 ? 0.08 : 0.02) ? 1 : 0,
    bus:       Math.max(0, Math.round((1 + congestion * 3 + seed) * multiplier)),
    car:       Math.max(1, Math.round((3 + congestion * 14 + seed * 2) * multiplier)),
    bike:      Math.max(0, Math.round((2 + congestion * 7  + seed) * multiplier)),
    lorry:     Math.max(0, Math.round((congestion * 4 + seed * 0.5) * multiplier)),
  };
}

// ─── Live Traffic Data Fetcher (TomTom API → Time-of-Day fallback) ─────────────
async function fetchLiveTrafficData() {
  if (!simulationRunning) return;
  const jn = junctions[activeJunction];
  if (!jn) return;

  const multiplier = getTimeOfDayMultiplier();

  // Each lane maps to a slightly different GPS coordinate (approach directions)
  const laneCoords = [
    { lat: jn.lat - 0.0008, lng: jn.lng           }, // Lane 1 – South approach
    { lat: jn.lat,          lng: jn.lng + 0.0008  }, // Lane 2 – East approach
    { lat: jn.lat,          lng: jn.lng - 0.0008  }, // Lane 3 – West approach
  ];

  for (let i = 0; i < LANES.length; i++) {
    const laneId = LANES[i];
    const { lat, lng } = laneCoords[i];
    let resolved = false;

    if (TOMTOM_KEY) {
      try {
        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lng}&key=${TOMTOM_KEY}`;
        const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const seg  = data?.flowSegmentData;
          if (seg && seg.freeFlowSpeed > 0) {
            const ratio    = seg.currentSpeed / seg.freeFlowSpeed;
            const vehicles = speedRatioToVehicles(ratio, multiplier, i);
            processEdgeData(laneId, vehicles);
            resolved = true;
            apiStatus.tomtom  = true;
            apiStatus.lastFetch = Date.now();
            dataSource = 'live';
          }
        }
      } catch (_) {
        apiStatus.tomtom = false;
      }
    }

    if (!resolved) {
      // Time-of-day pattern engine: deterministic ratio derived from hour + lane variance
      const hour  = new Date().getHours();
      const base  = 0.40 + (getTimeOfDayMultiplier() * 0.45);
      const noise = (Math.sin(Date.now() / 30000 + i) + 1) / 2 * 0.15; // slow drift
      const patternRatio = Math.min(1, base + noise);
      processEdgeData(laneId, speedRatioToVehicles(patternRatio, multiplier, i));
      dataSource = 'pattern';
      apiStatus.lastFetch = Date.now();
    }
  }
}

// ─── OpenWeatherMap Auto Weather-Mode Sync ─────────────────────────────────────
async function fetchWeatherData() {
  const jn = junctions[activeJunction];
  if (!jn || !OWM_KEY) return;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${jn.lat}&lon=${jn.lng}&appid=${OWM_KEY}&units=metric`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const data = await res.json();
    const weatherId      = data?.weather?.[0]?.id ?? 800;
    const hour           = new Date().getHours();
    const isRaining      = weatherId >= 200 && weatherId < 700;
    const isNight        = hour >= 22 || hour < 6;
    const isThunderstorm = weatherId >= 200 && weatherId < 300;

    if (isRaining !== state.mode.rain) {
      state.mode.rain = isRaining;
      addAlert('info', isRaining
        ? `🌧️ WeatherSync: Rain detected at ${jn.name}. Yellow time extended to 5s.`
        : `☀️ WeatherSync: Conditions cleared. Normal timing restored.`, null);
    }
    if (isNight !== state.mode.night) {
      state.mode.night = isNight;
      addAlert('info', isNight
        ? `🌙 WeatherSync: Night mode active — sparse traffic expected.`
        : `🌅 WeatherSync: Day mode restored.`, null);
    }
    if (isThunderstorm) {
      addAlert('warning', `⛈️ Thunderstorm alert at ${jn.name}! Caution advised.`, null);
    }
    apiStatus.weather = true;
    broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
    console.log(`[WEATHER] ${jn.name}: ${data.weather[0].description}, ${data.main.temp}°C`);
  } catch (err) {
    apiStatus.weather = false;
    console.warn('[WEATHER] OpenWeatherMap unavailable:', err.message);
  }
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
  }

  // Analytics accumulators (every 5 ticks)
  if (state.tick % 5 === 0) {
    const served = Object.values(state.lanes).reduce((acc, l) => acc + l.vehicles.car + l.vehicles.bus + l.vehicles.bike + l.vehicles.ambulance, 0);
    state.totalVehiclesServed += served;
    state.fuelSaved   = parseFloat((state.totalVehiclesServed * 0.08).toFixed(1));
    state.co2Reduced  = parseFloat((state.fuelSaved * 2.3).toFixed(1));
    state.totalBuses += Object.values(state.lanes).reduce((acc, l) => acc + (l.vehicles.bus || 0), 0);
    state.totalAmbulances += Object.values(state.lanes).reduce((acc, l) => acc + (l.vehicles.ambulance || 0), 0);
    state.totalCars += Object.values(state.lanes).reduce((acc, l) => acc + (l.vehicles.car || 0), 0);
    state.totalBikes += Object.values(state.lanes).reduce((acc, l) => acc + (l.vehicles.bike || 0), 0);
    state.totalLorry += Object.values(state.lanes).reduce((acc, l) => acc + (l.vehicles.lorry || 0), 0);
    
    // Sync to persistent DB store
    db.analytics.totalServed = state.totalVehiclesServed;
    db.analytics.fuelSaved   = state.fuelSaved;
    db.analytics.co2Reduced  = state.co2Reduced;
    db.analytics.vehicleMix = {
      ambulance: state.totalAmbulances,
      bus: state.totalBuses,
      car: state.totalCars,
      bike: state.totalBikes,
      lorry: state.totalLorry
    };
    saveToDisk();
  }

  // Green wave propagation
  if (state.greenWave.active) {
    state.greenWave.progress = Math.min(100, state.greenWave.progress + 2);
    if (state.greenWave.progress >= 100) {
      state.greenWave.active = false;
      addAlert('info', '🌊 Green Wave completed — Junction B prepared.', null);
    }
  }

  // ─── Resilience & Error Recovery Logic ──────────────────────────────────────
  const NOW = Date.now();
  
  LANES.forEach(id => {
    const lane = state.lanes[id];

    // 1. Predictive Ghost Lane Detection (10s Static Window)
    if (simulationRunning && lane.signal === 'green' && lane.density > 10) {
      const densityChanged = Math.abs(lane.density - (lane.previousDensity || 0)) > 2;
      
      if (densityChanged) {
        lane.densityLastChangedAt = NOW;
        if (lane.ghostFlag) {
           lane.ghostFlag = false;
           console.log(`✅ [RECOVERY] Lane ${id} has moved. Clearing Ghost alert.`);
        }
      } else {
        const staticDuration = (NOW - lane.densityLastChangedAt) / 1000;
        if (staticDuration >= 10 && !lane.ghostFlag) {
           lane.ghostFlag = true;
           addAlert('ghost', `👻 ACCIDENT DETECTED: Lane ${id} static for 10s on GREEN. Possible blockage!`, id);
           // Trigger Physical Buzzer Alert
           if (arduinoPort && arduinoPort.isOpen) arduinoPort.write('B\n');
        }
      }
    }

    // 2. Virtual Sync Fallback (30s Silence Detection)
    const hardwareSilence = (NOW - lane.lastHardwareUpdate) / 1000;
    if (simulationRunning && hardwareSilence >= 30) {
       if (!lane.fallbackActive) {
          lane.fallbackActive = true;
          addAlert('warning', `📡 NODE OFFLINE: Lane ${id} hardware silent. Activating Virtual Sync fallback...`, id);
       }
       // Only trigger fallback if simulation is in 'live' mode and we have a key
       if (TOMTOM_KEY) {
          fetchTomTomFallback(id);
       }
    } else if (lane.fallbackActive && hardwareSilence < 5) {
       // Hardware has resumed
       lane.fallbackActive = false;
       addAlert('success', `🔌 NODE RESTORED: Lane ${id} hardware uplink re-established. Control handed back to Edge.`, id);
    }
  });

  broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
}

// ─── Direct Fallback Controller ───────────────────────────────────────────────
async function fetchTomTomFallback(laneId) {
  const jn = junctions[activeJunction] || junctions['JN-001'];
  // Simplified directional offset for fallback coordinates
  const offsets = { '1': [-0.0008, 0], '2': [0, 0.0008], '3': [0, -0.0008] };
  const [dLat, dLng] = offsets[laneId] || [0, 0];
  
  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${jn.lat + dLat},${jn.lng + dLng}&key=${TOMTOM_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
       const data = await res.json();
       const seg  = data?.flowSegmentData;
       if (seg) {
          const ratio = seg.currentSpeed / seg.freeFlowSpeed;
          // Use current generic multiplier
          const multiplier = (new Date().getHours() >= 17 && new Date().getHours() < 20) ? 1.0 : 0.6;
          const vehicles = speedRatioToVehicles(ratio, multiplier, parseInt(laneId) - 1);
          
          // Silently process — don't update lastHardwareUpdate!
          const lane = state.lanes[laneId];
          lane.previousDensity = lane.density;
          lane.vehicles = vehicles;
          computePriorities();
       }
    }
  } catch (e) { /* ignore fallback errors */ }
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
        dataSource = TOMTOM_KEY ? 'live' : 'pattern';
        clearInterval(snapTimer);
        clearInterval(worldTimer);
        clearInterval(weatherPollTimer);
        fetchLiveTrafficData();
        snapTimer        = setInterval(fetchLiveTrafficData, SNAP_INTERVAL);
        worldTimer       = setInterval(tick, TICK_INTERVAL);
        fetchWeatherData();
        weatherPollTimer = setInterval(fetchWeatherData, 600000); // every 10 min
        addAlert('info', TOMTOM_KEY
          ? '📡 Live feed active — GiveWay connected to TomTom traffic network.'
          : '🕐 Pattern engine active — time-of-day traffic modeling engaged.', null);
      }
      break;

    case 'STOP_SIM':
      simulationRunning = false;
      dataSource = 'paused';
      clearInterval(snapTimer);
      clearInterval(worldTimer);
      clearInterval(weatherPollTimer);
      addAlert('info', '⏸ Live feed paused.', null);
      break;

    case 'RESET_SIM':
      simulationRunning = false;
      dataSource = 'paused';
      clearInterval(snapTimer);
      clearInterval(worldTimer);
      clearInterval(weatherPollTimer);
      state = buildInitialState();
      auditLog = [];
      overrideMode = 'auto';
      apiStatus = { tomtom: false, weather: false, lastFetch: null };
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

    case 'SIMULATE_RFID': {
      const { laneId, vehicleType, tagId } = msg.payload;
      if (state.lanes[laneId]) {
        state.lanes[laneId].vehicles[vehicleType || 'bus']++;
        state.lanes[laneId].priorityTrigger = true;
        addAlert('emergency', `📇 [RFID] Tag Detected: ${tagId || 'BUS-7742'} on Lane ${laneId}. Priority assigned.`, laneId);
        
        // PHYSICAL FEEDBACK: Beep the showcase buzzer
        arduinoPort && arduinoPort.write('B\n');

        computePriorities();
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
        
        // Auto-reset trigger after 5s
        setTimeout(() => {
          if (state.lanes[laneId]) {
            state.lanes[laneId].priorityTrigger = false;
            broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
          }
        }, 5000);
      }
      break;
    }

    case 'SIMULATE_GHOST_LANE': {
      const { laneId } = msg.payload;
      if (state.lanes[laneId]) {
        state.lanes[laneId].ghostFlag = true;
        state.lanes[laneId].vehicles.car = Math.max(state.lanes[laneId].vehicles.car, 12);
        addAlert('ghost', `👻 [DEMO] Ghost Lane simulated on Lane ${laneId}! Static density detected on GREEN.`, laneId);
        
        // PHYSICAL FEEDBACK: Long beep for accident alert
        arduinoPort && arduinoPort.write('B\n');
        setTimeout(() => arduinoPort && arduinoPort.write('B\n'), 300);

        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
      break;
    }

    case 'SIMULATE_TRAFFIC_BURST': {
      const { laneId } = msg.payload;
      if (state.lanes[laneId]) {
        state.lanes[laneId].vehicles.car += 25;
        state.lanes[laneId].vehicles.bike += 15;
        addAlert('warning', `🚦 [DEMO] Traffic Burst on Lane ${laneId}! High density influx detected.`, laneId);
        computePriorities();
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
      break;
    }

    case 'GET_AUDIT':
      broadcast({ type: 'AUDIT_LOG', payload: auditLog });
      break;

    case 'NODE_ONLINE': {
      const { junctionId } = msg.payload;
      if (junctions[junctionId]) {
        junctions[junctionId].lastPing = Date.now();
        junctions[junctionId].status = 'online';
        // Add a temporary virtual node if not already reflected
        if (state.junction.id === junctionId) {
          state.junction.cameraNodes = Math.max(state.junction.cameraNodes, 4);
        }
        broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
      }
      break;
    }
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
    overrideMode,
    dataSource,
    apiStatus,
  };
}

// ─── Secure Mobile/Web Auth APIs (JSON System) ────────────────────────────────
app.patch('/api/auth/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'police'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role requested.' });
  }

  logAudit('ROLE_SWITCH', `Terminal instantly transitioned to ${role} persona.`);
  
  res.json({ success: true, user: { role, name: role === 'police' ? 'Tactical Officer' : 'Central Admin' } });
});

// ─── Secure QR Discovery API ──────────────────────────────────────────────────
// ─── REST APIs & State Management ─────────────────────────────────────────────
app.get('/api/state', (req, res) => res.json(sanitizeState()));
app.get('/api/alerts', (req, res) => res.json(state.alerts));
app.get('/api/audit', (req, res) => res.json(auditLog));
app.get('/api/junctions', (req, res) => {
  // Mark junctions as offline if no ping in 5 minutes
  Object.values(junctions).forEach(j => {
    if (Date.now() - j.lastPing > 300000) j.status = 'offline';
  });
  res.json(Object.values(junctions));
});

app.get('/api/analytics', (req, res) => {
  res.json({
    hourly: db.analytics.hourly,
    vehicleMix: {
      ambulance: state.totalAmbulances,
      bus: state.totalBuses,
      car: state.totalCars,
      bike: state.totalBikes,
      lorry: state.totalLorry,
    },
    fuelSaved: state.fuelSaved + (db.analytics.fuelSaved || 0),
    co2Reduced: state.co2Reduced + (db.analytics.co2Reduced || 0),
    totalServed: state.totalVehiclesServed + (db.analytics.totalServed || 0),
  });
});
// ─── Dynamic Junction Location Update ────────────────────────────────────────
// Called by the frontend after it reverse-geocodes the browser's GPS position.
// This replaces the hardcoded static coordinates with real on-the-ground data.
app.patch('/api/junctions/:id', (req, res) => {
  const { id } = req.params;
  const { name, address, zone, lat, lng, city, state: stateField } = req.body;

  if (!junctions[id]) {
    // Auto-register a new junction if it doesn't exist yet
    junctions[id] = { id, status: 'online', lastPing: Date.now(), deployedAt: new Date().toISOString().split('T')[0], cameraNodes: 3, poleId: `POLE-${id}` };
  }

  // Merge only the fields provided
  if (name)        junctions[id].name     = name;
  if (address)     junctions[id].address  = address;
  if (zone)        junctions[id].zone     = zone;
  if (lat != null) junctions[id].lat      = parseFloat(lat);
  if (lng != null) junctions[id].lng      = parseFloat(lng);
  if (city)        junctions[id].city     = city;
  if (stateField)  junctions[id].state    = stateField;

  // If updating the active junction, push the state change to all clients
  if (id === activeJunction) {
    state.junction = junctions[id];
    broadcast({ type: 'STATE_UPDATE', payload: sanitizeState() });
  }

  logAudit('JUNCTION_UPDATE', `Junction ${id} location dynamically updated to: ${lat}, ${lng}`);
  res.json({ success: true, junction: junctions[id] });
});

const edgeRequestLog = new Map(); // tracks last request per junction/lane

app.post('/api/edge-data', (req, res) => {
  const { laneId, secret, vehicles, junctionId } = req.body;
  
  if (secret !== (process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY')) {
    return res.status(401).json({ error: 'Unauthorized Node Access' });
  }
  
  const now = Date.now();
  const requestId = `${junctionId}-${laneId}`;
  
  if (edgeRequestLog.has(requestId) && (now - edgeRequestLog.get(requestId)) < 1500) {
    return res.status(429).json({ error: 'System busy: Rate limit exceeded' });
  }
  edgeRequestLog.set(requestId, now);

  if (!state.lanes[laneId]) return res.status(400).json({ error: 'Invalid Lane ID' });
  
  if (junctionId && junctions[junctionId]) {
    junctions[junctionId].lastPing = now;
    junctions[junctionId].status = 'online';
  }
  
  if (req.body.priorityTrigger) {
    state.lanes[laneId].priorityTrigger = true;
    addAlert('emergency', `🚨 Hardware Override: Priority Triggered on Lane ${laneId}!`, laneId);
  } else {
    state.lanes[laneId].priorityTrigger = false;
  }

  processEdgeData(laneId, { ...vehicles, pedestrian: req.body.pedestrian });
  res.json({ success: true, newScore: state.lanes[laneId].pceScore });
});

app.get('/api/junctions/:id', (req, res) => {
  const junction = junctions[req.params.id];
  if (!junction) return res.status(404).json({ error: 'Junction not found' });
  res.json(junction);
});

app.post('/api/junctions/switch', (req, res) => {
  const { junctionId } = req.body;
  if (!junctions[junctionId]) return res.status(404).json({ error: 'Junction not found' });
  activeJunction = junctionId;
  state.junction = junctions[activeJunction];
  broadcast({ type: 'JUNCTION_SWITCH', payload: { junction: junctions[activeJunction], state: sanitizeState() } });
  logAudit('JUNCTION_SWITCH', `Switched monitoring to ${junctions[activeJunction].name} (${junctionId})`);
  res.json({ success: true, junction: junctions[activeJunction] });
});

// ─── Data Source Status API ─────────────────────────────────────────────────
app.get('/api/data-source', (req, res) => {
  res.json({
    dataSource,
    apiStatus,
    simulationRunning,
    tomtomEnabled: !!TOMTOM_KEY,
    owmEnabled: !!OWM_KEY,
    timeOfDayMultiplier: getTimeOfDayMultiplier(),
  });
});

// ─── Secure Device Sync (Cross-Platform Pairing) ───────────────────────────
const syncTokens = new Map(); // token -> systemState

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

app.get('/api/sync/token', (req, res) => {
  const token = uuidv4().split('-')[0].toUpperCase();
  const localIp = getLocalIp();
  
  // Token expires in 5 minutes
  syncTokens.set(token, {
    ip: localIp,
    port: PORT,
    createdAt: Date.now()
  });

  setTimeout(() => syncTokens.delete(token), 300000);

  res.json({
    success: true,
    token,
    ip: localIp,
    port: PORT,
    directUrl: process.env.RENDER_EXTERNAL_URL || `http://${localIp}:${PORT}`
  });
});

app.post('/api/sync/verify', (req, res) => {
  const { token } = req.body;
  if (syncTokens.has(token)) {
    return res.json({ success: true, user: db.users.find(u => u.role === 'admin') });
  }
  res.status(401).json({ success: false, error: 'Token expired or invalid' });
});

// ─── Frontend React Navigation Fallback ───────────────────────────────────────
app.get('*', (req, res) => {
  const target = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(target)) {
    res.sendFile(target);
  } else {
    res.status(404).send('🚦 GiveWay Backend Active, but Frontend Build (client/dist) is missing. Check Render build logs.');
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
// Secure Exit Logic: Ensure db is saved before process dies
process.on('SIGINT', () => {
  console.log('🛑 [SYSTEM] Shutdown detected. Saving final state...');
  const tempFile = DB_FILE + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2));
  fs.renameSync(tempFile, DB_FILE);
  process.exit();
});

server.listen(PORT, () => {
  console.log(`🚀 GiveWay Advanced Traffic System (ATES) Backend running on http://localhost:${PORT}`);
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
      // Unified Software Node Signature
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
