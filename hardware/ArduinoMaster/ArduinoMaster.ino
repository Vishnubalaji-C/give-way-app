// ─── GIVEWAY: 3-Channel Adaptive Round-Robin ─────────────────────────────
// This master controller uses a strict sequential round-robin sequence
// (Lane 1 -> Lane 2 -> Lane 3) but intelligently adapts the green light 
// duration based on PCE density data streamed from ESP32-CAMs via Serial.
// ────────────────────────────────────────────────────────────────────────

// Direction 1
int G1 = 8; int Y1 = 9; int R1 = 10;
// Direction 2
int G2 = 11; int Y2 = 12; int R2 = 13;
// Direction 3
int G3 = 14; int Y3 = 15; int R3 = 16;

// PCE Weights (Passenger Car Equivalents)
const float PCE_AMBULANCE = 999.0;
const float PCE_BUS       = 10.0;
const float PCE_CAR       = 1.0;
const float PCE_BIKE      = 0.5;

// Real-time Traffic Memory
int density1 = 0; int ambulance1 = 0;
int density2 = 0; int ambulance2 = 0;
int density3 = 0; int ambulance3 = 0;

// Dynamic Timing Parameters (in seconds)
const int BASE_GREEN_TIME = 15; 
const int MIN_GREEN_TIME  = 8;  
const int MAX_GREEN_TIME  = 40; 
const int YELLOW_TIME_MS  = 3000;

// Serial Buffer Strings
String buffer1 = "";
String buffer2 = "";
String buffer3 = "";

// Helper Function Declarations
void allRed();
void parseSerialData();
void pollSerialPort(Stream &s, String &buf, int laneIdx);
void processMessage(String msg, int laneIdx);
int computeGreenDuration(int density, int amb);
int extractValueAtPos(String msg, int pos);
void runLane(int G, int Y, int R, int density, int &amb);

void setup() {
  Serial.begin(115200);   // USB Monitor
  Serial1.begin(115200);  // ESP32-CAM (Direction 1)
  Serial2.begin(115200);  // ESP32-CAM (Direction 2)
  Serial3.begin(115200);  // ESP32-CAM (Direction 3)

  // Pin Configuration: 8 through 16
  for (int i = 8; i <= 16; i++) {
    pinMode(i, OUTPUT);
  }
  
  // Safe Reset State
  allRed();
  
  Serial.println("\n====================================");
  Serial.println("GIVEWAY: 3-Way Smart Round-Robin Active");
  Serial.println("====================================\n");
}

void loop() {
  // Rapidly poll Serial to keep tracking ambulances/density across lanes
  parseSerialData();

  // --- DIRECTION 1 ---
  runLane(G1, Y1, R1, density1, ambulance1);
  
  // --- DIRECTION 2 ---
  runLane(G2, Y2, R2, density2, ambulance2);
  
  // --- DIRECTION 3 ---
  runLane(G3, Y3, R3, density3, ambulance3);
}

// ─── Core Logic: Runs a strict lane pattern with adaptive timing ───
void runLane(int G, int Y, int R, int density, int &amb) {
  // 1. Force all red just to be architecturally safe
  allRed();
  
  // 2. Trigger Green Phase
  digitalWrite(R, LOW); 
  digitalWrite(G, HIGH); 
  
  // 3. Compute the "Best Output" (Adaptive Time) from real data
  int greenSecs = computeGreenDuration(density, amb);

  Serial.print("[TRAFFIC] Lane with Green Pin ");
  Serial.print(G); 
  Serial.print(" => GREEN for ");
  Serial.print(greenSecs);
  Serial.println(" seconds.");

  // 4. Non-blocking delay: Loop in 100ms chunks so we can continually fetch ESP32 data!
  // This allows the system to instantly capture an ambulance count arriving on *another* lane.
  for(int i = 0; i < (greenSecs * 10); i++) {
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
int computeGreenDuration(int density, int amb) {
  // If an ambulance is spotted, maximize the lane's green time instantly!
  if (amb > 0) return MAX_GREEN_TIME;
  
  // Standard computation: Base Time + Density Bonus
  int duration = BASE_GREEN_TIME + (density / 2); // E.g., density 10 gives +5s
  if (duration < MIN_GREEN_TIME) duration = MIN_GREEN_TIME;
  if (duration > MAX_GREEN_TIME) duration = MAX_GREEN_TIME;
  
  return duration;
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

    int amb  = (ambIdx != -1)  ? extractValueAtPos(msg, ambIdx + 4)  : 0;
    int bus  = (busIdx != -1)  ? extractValueAtPos(msg, busIdx + 4)  : 0;
    int car  = (carIdx != -1)  ? extractValueAtPos(msg, carIdx + 4)  : 0;
    int bike = (bikeIdx != -1) ? extractValueAtPos(msg, bikeIdx + 5) : 0;
    
    // PCE Density algorithm 
    int density = (int)(amb * PCE_AMBULANCE + bus * PCE_BUS + car * PCE_CAR + bike * PCE_BIKE);

    // Save locally to state
    if (laneIdx == 1) { density1 = density; ambulance1 = amb; }
    if (laneIdx == 2) { density2 = density; ambulance2 = amb; }
    if (laneIdx == 3) { density3 = density; ambulance3 = amb; }

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
