# 🚦 MakeWay — Adaptive Traffic Equity System (ATES)
### Final "Antigravity" Edition — AI-Driven, PCE-Weighted Traffic Management (v1.1)

---

## 🏗️ Project Structure

```
MakeWay/
├── server.js              # Node.js + Express + WebSocket backend
├── package.json           # Root scripts
├── client/                # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── context/
│   │   │   └── WsContext.jsx      # WebSocket provider
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx  # System overview
│   │   │   ├── SimulationPage.jsx # Live junction simulation
│   │   │   ├── AnalyticsPage.jsx  # Charts & heatmaps
│   │   │   └── ControlRoomPage.jsx# Police / admin panel
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── vite.config.js
└── README.md
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# Root (backend)
npm install

# Frontend
cd client && npm install
```

### 2. Start the backend server

```bash
# From MakeWay/
node server.js
```

Backend runs at `http://localhost:4000`

### 3. Start the frontend

```bash
# From MakeWay/client/
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## 🌎 Official Deployment
- **Web Dashboard**: [https://give-way-app.vercel.app](https://give-way-app.vercel.app)
- **Backend API**: [https://give-way-app.onrender.com](https://give-way-app.onrender.com)
- **Mobile App**: Production build pointing to cloud backend.

---

## ⚙️ System Architecture

### A. Edge Layer (Simulated ESP32-CAM)
- 4 traffic lanes: **N / S / E / W**
- Every 5 seconds → captures frame & runs YOLO inference
- Supports **Local Storage (Atomic sync)** for zero-cost persistence
- Calculates **PCE Density Score** on-edge:

| Vehicle     | PCE Weight |
|-------------|-----------|
| 🚑 Ambulance | 100       |
| 🚌 Bus       | 20        |
| 🚗 Car/Auto  | 1         |
| 🏍️ Bike      | 0.5       |

### B. Decision Engine (GiveWay Algorithm)

```
Final Priority = (Lane Density × Weight) + (Wait Time × Penalty Coefficient)
```

**Rules:**
1. 🚑 **Ambulance Override** — Instant Green, no delay
2. ⏱️ **Starvation Prevention** — Exponential penalty after 90s wait
3. 🛑 **Fairness Cap** — Max 120s wait for any lane
4. 🤖 **Normal Mode** — Highest priority wins green

### C. Dashboard Layer (React UI)
- **Dashboard** — KPIs, PCE weights, system phases, hardware BOM
- **Simulation** — Live 4-lane junction with animated signals
- **Analytics** — Charts, heatmaps, fairness graph, CO₂ savings
- **Control Room** — Police override, modes, ghost detection, audit log

---

## 🌐 WebSocket API

| Client → Server       | Payload                        | Description                |
|-----------------------|--------------------------------|----------------------------|
| `START_SIM`           | —                              | Begin simulation           |
| `STOP_SIM`            | —                              | Pause simulation           |
| `RESET_SIM`           | —                              | Reset all state            |
| `INJECT_VEHICLE`      | `{ laneId, vehicleType }`      | Add vehicle to a lane      |
| `FORCE_GREEN`         | `{ laneId }`                   | Force green on lane        |
| `FORCE_RED`           | `{ laneId }`                   | Force red on lane          |
| `SET_MODE`            | `{ mode, value }`              | Toggle rain/night mode     |
| `SET_OVERRIDE_MODE`   | `{ mode }`                     | Switch system control mode |
| `TRIGGER_GREEN_WAVE`  | —                              | Propagate green wave       |
| `GET_AUDIT`           | —                              | Fetch audit log            |

| Server → Client       | Description                    |
|-----------------------|--------------------------------|
| `INIT`                | Full state on connect          |
| `STATE_UPDATE`        | State after each tick          |
| `ALERT`               | New system alert               |
| `AUDIT_LOG`           | Full audit log                 |
| `RESET`               | State after reset              |

---

## 🔌 REST API

| Endpoint          | Description                        |
|-------------------|------------------------------------|
| `GET /api/state`  | Current junction state             |
| `GET /api/alerts` | Last 50 system alerts              |
| `GET /api/audit`  | Full officer action audit log      |
| `GET /api/analytics` | Analytics data for charts       |

---

## ✨ Features

- **PCE-Weighted Priority** — Fair, intelligent signal selection
- **Ambulance Emergency Mode** — Instant green, logged
- **Starvation Prevention (WTP)** — No lane waits > 120s
- **Ghost Lane Detection** — Accident/breakdown flag
- **Green-Wave Handshake** — Junction A → B → C sync
- **Rain Mode** — Extended yellow transition time
- **Night Mode** — Sparse traffic, detect-and-green
- **Manual Override** — Force Green/Red per lane
- **VIP / Festival / All-Stop Modes** — Operational flexibility
- **Audit Log** — Every officer action is recorded
- **Real-time WebSocket** — Live dashboard updates
- **Analytics** — Recharts visualizations, heatmap, CO₂ savings

---

## 📦 Hardware Budget (₹4,200/junction)

| Component             | Cost    |
|-----------------------|---------|
| ESP32-CAM × 4         | ₹2,200  |
| Arduino Mega 2560     | ₹750    |
| 4-Channel Relay       | ₹350    |
| Signal LED Kit × 4    | ₹200    |
| Power Supply 5V 3A    | ₹400    |
| Casing & Wiring       | ₹300    |
| **TOTAL**             | **₹4,200** |

---

## 📚 References

1. IEEE Access (Jan 2025) — Edge-Deployed YOLO + PCE Traffic Control
2. IJSDR (Mar 2025) — ESP32-CAM + YOLOv5 Nano Traffic System
3. IEEE Xplore (Jan 2025) — IoT Smart Signals + Emergency Priority
4. IEEE Access (2024) — Edge ML for Smart Traffic in ITS
5. ResearchGate (Feb 2025) — AI Traffic Control for Indian Roads

---

*Built with ❤️ for Smart Cities 2026 — 10% Hardware, 90% Intelligence*
