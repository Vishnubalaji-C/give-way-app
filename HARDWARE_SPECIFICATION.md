# 📏 GiveWay: Master Hardware Specification (v1.0)

This document defines the **Physical Hard-Wiring Standard** for the GiveWay system. All future software updates (Arduino, ESP32, or Mobile/Web) must adhere to these pin mappings to ensure "Plug-and-Play" compatibility without rewiring.

---

## 🏗️ 1. Master Controller (Arduino Mega 2560)

The following pins are **RESERVED** and must not be reassigned in code:

### 🚥 Traffic Light Control (Output)
| Component | Arduino Pin | Logic |
| :--- | :--- | :--- |
| **Lane North (R, Y, G)** | 2, 3, 4 | HIGH = ON, LOW = OFF |
| **Lane East (R, Y, G)** | 5, 6, 7 | HIGH = ON, LOW = OFF |
| **Lane South (R, Y, G)** | 8, 9, 10 | HIGH = ON, LOW = OFF |
| **Lane West (R, Y, G)** | 11, 12, 13 | HIGH = ON, LOW = OFF |

### 🔊 Sensors & Alerts (Input/Output)
| Component | Arduino Pin | Type |
| :--- | :--- | :--- |
| **Ambulance Buzzer** | 22 | Digital Output |
| **LDR (Light Sensor)** | A0 | Analog Input |

### 📡 Serial Communication (Edge Nodes)
| Lane | Mega Serial Port | RX Pin | TX Pin | Baud Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Lane N** | `Serial1` | 19 | 18 | 115200 |
| **Lane E** | `Serial2` | 17 | 16 | 115200 |
| **Lane S** | `Serial3` | 15 | 14 | 115200 |
| **Lane W** | `Serial` | 0 | 1 | 115200 |

---

## 📷 2. Edge Nodes (ESP32-CAM)

Based on the **AI-Thinker** board standard:

| Component | ESP32 Pin | Function |
| :--- | :--- | :--- |
| **Camera Data (D0-D7)** | 5,18,19,21,36,39,34,35 | OV2640 Interface |
| **Flash LED** | 4 | Night Vision / Alert |
| **Serial TX/RX** | 1, 3 | Data to Arduino |

---

## 🔌 3. Power Standard
- **Input Voltage:** 5.0V DC (Regulated).
- **Minimum Current:** 3.0A (Total junction requirement).
- **Logic Level:** 5V (Arduino Mega) / 3.3V (ESP32-CAM). 

---

## 📜 4. Protocol Standard
- **Message Format:** `LANE:X,AMB:n,BUS:n,CAR:n,BIKE:n,PED:n\n`
- **Interval:** Data must be polled every **5000ms**.
