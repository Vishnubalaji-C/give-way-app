# 🚦 MakeWay — Adaptive Traffic Equity System (ATES)
### Final "Shield" Edition — AI-Driven, PCE-Weighted Traffic Management (v4.2)

---

## 📖 Overview
MakeWay is an advanced IoT and AI-driven smart city traffic management system. It dynamically controls traffic lights using real-time edge processing (YOLOv8) and a proprietary Passenger Car Equivalent (PCE) algorithm. The system prioritizes ambulances/emergency vehicles, balances junction loads, and optimizes traffic flow based on real-time vehicle density detected at the edge.

---

## 🏗️ Project Structure
```text
MakeWay/
├── server.js              # Node.js + WebSocket backend (Master Controller)
├── package.json           # Global ecosystem scripts
├── db.json                # Local persistence layer (Fallback)
├── client/                # React Fiber Web Dashboard (Command Center)
├── mobile/                # Flutter Police/Admin Deployment App
└── hardware/              
    ├── ArduinoMaster/     # Mega 2560 Logic Controller (3-Way Round Robin)
    ├── ESP32Cam/          # AI Edge Nodes (Lane Detection)
    └── inference/         # Python Flask ML Service (YOLOv8 + LBPH)
```

---

## 🚀 Quick Start (Demo Mode)

### 1. Unified Startup
```bash
# Install and run everything concurrently
npm run install:all
npm run dev
```
- **Dashboard**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000`
- **ML Inference**: `http://localhost:5000`

### 2. Physical Deployment
- Flash `ArduinoMaster.ino` to the Arduino Mega.
- Flash `ESP32Cam.ino` to the AI-Thinker modules (Adjust SSIDs).
- Ensure the ML service is running to process edge frames.

---

## ⚙️ Final System Specifications (3-Lane Arch)

### A. Decision Logic (ATES Engine)
Final priority and green-light duration are calculated using dynamic density:
```text
Phase Duration = Base (15s) + (Density Bonus) 
Density (PCE) = [AMB:500 | BUS:15 | LORRY:8 | CAR:1 | BIKE:0.5]
```
- **Ambulance Protocol**: Instant MAX-GREEN (40s) override.
- **Starvation Check**: Automatic wait-time penalty applied after 90s.
- **Fairness Cap**: Strict 120s max red limit per lane.

### B. Hardware Master Pins (Arduino Mega)
The system uses a strict **3-approach sequential round-robin** (Pins 8 through 16):

| Component       | Lane 1 (Approach A) | Lane 2 (Approach B) | Lane 3 (Approach C) |
|:----------------|:--------------------|:--------------------|:--------------------|
| **Green LED**   | Pin 8               | Pin 11              | Pin 14              |
| **Yellow LED**  | Pin 9               | Pin 12              | Pin 15              |
| **Red LED**     | Pin 10              | Pin 13              | Pin 16              |

*Note: Pins 14-16 are addressed as A0-A2 on most Mega shields.*

### C. Edge Node Communications
Each **ESP32-CAM** node communicates with the Master via Serial (115200 Baud):
- **Payload**: `LANE:X,AMB:n,BUS:n,CAR:n,BIKE:n,LORRY:n,PED:n`
- **Discovery**: Nodes auto-discover the Master server via Secure UDP Heartbeat (`MAKEWAY_MASTER`).
- **Sync**: Real-time cloud logging to the Command Center via the Render Node.js bridge.

---

## 🌐 Networking & Security
- **WebSockets**: Real-time state replication across Web, Mobile, and Hardware.
- **Geolocation**: Web Dashboard auto-detects real junction location via Browser GPS + OSM Reverse Geocoding.
- **Audit Ledger**: All overrides (Admin/Police) are logged with non-repudiable timestamps in `db.json`/MongoDB.

---
*Built for the 2026 Smart City Initiative — Vision Framework v4.2*
