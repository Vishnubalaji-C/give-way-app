/*
 * GIVEWAY — ANTIGRAVITY EDITION
 * Arduino Mega 2560 Master Controller
 * 
 * Controls 4-lane traffic signal hardware via the Antigravity priority engine.
 * Receives real-time PCE density data from ESP32-CAM nodes over Serial,
 * manages signal switching, fairness caps, emergency buzzer alerts,
 * and eco-mode LDR-based night detection.
 * 
 * Hardware:
 *   - Follows HARDWARE_SPECIFICATION.md (v1.0)
 *   - Arduino Mega 2560 (4x hardware Serial ports)
 *   - 12x LEDs (4 lanes × 3 signals: Red/Yellow/Green)
 *   - 1x Piezo Buzzer (ambulance audio alert)
 *   - 1x LDR on A0 (eco-mode ambient light sensor)
 *   - Serial1: Lane N (North)
 *   - Serial2: Lane E (East)
 *   - Serial3: Lane S (South)
 *   - Serial:  Lane W (West) + USB Debugging
 */

// ─── Pin Definitions: 4 Lanes (North, East, South, West) ─────────────────────
const int PIN_N_R = 2;  const int PIN_N_Y = 3;  const int PIN_N_G = 4;
const int PIN_E_R = 5;  const int PIN_E_Y = 6;  const int PIN_E_G = 7;
const int PIN_S_R = 8;  const int PIN_S_Y = 9;  const int PIN_S_G = 10;
const int PIN_W_R = 11; const int PIN_W_Y = 12; const int PIN_W_G = 13;

// Feature integration pins
const int BUZZER_PIN = 22;  // Piezo buzzer for ambulance audio-visual alert
const int LDR_PIN    = A0;  // Light-dependent resistor for eco-mode

// ─── Lane Data Structures ─────────────────────────────────────────────────────
struct LaneData {
  int    density;       // PCE-weighted density score
  int    waitTime;      // Seconds waiting at red
  bool   pedestrian;    // Pedestrian detected in crosswalk
  int    ambulance;     // Raw ambulance count
  int    bus;           // Raw bus count
  int    car;           // Raw car count
  int    bike;          // Raw bike count
  bool   hasData;       // Whether this lane has received any edge data
  unsigned long lastPing; // Time of last received message
};

LaneData lanes[4];  // 0=N, 1=E, 2=S, 3=W

// ─── PCE Weights (matching server.js) ─────────────────────────────────────────
const float PCE_AMBULANCE = 999.0;
const float PCE_BUS       = 10.0;
const float PCE_CAR       = 1.0;
const float PCE_BIKE      = 0.5;

// ─── Timing & Configuration ──────────────────────────────────────────────────
const int FAIRNESS_CAP       = 120;   // Max seconds a lane waits before forced green
const int YELLOW_TIME        = 3000;  // Milliseconds for yellow phase
const int PEDESTRIAN_EXTRA   = 5000;  // Extra delay if pedestrian detected
const int MIN_GREEN_TIME     = 8;     // Minimum seconds of green
const int MAX_GREEN_TIME     = 30;    // Maximum seconds of green
const int BASE_GREEN_TIME    = 15;    // Base green duration
const int LDR_NIGHT_THRESH   = 300;   // Analog reading below = nighttime
const int ECO_CMD_INTERVAL   = 10000; // Send eco commands every 10 seconds (not every tick)

int  activeLane   = 0;     // Currently green lane index
int  greenTimer   = BASE_GREEN_TIME;
bool emergencyActive = false;

// Eco mode tracking
bool ecoNightMode = false;
unsigned long lastEcoCmdTime = 0;

// ─── Lane Name Helper ─────────────────────────────────────────────────────────
const char* laneNames[] = {"N", "E", "S", "W"};

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);   // USB debug + Lane W
  Serial1.begin(115200);  // Lane N
  Serial2.begin(115200);  // Lane E
  Serial3.begin(115200);  // Lane S

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);

  // Set all signal pins to OUTPUT and LOW
  for (int p = 2; p <= 13; p++) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }

  // --- HARDWARE STARTUP SEQUENCE ---
  // Flash all lights to verify wiring
  for (int i = 0; i < 3; i++) {
    for (int p = 2; p <= 13; p++) digitalWrite(p, HIGH);
    delay(200);
    for (int p = 2; p <= 13; p++) digitalWrite(p, LOW);
    delay(200);
  }

  // Initialize lane data
  for (int i = 0; i < 4; i++) {
    lanes[i].density    = 0;
    lanes[i].waitTime   = 0;
    lanes[i].pedestrian = false;
    lanes[i].ambulance  = 0;
    lanes[i].bus        = 0;
    lanes[i].car        = 0;
    lanes[i].bike       = 0;
    lanes[i].hasData    = false;
  }

  // Initialize safe state: North Green, others Red
  setSignal(0, 3);  // N = Green
  setSignal(1, 1);  // E = Red
  setSignal(2, 1);  // S = Red
  setSignal(3, 1);  // W = Red
  greenTimer = BASE_GREEN_TIME;

  Serial.println(F(""));
  Serial.println(F("========================================"));
  Serial.println(F("  GIVEWAY - Antigravity Master Controller"));
  Serial.println(F("  4-Lane Adaptive Traffic Signal"));
  Serial.println(F("========================================"));
  Serial.println(F(""));
  Serial.print(F("[INIT] Active lane: "));
  Serial.println(laneNames[activeLane]);
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
void loop() {
  readSerialData();
  manageEcoMode();

  // Antigravity priority engine runs every tick
  runAntigravityLogic();

  delay(1000);  // 1 second tick

  // Increment wait times for non-active lanes
  for (int i = 0; i < 4; i++) {
    if (i != activeLane) {
      lanes[i].waitTime++;
    }
  }

  // Decrement green timer for active lane
  if (greenTimer > 0) {
    greenTimer--;
  }

  // --- ANTIGRAVITY HEARTBEAT CHECK ---
  // If no data received from active lane ESP for 30s, trigger fail-safe
  static unsigned long lastDataCheck = 0;
  if (millis() - lastDataCheck > 30000) {
    lastDataCheck = millis();
    for (int i = 0; i < 4; i++) {
      if (lanes[i].hasData && (millis() - lanes[i].lastPing > 30000)) {
        lanes[i].hasData = false; // Mark offline
        Serial.print(F("[FAILSAFE] Lane "));
        Serial.print(laneNames[i]);
        Serial.println(F(" went OFFLINE. Reverting to fixed timing."));
      }
    }
  }
}

// Global buffer per serial port to prevent inter-lane data corruption
String buffers[4] = {"", "", "", ""};

void readSerialData() {
  // Check all 4 Serial ports
  pollSerialPort(Serial,  3); // Lane W (West) uses primary Serial
  pollSerialPort(Serial1, 0); // Lane N (North)
  pollSerialPort(Serial2, 1); // Lane E (East)
  pollSerialPort(Serial3, 2); // Lane S (South)
}

void pollSerialPort(Stream &s, int laneIdx) {
  while (s.available()) {
    char c = s.read();
    
    // --- STATE MACHINE SERIAL PARSER ---
    // Look for start of message '$' (optional) or just line-based
    if (c == '\n' || c == '\r') {
      if (buffers[laneIdx].length() > 5) { // Minimum length check
        buffers[laneIdx].trim();
        parseSerialMessage(buffers[laneIdx]);
      }
      buffers[laneIdx] = "";
    } else if (c >= 32 && c <= 126) { // ASCII printable characters only
      buffers[laneIdx] += c;
      if (buffers[laneIdx].length() >= 128) buffers[laneIdx] = "";
    }
  }
  
  // Track last ping for failsafe
  if (s.available()) {
     lanes[laneIdx].lastPing = millis();
  }
}

void parseSerialMessage(String msg) {
  // Format: "LANE:N,AMB:0,BUS:1,CAR:4,BIKE:3,PED:0"
  if (msg.startsWith("LANE:")) {
    char laneChar = msg.charAt(5);
    int laneIdx = laneCharToIndex(laneChar);
    if (laneIdx < 0) return;

    int amb  = extractValue(msg, "AMB:");
    int bus  = extractValue(msg, "BUS:");
    int car  = extractValue(msg, "CAR:");
    int bike = extractValue(msg, "BIKE:");
    int ped  = extractValue(msg, "PED:");

    lanes[laneIdx].ambulance  = amb;
    lanes[laneIdx].bus        = bus;
    lanes[laneIdx].car        = car;
    lanes[laneIdx].bike       = bike;
    lanes[laneIdx].pedestrian = (ped > 0);
    lanes[laneIdx].hasData    = true;
    lanes[laneIdx].lastPing   = millis();

    // Compute PCE density
    lanes[laneIdx].density = (int)(
      amb  * PCE_AMBULANCE +
      bus  * PCE_BUS +
      car  * PCE_CAR +
      bike * PCE_BIKE
    );

    Serial.print(F("[DATA] Lane "));
    Serial.print(laneNames[laneIdx]);
    Serial.print(F(" updated — PCE: "));
    Serial.print(lanes[laneIdx].density);
    Serial.print(F(" (A:"));
    Serial.print(amb);
    Serial.print(F(" B:"));
    Serial.print(bus);
    Serial.print(F(" C:"));
    Serial.print(car);
    Serial.print(F(" K:"));
    Serial.print(bike);
    Serial.println(F(")"));

    return;
  }

  // Legacy format: "N:45,S:12,E:999,W:2,PED_N:1"
  if (msg.indexOf(':') != -1 && !msg.startsWith("SYS_CMD")) {
    // Parse each lane's combined density
    for (int i = 0; i < 4; i++) {
      String key = String(laneNames[i]) + ":";
      int idx = msg.indexOf(key);
      if (idx != -1) {
        int val = extractValueAtPos(msg, idx + key.length());
        lanes[i].density = val;
        lanes[i].hasData = true;

        // Flag ambulance if density >= 999
        if (val >= 999) {
          lanes[i].ambulance = 1;
        }
      }

      // Check pedestrian flags: "PED_N:1"
      String pedKey = "PED_" + String(laneNames[i]) + ":";
      int pedIdx = msg.indexOf(pedKey);
      if (pedIdx != -1) {
        int pedVal = extractValueAtPos(msg, pedIdx + pedKey.length());
        lanes[i].pedestrian = (pedVal > 0);
      }
    }
  }
}

int laneCharToIndex(char c) {
  switch (c) {
    case 'N': return 0;
    case 'E': return 1;
    case 'S': return 2;
    case 'W': return 3;
    default:  return -1;
  }
}

// Extract integer value after a key like "AMB:" from a comma-separated string
int extractValue(String msg, String key) {
  int idx = msg.indexOf(key);
  if (idx == -1) return 0;
  return extractValueAtPos(msg, idx + key.length());
}

// Extract integer starting at position pos until comma or end of string
int extractValueAtPos(String msg, int pos) {
  String numStr = "";
  for (int i = pos; i < (int)msg.length(); i++) {
    char c = msg.charAt(i);
    if (c >= '0' && c <= '9') {
      numStr += c;
    } else {
      break;
    }
  }
  if (numStr.length() == 0) return 0;
  return numStr.toInt();
}

// ──────────────────────────────────────────────────────────────────────────────
// ECO-MODE (Solar-Ready Night Detection)
// Sends commands to ESP32-CAMs to switch camera modes.
// Throttled to avoid spamming serial bus every tick.
// ──────────────────────────────────────────────────────────────────────────────
void manageEcoMode() {
  unsigned long now = millis();
  if (now - lastEcoCmdTime < ECO_CMD_INTERVAL) return;  // Throttle
  lastEcoCmdTime = now;

  int ambientLight = analogRead(LDR_PIN);

  if (ambientLight < LDR_NIGHT_THRESH && !ecoNightMode) {
    ecoNightMode = true;
    Serial.println(F("SYS_CMD:ECO_NIGHT_MODE"));
    Serial.print(F("[ECO] Night detected (LDR="));
    Serial.print(ambientLight);
    Serial.println(F(") — Eco mode ON"));
  }
  else if (ambientLight >= LDR_NIGHT_THRESH && ecoNightMode) {
    ecoNightMode = false;
    Serial.println(F("SYS_CMD:DAY_MODE"));
    Serial.print(F("[ECO] Daylight detected (LDR="));
    Serial.print(ambientLight);
    Serial.println(F(") — Day mode ON"));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ANTIGRAVITY PRIORITY ENGINE
// Priority = PCE_Density + (WaitTime × 1.5)
// Features: Emergency override, fairness cap, starvation prevention
// ──────────────────────────────────────────────────────────────────────────────
void runAntigravityLogic() {
  // Only switch when current green phase expires
  if (greenTimer > 0) return;

  int bestLane = activeLane;
  float highestPriority = -1.0;
  emergencyActive = false;

  // ─── 1. Emergency Override: Ambulance Detection ─────────────────────────
  for (int i = 0; i < 4; i++) {
    if (lanes[i].ambulance > 0 && i != activeLane) {
      emergencyActive = true;
      Serial.print(F("[ALERT] AMBULANCE on Lane "));
      Serial.print(laneNames[i]);
      Serial.println(F(" — Innuyir Protocol ACTIVE!"));

      // Rapid chirp alert for blind pedestrians & distracted drivers
      for (int b = 0; b < 5; b++) {
        tone(BUZZER_PIN, 1200, 150);
        delay(200);
      }
      noTone(BUZZER_PIN);

      switchLane(i);
      return;
    }
  }

  // ─── 2. Fairness Cap: Prevent Starvation ────────────────────────────────
  for (int i = 0; i < 4; i++) {
    if (i != activeLane && lanes[i].waitTime >= FAIRNESS_CAP) {
      Serial.print(F("[FAIR] Lane "));
      Serial.print(laneNames[i]);
      Serial.print(F(" waited "));
      Serial.print(lanes[i].waitTime);
      Serial.println(F("s — Forcing GREEN"));
      switchLane(i);
      return;
    }
  }

  // ─── 3. Compute Antigravity Priority Score ──────────────────────────────
  for (int i = 0; i < 4; i++) {
    if (i == activeLane) continue;

    float priority = lanes[i].density + (lanes[i].waitTime * 1.5);

    if (priority > highestPriority) {
      highestPriority = priority;
      bestLane = i;
    }
  }

  // ─── 4. Switch if better lane found ─────────────────────────────────────
  if (bestLane != activeLane && highestPriority > 0) {
    Serial.print(F("[PRIO] Best lane: "));
    Serial.print(laneNames[bestLane]);
    Serial.print(F(" (score: "));
    Serial.print(highestPriority);
    Serial.println(F(")"));
    switchLane(bestLane);
  } else {
    // No better lane — extend current green
    greenTimer = BASE_GREEN_TIME;
    Serial.print(F("[PRIO] No better lane — extending "));
    Serial.print(laneNames[activeLane]);
    Serial.println(F(" GREEN"));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// LANE SWITCHING
// Handles pedestrian safety delay, yellow phase, and signal transitions
// ──────────────────────────────────────────────────────────────────────────────
void switchLane(int next) {
  if (next == activeLane) return;

  Serial.print(F("[SWITCH] "));
  Serial.print(laneNames[activeLane]);
  Serial.print(F(" -> "));
  Serial.println(laneNames[next]);

  // Pedestrian safety: extra time if human detected in crosswalk
  if (lanes[activeLane].pedestrian) {
    Serial.println(F("[PED] Pedestrian in crosswalk — adding 5s safety delay"));
    delay(PEDESTRIAN_EXTRA);
  }

  // Yellow phase transition
  setSignal(activeLane, 2);  // Yellow
  delay(YELLOW_TIME);

  // Red for outgoing lane
  setSignal(activeLane, 1);  // Red

  // Activate new lane
  activeLane = next;
  lanes[activeLane].waitTime = 0;

  // Compute adaptive green duration based on density
  greenTimer = computeGreenDuration(activeLane);

  setSignal(activeLane, 3);  // Green

  Serial.print(F("[SWITCH] Lane "));
  Serial.print(laneNames[activeLane]);
  Serial.print(F(" GREEN for "));
  Serial.print(greenTimer);
  Serial.println(F("s"));
}

// ─── Adaptive Green Duration Calculation ──────────────────────────────────────
int computeGreenDuration(int laneIdx) {
  int base  = BASE_GREEN_TIME;
  int bonus = lanes[laneIdx].density / 5;
  if (bonus > 15) bonus = 15;

  int duration = base + bonus;
  if (duration < MIN_GREEN_TIME) duration = MIN_GREEN_TIME;
  if (duration > MAX_GREEN_TIME) duration = MAX_GREEN_TIME;

  return duration;
}

// ──────────────────────────────────────────────────────────────────────────────
// SIGNAL CONTROL
// Sets the physical LED state for a lane
// lane:  0=N, 1=E, 2=S, 3=W
// state: 1=Red, 2=Yellow, 3=Green
// ──────────────────────────────────────────────────────────────────────────────
void setSignal(int lane, int state) {
  int offset = lane * 3;
  int pinR = 2 + offset;
  int pinY = 3 + offset;
  int pinG = 4 + offset;

  digitalWrite(pinR, state == 1 ? HIGH : LOW);  // Red
  digitalWrite(pinY, state == 2 ? HIGH : LOW);  // Yellow
  digitalWrite(pinG, state == 3 ? HIGH : LOW);  // Green
}
