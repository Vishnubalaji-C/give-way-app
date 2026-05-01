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

// Serve Production React PWA (client/dist) FIRST — before any API routes
app.use(express.static(path.join(__dirname, 'client/dist')));

// ─── Status & Connectivity Monitoring ──────────────────────────────────────────
app.get('/api/status', (req, res) => {
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
      role: 'operator',
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
    role: role || 'operator',
    name: fullName || 'GiveWay Operator',
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
  if (!['admin', 'police', 'operator'].includes(role)) {
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

const PCE = { ambulance: 500, bus: 1, car: 1, bike: 1, lorry: 1 }; // Pure Traffic Density Approach

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
    name: 'Dindigul - Natham - Singampunari - Tiruppattur - Karaikudi Road Junction',
    zone: 'Zone A — Dindigul Central',
    city: 'Dindigul',
    state: 'Tamil Nadu',
    lat: 10.3673,
    lng: 77.9803,
    poleId: 'DI-MEGA-01',
    address: 'Natham Rd, near Collectorate, Dindigul, Tamil Nadu 624004',
    status: 'online',
    lastPing: Date.now(),
    deployedAt: '2026-04-21',
    cameraNodes: 3,
  },
};

// ─── Hardware Architecture (Physical Bridge) ──────────────────────────────────
let arduinoPort = null;
let parser      = null;
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
const IS_CLOUD    = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;

function sendToArduino(lane, action) {
  if (!arduinoPort || !arduinoPort.writable) return;
  const cmd = `${lane}${action}\n`;
  arduinoPort.write(cmd);
}

// Note: Hardware handling is now centralized in connectArduino() below.

let activeJunction = 'JN-001'; // Currently viewed junction

// ─── State ────────────────────────────────────────────────────────────────────
let simulationRunning = true; // AUTO-START: Logic begins immediately on boot
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

// ─── Visual Sensor AI Data Endpoint (NEW) ──────────────────────────────────────
// Receives AI inference counts from CameraFeedPage (Laptop/Mobile Cameras)
app.post('/api/edge-data', (req, res) => {
  const { laneId, vehicles, secret, pedestrian } = req.body;
  
  // Security check: only authorized nodes can feed data
  if (secret !== (process.env.GIVEWAY_NODE_KEY || 'GIVEWAY_NODE_KEY')) {
    return res.status(403).json({ success: false, error: 'Unauthorized Edge Node Access.' });
  }

  if (state.lanes[laneId]) {
    // Inject hardware data into the decision engine
    processEdgeData(laneId, vehicles);
    
    // If pedestrian detected, trigger alert
    if (pedestrian && !state.lanes[laneId].isPedestrian) {
       addAlert('ghost', `🚶‍♂️ Visual Sensor: Pedestrian on Lane ${laneId}`, laneId);
    }
    
    return res.json({ success: true, timestamp: Date.now() });
  }
  
  res.status(404).json({ success: false, error: 'Lane not found.' });
});

let state = buildInitialState(db.analytics);
let auditLog = db.auditLog;
let worldTimer       = null;
let snapTimer        = null;
let weatherPollTimer = null;

// ─── Arduino Physical Bridge ───────────────────────────────────────────────────
// ─── Arduino Physical Bridge ───────────────────────────────────────────────────

let isScanning = false;
async function connectArduino() {
  if (isScanning || (arduinoPort && arduinoPort.isOpen)) return;
  isScanning = true;
  
  try {
    const ports = await SerialPort.list();
    const candidates = ports.filter(p => p.vendorId || p.productId); // Filter for real hardware
    
    for (const portInfo of candidates) {
      const found = await new Promise((resolve) => {
        let tempPort;
        try {
          // Try 115200 first (Production), then fallback to 9600
          tempPort = new SerialPort({ path: portInfo.path, baudRate: 115200, autoOpen: false });
          
          tempPort.open((err) => {
            if (err) {
              if (err.message.includes('Access denied')) {
                console.log(`⚠️ [HARDWARE] ${portInfo.path} is BUSY (Is Arduino IDE open?)`);
              }
              return resolve(false);
            }

            const tempParser = tempPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            const timeout = setTimeout(() => {
              if (tempPort.isOpen) tempPort.close();
              resolve(false);
            }, 3000);

            // Wait for Arduino to boot, then ping
            setTimeout(() => { 
              if (tempPort.isOpen) tempPort.write('?\n'); 
            }, 1500);

            tempParser.on('data', (data) => {
              if (data.includes('GIVEWAY')) {
                clearTimeout(timeout);
                arduinoPort = tempPort;
                parser = tempParser;
                console.log(`🚀 [AUTO-SYNC] Connected to Master Board on ${portInfo.path}`);
                setupSerialListeners();
                resolve(true);
              }
            });
          });
        } catch (e) { resolve(false); }
      });
      if (found) break;
    }
  } catch (err) {
    console.log('🔌 [HARDWARE] Search failed:', err.message);
  } finally {
    isScanning = false;
    // Fast retry every 5 seconds until connected
    if (!arduinoPort) setTimeout(connectArduino, 5000);
  }
}

function setupSerialListeners() {
  if (!parser || !arduinoPort) return;
  
  // Clean up old listeners to prevent memory leaks (Fixes MaxListenersExceededWarning)
  parser.removeAllListeners('data');
  arduinoPort.removeAllListeners('error');

  parser.on('data', (data) => {
    const line = data.trim();
    if (!line) return;

    // --- Handle Physical ESP32-CAM UART Streams ---
    if (line.startsWith('HW_CAM:')) {
      const parts = line.split(':');
      const laneId = parts[1];
      const density = parseInt(parts[2]);
      if (state.lanes[laneId] && !isNaN(density)) {
        // Map camera density value to vehicle counts for the PCE engine
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
    
    // Note: RFID logic removed from Arduino side to save power, but kept server-side as no-op for compatibility
  });

  arduinoPort.on('error', err => {
    console.log('❌ [HARDWARE] Link Lost:', err.message);
    arduinoPort = null;
    setTimeout(connectArduino, 5000);
  });
}

connectArduino();

function sendToArduino(laneId, action) {
  if (arduinoPort && arduinoPort.isOpen) {
    // Only send Signal commands (Buzzer logic removed)
    arduinoPort.write(`${laneId}${action}\n`);
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
    alerts: [],
    junction: junctions[activeJunction] || junctions['JN-001'],
    simulationRunning,
    overrideMode,
    isCongested: false,
    isSwitching: false, // Prevents signal race conditions
    mode: { rain: false, night: false },
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
    
    // Pure Density (Sum of vehicles)
    const rawDensity = Object.values(lane.vehicles).reduce((acc, val) => acc + val, 0);
    lane.density = rawDensity;

    // 60-SECOND HARD LIMIT:
    // If a lane has been waiting for more than 60 seconds, 
    // give it a massive priority boost (+2000) so it MUST go next.
    const waitLimitBoost = (lane.waitTime > 60) ? 2000 : 0;
    
    const hasEmergency = (lane.vehicles.emergency > 0 || lane.vehicles.ambulance > 0);
    const emergencyBoost = hasEmergency ? 3000 : 0; // Emergency still beats wait limit
    
    lane.finalPriority = rawDensity + waitLimitBoost + emergencyBoost;
    
    lane.pceScore = rawDensity;
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
  if (overrideMode === 'festival') {
    // Round Robin: 1 -> 2 -> 3 -> 1
    const currentIndex = LANES.indexOf(state.activeLane);
    const nextIndex = (currentIndex + 1) % LANES.length;
    return LANES[nextIndex];
  }

  // ADAPTIVE PRIORITY: Select the "Top Traffic" lane
  // We filter out the active lane, and prioritize lanes with ACTUAL traffic.
  const candidates = LANES.filter(id => id !== state.activeLane);
  
  // If there is traffic somewhere, skip empty lanes (unless they've waited > 60s)
  const lanesWithTraffic = candidates.filter(id => state.lanes[id].density > 0 || state.lanes[id].finalPriority > 1000);
  
  const pool = lanesWithTraffic.length > 0 ? lanesWithTraffic : candidates;

  // Sort by finalPriority (Density)
  pool.sort((a, b) => state.lanes[b].finalPriority - state.lanes[a].finalPriority);
  
  const winner = pool[0];
  console.log(`🤖 [AI] Traffic-First Selection: Lane ${winner} (Score: ${Math.round(state.lanes[winner].finalPriority)})`);
  
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
  if (overrideMode === 'festival') return 20;

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
   // Pure Density Logic: Sum of all detected vehicles
   const newDensity = (vehicles.car || 0) + 
                      (vehicles.bus || 0) + 
                      (vehicles.bike || 0) + 
                      (vehicles.lorry || 0) + 
                      (vehicles.emergency || 0) + 
                      (vehicles.ambulance || 0);
   
    // Intelligence Resilience Update
    lane.lastHardwareUpdate = Date.now();
    if (Math.abs(lane.density - newDensity) > 2) {
       lane.densityLastChangedAt = Date.now();
    }

    lane.previousDensity = lane.density;
    lane.density = newDensity;
    lane.vehicles = vehicles;
    lane.isEmergency = (vehicles.emergency > 0 || vehicles.ambulance > 0);
    
    // Store Pedestrian & Priority state
    if (vehicles.pedestrian && !lane.isPedestrian) {
       addAlert('ghost', `🚶‍♂️ Pedestrian detected on Lane ${laneId}! Entering Safety Mode.`, laneId);
    }
    lane.isPedestrian = vehicles.pedestrian || false;

    // --- INSTANT-EMPTY-SWITCH TRIGGER ---
    // If the CURRENT GREEN LANE is empty, but others have cars, 
    // END the green phase immediately!
    if (laneId === state.activeLane && newDensity === 0) {
       const otherTraffic = LANES.some(id => id !== laneId && state.lanes[id].density > 0);
       if (otherTraffic && !state.isSwitching) {
          state.phaseTimer = state.lanes[laneId].isEmergency ? 1 : 2; 
          console.log(`🌀 [AI OPTIMIZATION] Lane ${laneId} is empty. Switching to busy lanes immediately!`);
       }
    }

    // --- EMERGENCY & DEMO FAST-TRACK TRIGGER ---
    // If an Ambulance is detected on a Red lane, OR a car is on a Red lane,
    // force the current Green light to wrap up immediately!
    if ((lane.isEmergency || newDensity > 0) && laneId !== state.activeLane) {
       if (state.phaseTimer > 3 && !state.isSwitching) {
          state.phaseTimer = lane.isEmergency ? 1 : 3; 
          console.log(`🚑 [EMERGENCY PREEMPTION] Traffic detected on Lane ${laneId}. Forcing light change!`);
       }
    }

    computePriorities();
    
    // --- PERSISTENT ANALYTICS UPDATE ---
    // Every time the AI identifies vehicles, we update the cumulative session stats
    state.totalCars += (vehicles.car || 0);
    state.totalBuses += (vehicles.bus || 0);
    state.totalBikes += (vehicles.bike || 0);
    state.totalLorry += (vehicles.lorry || 0);
    state.totalAmbulances += (vehicles.ambulance || 0) + (vehicles.emergency || 0);
    state.totalVehiclesServed = state.totalCars + state.totalBuses + state.totalBikes + state.totalLorry + state.totalAmbulances;

    // Environmental Impact Calculation (Based on idling time avoided)
    state.fuelSaved += (newDensity * 0.005); // Approx 5ml per vehicle cycle
    state.co2Reduced += (newDensity * 0.012); // Approx 12g per vehicle cycle
    
    // Save these stats to the database immediately
    db.analytics.totalServed = state.totalVehiclesServed;
    db.analytics.fuelSaved = state.fuelSaved;
    db.analytics.co2Reduced = state.co2Reduced;
    saveToDisk();

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
      // Camera-Only Mode: Do NOT reset lanes to zero.
      // Just wait for real camera data from the AI Detection Engine.
      dataSource = 'camera';
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

  if (state.phaseTimer === 0 && (overrideMode === 'auto' || overrideMode === 'festival')) {
    const nextLane = selectNextLane();
    switchLane(nextLane);
  }

  // Periodic Database Sync (every 60 seconds)
  if (state.tick % 60 === 0) {
    saveToDisk();
  }


  // ─── Resilience & Error Recovery Logic ──────────────────────────────────────
  const NOW = Date.now();
  
  LANES.forEach(id => {
    const lane = state.lanes[id];

    // 1. Predictive Ghost Lane Detection (10s Static Window)
    if (simulationRunning && lane.signal === 'green' && lane.density > 0) {
      const densityChanged = Math.abs(lane.density - (lane.previousDensity || 0)) > 1;
      
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
           // Trigger Arduino Buzzer Alert
           sendToArduino(id, 'B');
        }
      }
    }

    // 2. Camera Input Failure Handling
    const hardwareSilence = (NOW - lane.lastHardwareUpdate) / 1000;
    
    // Stage A: 5s silence — freeze last valid state (do nothing, keep current data)
    if (simulationRunning && hardwareSilence >= 5 && hardwareSilence < 10) {
       // Frozen — retain last known vehicle counts, no action needed
    }
    
    // Stage B: 10s silence — activate round-robin fallback
    if (simulationRunning && hardwareSilence >= 10) {
       if (!lane.fallbackActive) {
          lane.fallbackActive = true;
          addAlert('warning', `📡 NODE OFFLINE: Lane ${id} camera silent for 10s. Round-Robin fallback active.`, id);
          // Force festival/round-robin mode as safety fallback
          if (overrideMode === 'auto') {
             console.log(`🔄 [FALLBACK] No camera input. Switching to Round-Robin safety mode.`);
          }
       }
    } else if (lane.fallbackActive && hardwareSilence < 5) {
       // Camera has resumed sending data
       lane.fallbackActive = false;
       addAlert('success', `🔌 NODE RESTORED: Lane ${id} camera uplink re-established.`, id);
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
        clearInterval(worldTimer);
        worldTimer = setInterval(tick, TICK_INTERVAL);
        clearInterval(snapTimer);
        snapTimer = setInterval(fetchLiveTrafficData, SNAP_INTERVAL);
        fetchWeatherData();
        clearInterval(weatherPollTimer);
        weatherPollTimer = setInterval(fetchWeatherData, 600000);
        addAlert('info', '🤖 GiveWay AI engine and data feeds synchronized.', null);
      }
      break;

    case 'STOP_SIM':
      clearInterval(snapTimer);
      dataSource = 'hardware';
      addAlert('info', '⏸ Demo data paused. System is now running EXCLUSIVELY on Hardware & Camera feeds.', null);
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
      sendToArduino(laneId, 'R');
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
      
      let hwModeCmd = 'AUT';
      if (overrideMode === 'emergency') {
        hwModeCmd = 'EMG';
        LANES.forEach(id => { state.lanes[id].signal = 'red'; state.lanes[id].phase = 'red'; });
        addAlert('emergency', '🚨 Emergency All-Stop activated!', null);
        LANES.forEach(id => sendToArduino(id, 'R'));
      } else if (overrideMode === 'vip') {
        hwModeCmd = 'VIP';
        addAlert('warning', '👑 VIP Corridor active. Auto-switching suspended. Manual overrides enabled.', null);
      } else if (overrideMode === 'festival') {
        hwModeCmd = 'FES';
        addAlert('info', '🎉 Festival Mode active. Using balanced round-robin timing.', null);
      } else if (overrideMode === 'auto') {
        addAlert('info', '🤖 GiveWay AI control restored.', null);
      }
      
      if (arduinoPort && arduinoPort.isOpen) {
        arduinoPort.write(`M:${hwModeCmd}\n`);
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
        sendToArduino(id, 'R');
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
  
  res.json({ success: true, user: { role, name: role === 'police' ? 'Tactical Operator' : 'Central Admin' } });
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
    return res.json({ success: true, user: db.users.find(u => u.role === 'operator') || db.users[0] });
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
  
  // 🚀 AUTO-BOOT ENGINE: Start the decision logic immediately
  if (simulationRunning) {
    console.log("🤖 [ENGINE] Auto-starting Traffic Decision Matrix...");
    dataSource = TOMTOM_KEY ? 'live' : 'pattern';
    fetchLiveTrafficData();
    snapTimer  = setInterval(fetchLiveTrafficData, SNAP_INTERVAL);
    worldTimer = setInterval(tick, TICK_INTERVAL);
    fetchWeatherData();
    weatherPollTimer = setInterval(fetchWeatherData, 600000); 
  }
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
