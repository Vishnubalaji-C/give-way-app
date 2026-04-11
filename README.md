# 🚦 MakeWay — Adaptive Traffic Equity System (ATES)
### Final "Antigravity" Edition — AI-Driven, PCE-Weighted Traffic Management (v1.1)

---

## 📖 Overview
MakeWay (GiveWay) is an advanced IoT and AI-driven smart city traffic management system. It dynamically controls traffic lights using real-time edge processing (YOLO) and proprietary Passenger Car Equivalent (PCE) algorithms to prioritize ambulances, balance junction loads, and eradicate static wait times.

---

## 🏗️ Project Structure
```text
MakeWay/
├── server.js              # Node.js + Express + WebSocket backend
├── package.json           # Root scripts
├── db.json                # Local fallback DB persistence
├── client/                # React + Vite + Tailwind frontend
├── mobile/                # Flutter Mobile application (Android)
└── hardware/              # Arduino Mega Master & ESP32-CAM nodes
```

---

## 🚀 Deployment & Local Setup

### 1. Web Infrastructure Start
```bash
# Install all dependencies (Frontend & Backend)
npm run install:all

# Start both servers concurrently
npm run dev
```
- **Backend API**: Runs computationally at `http://localhost:4000`
- **Dashboard UI**: Runs locally at `http://localhost:5173`

### 2. Mobile App (Flutter)
- Ensure **Windows Developer Mode** is active.
- Navigate to `mobile/` and run `flutter build apk` to compile the companion uplinking app.

### 3. Cloud Production
- **Dashboard**: Auto-deployed as a built React/Vite instance or fullstack rendering
- **Backend**: Configured for Render/Vercel with Mongoose DB for authentication logs.

---

## ⚙️ System Architecture & Logic

### A. Decision Engine (GiveWay Algorithm)
```text
Final Priority = (Lane Density × Weight) + (Wait Time × Penalty Coefficient)
```
**Rules:**
1. 🚑 **Ambulance Override** — Instant Green via Innuyir protocol.
2. ⏱️ **Starvation Prevention** — Exponential penalty applied after 90s wait.
3. 🛑 **Fairness Cap** — Max 120s wait threshold enforced.
4. 👻 **Ghost Lane Detection** — Flags zero-movement phases to assume breakdown/accidents.

### B. Hardware Master Specification (Arduino Mega 2560)
The physical logic controller directly integrates with edge cameras. Pins are strictly configured:

**🚦 Traffic Light Control (Output): HIGH = ON**
- Lane North (R, Y, G): Pins 2, 3, 4
- Lane East (R, Y, G): Pins 5, 6, 7
- Lane South (R, Y, G): Pins 8, 9, 10
- Lane West (R, Y, G): Pins 11, 12, 13

**🔊 Sensors & Alerts (I/O)**
- Ambulance Buzzer: Pin 22 (Digital Out)
- LDR (Light Sensor): Pin A0 (Analog In)

**📡 Serial Communication**
- Lane N (TX18, RX19) / Lane E (TX16, RX17) / Lane S (TX14, RX15) / Lane W (TX1, RX0) @ 115200 Baud

### C. Edge Nodes (ESP32-CAM AI-Thinker)
- Camera Data (D0-D7): Pins 5,18,19,21,36,39,34,35
- Flash LED: Pin 4 (Night Vision / Alert)
- Serial Data Payload Protocol: `LANE:X,AMB:n,BUS:n,CAR:n,BIKE:n,PED:n\n` (Polled every 5 seconds)

---

## 🌐 Networking APIs

### WebSockets (Real-time Sync)
| Hook                 | Purpose                                |
|----------------------|----------------------------------------|
| `START_SIM`/`STOP_SIM` | Control Engine Kernels                |
| `FORCE_GREEN/RED`    | Tactical Overrides                     |
| `SET_OVERRIDE_MODE`  | `auto`, `emergency`, `festival`, `vip` |
| `TRIGGER_GREEN_WAVE` | Sync Junctions                         |

### REST API (Secure Auth & Stats)
- `GET /api/state`: Current matrix view
- `GET /api/alerts`: 50 latest operational events
- `GET /api/audit`: Immutable ledger of police/admin actions
- `GET /api/analytics`: Datasets for charting heatmaps and CO₂ fuel savings.

---
*Built with ❤️ for Smart Cities 2026 — 10% Hardware, 90% Intelligence.*
