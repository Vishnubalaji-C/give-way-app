/*
 * GiveWay ATES — Master Traffic Controller (v2.6 Sync Edition)
 * 
 * PIN MAPPING:
 * Lane 1: Red=2, Yellow=3, Green=4
 * Lane 2: Red=5, Yellow=6, Green=7
 * Lane 3: Red=8, Yellow=9, Green=10
 * Buzzer: Pin 13
 */

const int BUZZER_PIN = 13;

void setup() {
  Serial.begin(115200);
  for (int i = 2; i <= 10; i++) {
    pinMode(i, OUTPUT);
    digitalWrite(i, LOW);
  }
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Power-on Self Test
  for (int i = 2; i <= 10; i++) digitalWrite(i, HIGH);
  delay(300);
  for (int i = 2; i <= 10; i++) digitalWrite(i, LOW);
  
  // Start in Safety Mode (All Red)
  setSignal(1, 'R');
  setSignal(2, 'R');
  setSignal(3, 'R');
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    if (command.length() == 0) return;

    // --- Auto-Discovery ---
    if (command == "?") { Serial.println("GIVEWAY"); return; }

    // --- Handle System Modes (M:AUT, M:EMG, M:VIP, M:FES) ---
    if (command.startsWith("M:")) {
      String mode = command.substring(2);
      if (mode == "EMG") {
        setSignal(1, 'R'); setSignal(2, 'R'); setSignal(3, 'R');
        triggerBuzzer(3); // Long alert for emergency
      } else if (mode == "FES") {
        blinkAll('Y'); // Yellow confirmation for Festival
      } else if (mode == "VIP") {
        blinkAll('G'); // Green confirmation for VIP
      }
      return;
    }

    // --- Handle Lane Signals (1G, 2R, etc.) ---
    if (command.length() >= 2) {
      int lane = command.charAt(0) - '0';
      char action = command.charAt(1);
      if (lane >= 1 && lane <= 3) {
        if (action == 'B') triggerBuzzer(1);
        else setSignal(lane, action);
      }
    }
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

void triggerBuzzer(int count) {
  for(int i=0; i<count; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(100);
    digitalWrite(BUZZER_PIN, LOW); delay(100);
  }
}
