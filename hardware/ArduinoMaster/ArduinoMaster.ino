/*
 * GiveWay ATES — Master AI Bridge (Dynamic Sync v3.0)
 * 
 * This code allows the Node.js AI to control the lights dynamically.
 * PIN MAPPING:
 * Lane 1: Red=2, Yellow=3, Green=4
 * Lane 2: Red=5, Yellow=6, Green=7
 * Lane 3: Red=8, Yellow=9, Green=10
 * Status LED: Pin 13 (Blinks when AI is talking)
 */

void setup() {
  Serial.begin(115200); // High speed for AI sync
  
  for (int i = 2; i <= 10; i++) {
    pinMode(i, OUTPUT);
    digitalWrite(i, LOW);
  }
  pinMode(13, OUTPUT);

  // Initial Safety State: All Red
  setSignal(1, 'R');
  setSignal(2, 'R');
  setSignal(3, 'R');
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    if (command.length() == 0) return;

    // Pulse the Status LED to show AI activity
    digitalWrite(13, HIGH);

    // --- Auto-Discovery Ping ---
    if (command == "?") { 
      Serial.println("GIVEWAY"); 
    } 

    // --- Handle System Modes (M:EMG, M:VIP, M:FES) ---
    else if (command.startsWith("M:")) {
      String mode = command.substring(2);
      if (mode == "EMG") {
        setSignal(1, 'R'); setSignal(2, 'R'); setSignal(3, 'R');
      } else if (mode == "FES") {
        blinkAll('Y');
      } else if (mode == "VIP") {
        blinkAll('G');
      }
    }

    // --- Handle Dynamic AI Signal Changes (e.g., "1G", "2R") ---
    else if (command.length() >= 2) {
      int lane = command.charAt(0) - '0';
      char action = command.charAt(1);
      if (lane >= 1 && lane <= 3) {
        setSignal(lane, action);
      }
    }
    
    delay(10);
    digitalWrite(13, LOW);
  }
}

void setSignal(int lane, char color) {
  int r, y, g;
  if (lane == 1) { r=2; y=3; g=4; }
  else if (lane == 2) { r=5; y=6; g=7; }
  else if (lane == 3) { r=8; y=9; g=10; }
  else return;

  digitalWrite(r, LOW); digitalWrite(y, LOW); digitalWrite(g, LOW);
  if (color == 'R') digitalWrite(r, HIGH);
  else if (color == 'Y') digitalWrite(y, HIGH);
  else if (color == 'G') digitalWrite(g, HIGH);
}

void blinkAll(char color) {
  for(int i=0; i<2; i++) {
    setSignal(1, color); setSignal(2, color); setSignal(3, color);
    delay(200);
    setSignal(1, 'R'); setSignal(2, 'R'); setSignal(3, 'R');
    delay(200);
  }
}