// ─── MAKEWAY: Cloud-Driven Traffic Controller (Hardware Relay) ───────────────
// This is the minimal, ultra-fast Arduino firmware for MakeWay.
// Instead of doing any math locally, this controller acts purely as a 
// physical relay. It receives explicit commands (e.g., "1G", "2Y", "3R")
// over the USB Serial from the Node.js backend (which runs the AI logic).
// ─────────────────────────────────────────────────────────────────────────────

// Pin Definitions
// Direction 1 (South)
const int R1 = 10;
const int Y1 = 9;
const int G1 = 8;

// Direction 2 (East)
const int R2 = 13;
const int Y2 = 12;
const int G2 = 11;

// Direction 3 (West)
const int R3 = 24;
const int Y3 = 23;
const int G3 = 22;

void setup() {
  // Start USB serial communication at 115200 baud (matching server.js)
  Serial.begin(115200);
  
  // Configure all pins as OUTPUT
  pinMode(R1, OUTPUT); pinMode(Y1, OUTPUT); pinMode(G1, OUTPUT);
  pinMode(R2, OUTPUT); pinMode(Y2, OUTPUT); pinMode(G2, OUTPUT);
  pinMode(R3, OUTPUT); pinMode(Y3, OUTPUT); pinMode(G3, OUTPUT);
  
  // Power-on safety state: ALL RED
  digitalWrite(R1, HIGH); digitalWrite(Y1, LOW); digitalWrite(G1, LOW);
  digitalWrite(R2, HIGH); digitalWrite(Y2, LOW); digitalWrite(G2, LOW);
  digitalWrite(R3, HIGH); digitalWrite(Y3, LOW); digitalWrite(G3, LOW);

  Serial.println("MAKEWAY HARDWARE BRIDGE READY. WAITING FOR CLOUD AI...");
}

void loop() {
  // Check if our Node.js backend has sent an instruction
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n'); // Read full command until newline
    cmd.trim(); // Clean whitespace/invisible chars
    
    if (cmd.length() == 0) return;
    
    // Command format is exactly 2 characters long: "[LaneNumber][Color]"
    // Example: "1G" means Lane 1 turns Green. "2Y" means Lane 2 turns Yellow.
    
    char lane = cmd.charAt(0);
    char color = cmd.charAt(1);

    // Apply the instruction instantly
    if (lane == '1') {
      if (color == 'R') { digitalWrite(R1, HIGH); digitalWrite(Y1, LOW); digitalWrite(G1, LOW); }
      if (color == 'Y') { digitalWrite(R1, LOW); digitalWrite(Y1, HIGH); digitalWrite(G1, LOW); }
      if (color == 'G') { digitalWrite(R1, LOW); digitalWrite(Y1, LOW); digitalWrite(G1, HIGH); }
    } 
    else if (lane == '2') {
      if (color == 'R') { digitalWrite(R2, HIGH); digitalWrite(Y2, LOW); digitalWrite(G2, LOW); }
      if (color == 'Y') { digitalWrite(R2, LOW); digitalWrite(Y2, HIGH); digitalWrite(G2, LOW); }
      if (color == 'G') { digitalWrite(R2, LOW); digitalWrite(Y2, LOW); digitalWrite(G2, HIGH); }
    }
    else if (lane == '3') {
      if (color == 'R') { digitalWrite(R3, HIGH); digitalWrite(Y3, LOW); digitalWrite(G3, LOW); }
      if (color == 'Y') { digitalWrite(R3, LOW); digitalWrite(Y3, HIGH); digitalWrite(G3, LOW); }
      if (color == 'G') { digitalWrite(R3, LOW); digitalWrite(Y3, LOW); digitalWrite(G3, HIGH); }
    }
  }
}
