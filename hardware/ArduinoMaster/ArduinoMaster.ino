// ─── MAKEWAY: 3-Channel Adaptive Round-Robin ─────────────────────────────
// This master controller uses a strict sequential round-robin sequence
// (Lane 1 -> Lane 2 -> Lane 3) but intelligently adapts the green light 
// duration based on PCE density data streamed from ESP32-CAMs via Serial.
// PCE Weights synchronized with MakeWay server.js standard.
// ────────────────────────────────────────────────────────────────────────
#include <SoftwareSerial.h>

// Direction 1
int G1 = 8; int Y1 = 9; int R1 = 10;
// Direction 2
int G2 = 11; int Y2 = 12; int R2 = 13;
// Direction 3
int G3 = 22; int Y3 = 23; int R3 = 24; // Moved from 14-16 to avoid Serial3 conflict

// PCE Weights (Passenger Car Equivalents)
// ⚠️ MUST match server.js and app.py exactly for consistent priority decisions
const float PCE_AMBULANCE = 500.0; // Emergency override weight
const float PCE_BUS       = 15.0;  // High-occupancy vehicle priority
const float PCE_CAR       = 1.0;   // Baseline unit
const float PCE_BIKE      = 0.5;   // Sub-unit
const float PCE_LORRY     = 8.0;   // Heavy vehicle weight

// Real-time Traffic Memory
int density1 = 0; int ambulance1 = 0;
int density2 = 0; int ambulance2 = 0;
int density3 = 0; int ambulance3 = 0;
int pedestrian1 = 0; int pedestrian2 = 0; int pedestrian3 = 0;

// Hardware Override Pins
const int espSouth = 4; // Moved from 19 to avoid Serial1 conflict
const int espEast  = 5;  // Direction 2 pulse
const int espWest  = 3;  // Direction 3 pulse

// RFID Readers (EM-18 Standby)
SoftwareSerial rfidSouth(A4, 6); // RX: A4, TX: 6 (Dummy)
SoftwareSerial rfidEast(A3, 7);  // RX: A3, TX: 7 (Dummy)

// Dynamic Timing Parameters (in seconds)
const int BASE_GREEN_TIME = 15; 
const int MIN_GREEN_TIME  = 8;  
const int MAX_GREEN_TIME  = 40; 
const int YELLOW_TIME_MS  = 3000;

// Congestion Management
const int CONGESTION_THRESHOLD = 30; // PCE Density threshold for "Heavy Traffic"
bool junctionCongested = false;

// Serial Buffer Strings
String buffer1 = "";
String buffer2 = "";
String buffer3 = "";

// Helper Function Declarations
void allRed();
void parseSerialData();
void pollSerialPort(Stream &s, String &buf, int laneIdx);
void processMessage(String msg, int laneIdx);
int computeGreenDuration(int density, int amb, int laneIdx);
int extractValueAtPos(String msg, int pos);
void runLane(int G, int Y, int R, int density, int &amb, int laneIdx);
bool isJunctionCongested();
bool checkPriority(int currentLane);
void executePriority(int G, int R, int laneIdx, String source);
void cleanBuffers();
void broadcastPriority(bool active);

void setup() {
  Serial.begin(115200);   // USB Monitor
  Serial1.begin(115200);  // ESP32-CAM (Direction 1)
  Serial2.begin(115200);  // ESP32-CAM (Direction 2)
  Serial3.begin(115200);  // ESP32-CAM (Direction 3)

  for (int i = 8; i <= 13; i++) pinMode(i, OUTPUT);
  pinMode(G3, OUTPUT); pinMode(Y3, OUTPUT); pinMode(R3, OUTPUT);

  // Hardware Override Inputs
  pinMode(espSouth, INPUT);
  pinMode(espEast, INPUT);
  pinMode(espWest, INPUT);

  rfidSouth.begin(9600);
  rfidEast.begin(9600);
  
  // Safe Reset State
  allRed();
  
  Serial.println("\n====================================");
  Serial.println("MAKEWAY: 3-Way Smart Round-Robin Active");
  Serial.println("PCE: AMB=500 | BUS=15 | CAR=1 | BIKE=0.5");
  Serial.println("====================================\n");
}

void loop() {
  // Rapidly poll Serial to keep tracking ambulances/density across lanes
  parseSerialData();

  // --- DIRECTION 1 ---
  runLane(G1, Y1, R1, density1, ambulance1, 1);
  
  // --- DIRECTION 2 ---
  runLane(G2, Y2, R2, density2, ambulance2, 2);
  
  // --- DIRECTION 3 ---
  runLane(G3, Y3, R3, density3, ambulance3, 3);
}

// ─── Core Logic: Runs a strict lane pattern with adaptive timing ───
void runLane(int G, int Y, int R, int density, int &amb, int laneIdx) {
  // 1. Force all red just to be architecturally safe
  allRed();
  
  // 2. Refresh Congestion State
  junctionCongested = isJunctionCongested();
  if (junctionCongested) {
    Serial.println("[CRITICAL] Gridlock Detected: Entering ID-Priority Mode.");
  }

  // 3. Trigger Green Phase
  digitalWrite(R, LOW); 
  digitalWrite(G, HIGH); 
  
  // 4. Pedestrian Check - If a person is present, ensure safe minimum crossing time
  int currentPed = (laneIdx == 1) ? pedestrian1 : (laneIdx == 2) ? pedestrian2 : pedestrian3;
  
  // 5. Compute the "Best Output" (Adaptive Time) from real data
  int greenSecs = computeGreenDuration(density, amb, laneIdx);
  if (currentPed > 0 && greenSecs < 15) greenSecs = 15; // Safe crossing minimum

  Serial.print("[TRAFFIC] Lane ");
  Serial.print(laneIdx);
  Serial.print(" (Pin ");
  Serial.print(G); 
  Serial.print(") => GREEN for ");
  Serial.print(greenSecs);
  Serial.println(" seconds.");

  // 5. Non-blocking delay: Loop in 100ms chunks so we can continually fetch ESP32 data!
  // This allows the system to instantly capture an ambulance count arriving on *another* lane.
  for(int i = 0; i < (greenSecs * 10); i++) {
    if (checkPriority(laneIdx)) return; // Emergency/RFID Override
    delay(100);
    parseSerialData();
  }

  // 5. Trigger Yellow Transition Phase
  digitalWrite(G, LOW);
  digitalWrite(Y, HIGH); 
  delay(YELLOW_TIME_MS);            
  digitalWrite(Y, LOW);
  digitalWrite(R, HIGH); 
}

// ─── Math: Computes the most optimal green time ───
int computeGreenDuration(int density, int amb, int laneIdx) {
  // If an ambulance is spotted, maximize the lane's green time instantly!
  if (amb > 0) return MAX_GREEN_TIME;
  
  // If all lanes are heavy, prioritize identified high-value vehicles (Buses/Priority)
  if (junctionCongested) {
    // Check if this specific lane has identified Priority (Higher PCE weight already help, but we add more)
    // Here we can also integrate RFID identification data
    if (density > (CONGESTION_THRESHOLD * 1.5)) {
      return MAX_GREEN_TIME; // Extreme congestion override
    }
  }

  // Standard computation: Base Time + Density Bonus
  int duration = BASE_GREEN_TIME + (density / 2); 
  if (duration < MIN_GREEN_TIME) duration = MIN_GREEN_TIME;
  if (duration > MAX_GREEN_TIME) duration = MAX_GREEN_TIME;
  
  return duration;
}

bool isJunctionCongested() {
  return (density1 > CONGESTION_THRESHOLD && density2 > CONGESTION_THRESHOLD && density3 > CONGESTION_THRESHOLD);
}

// ─── Helper: Safely cuts all traffic ───
void allRed() {
  digitalWrite(R1, HIGH); digitalWrite(Y1, LOW); digitalWrite(G1, LOW);
  digitalWrite(R2, HIGH); digitalWrite(Y2, LOW); digitalWrite(G2, LOW);
  digitalWrite(R3, HIGH); digitalWrite(Y3, LOW); digitalWrite(G3, LOW);
}

// ─── Data Extraction ───────────────────────────────────────────────
void parseSerialData() {
  pollSerialPort(Serial1, buffer1, 1);
  pollSerialPort(Serial2, buffer2, 2);
  pollSerialPort(Serial3, buffer3, 3);
  cleanBuffers(); // Keep RFID buffers fresh
}

void pollSerialPort(Stream &s, String &buf, int laneIdx) {
  while (s.available()) {
    char c = s.read();
    if (c == '\n' || c == '\r') {
      if (buf.length() > 5) { 
        buf.trim();
        processMessage(buf, laneIdx);
      }
      buf = "";
    } else if (c >= 32 && c <= 126) { 
      buf += c;
      if (buf.length() >= 128) buf = "";
    }
  }
}

void processMessage(String msg, int laneIdx) {
  // Expected ESP32-CAM Input format: "LANE:1,AMB:0,BUS:1,CAR:8,BIKE:3"
  if (msg.startsWith("LANE:")) {
    // Basic String Parsing
    int ambIdx  = msg.indexOf("AMB:");
    int busIdx  = msg.indexOf("BUS:");
    int carIdx  = msg.indexOf("CAR:");
    int bikeIdx = msg.indexOf("BIKE:");
    int lryIdx  = msg.indexOf("LORRY:");
    int pedIdx  = msg.indexOf("PED:");

    int amb  = (ambIdx  != -1) ? extractValueAtPos(msg, ambIdx  + 4) : 0;
    int bus  = (busIdx  != -1) ? extractValueAtPos(msg, busIdx  + 4) : 0;
    int car  = (carIdx  != -1) ? extractValueAtPos(msg, carIdx  + 4) : 0;
    int bike = (bikeIdx != -1) ? extractValueAtPos(msg, bikeIdx + 5) : 0;
    int lry  = (lryIdx  != -1) ? extractValueAtPos(msg, lryIdx  + 6) : 0;
    int ped  = (pedIdx  != -1) ? extractValueAtPos(msg, pedIdx  + 4) : 0;
    
    // PCE Density algorithm 
    int density = (int)(amb * PCE_AMBULANCE + bus * PCE_BUS + car * PCE_CAR + bike * PCE_BIKE + lry * PCE_LORRY);

    // Save locally to state
    if (laneIdx == 1) { density1 = density; ambulance1 = amb; pedestrian1 = ped; }
    if (laneIdx == 2) { density2 = density; ambulance2 = amb; pedestrian2 = ped; }
    if (laneIdx == 3) { density3 = density; ambulance3 = amb; pedestrian3 = ped; }

    Serial.print("[DATA] Direction "); Serial.print(laneIdx);
    Serial.print(" Updated => Density: "); Serial.println(density);
  }
}

int extractValueAtPos(String msg, int pos) {
  String numStr = "";
  for (int i = pos; i < msg.length(); i++) {
    char c = msg.charAt(i);
    if (c >= '0' && c <= '9') numStr += c;
    else break;
  }
  if (numStr.length() == 0) return 0;
  return numStr.toInt();
}

  // 1. Standby EM-18 RFID Check
  rfidSouth.listen();
  if (currentLane != 1 && rfidSouth.available() >= 12) {
    String tag = "";
    while(rfidSouth.available()) tag += (char)rfidSouth.read();
    Serial.print("[RFID] Tag Detected South: "); Serial.println(tag);
    executePriority(G1, R1, 1, "SOUTH (RFID)");
    return true;
  }
  rfidEast.listen();
  if (currentLane != 2 && rfidEast.available() >= 12) {
    String tag = "";
    while(rfidEast.available()) tag += (char)rfidEast.read();
    Serial.print("[RFID] Tag Detected East: "); Serial.println(tag);
    executePriority(G2, R2, 2, "EAST (RFID)");
    return true;
  }

  // 2. Hardware Pulse Check (ESP32 Signal)
  if (currentLane != 1 && digitalRead(espSouth) == HIGH) {
    delay(150); // Noise filter
    if(digitalRead(espSouth) == HIGH) {
      executePriority(G1, R1, 1, "SOUTH (ESP_PULSE)");
      return true;
    }
  }
  if (currentLane != 2 && digitalRead(espEast) == HIGH) {
    delay(150);
    if(digitalRead(espEast) == HIGH) {
      executePriority(G2, R2, 2, "EAST (ESP_PULSE)");
      return true;
    }
  }
  if (currentLane != 3 && digitalRead(espWest) == HIGH) {
    delay(150); 
    if(digitalRead(espWest) == HIGH) {
      executePriority(G3, R3, 3, "WEST (ESP_PULSE)");
      return true;
    }
  }

  return false;
}

void executePriority(int G, int R, int laneIdx, String source) {
  Serial.print("[PRIORITY] Triggered by: "); Serial.println(source);
  
  // Notify connected ESP32s to trigger UI alerts
  broadcastPriority(true);
  
  allRed();
  delay(1000); // Safety pause
  
  digitalWrite(R, LOW);
  digitalWrite(G, HIGH);
  
  // 10s Override Green
  for(int i=0; i<100; i++) {
    delay(100);
    parseSerialData(); // Keep data moving
  }

  broadcastPriority(false); // Reset UI alert flag
  allRed();
  delay(2000); // Recovery
}

void cleanBuffers() {
  while(rfidSouth.available()) rfidSouth.read();
  while(rfidEast.available()) rfidEast.read();
}

void broadcastPriority(bool active) {
  String cmd = active ? "SYS_PRIORITY:ACTIVE" : "SYS_PRIORITY:RESET";
  Serial1.println(cmd);
  Serial2.println(cmd);
  Serial3.println(cmd);
}
