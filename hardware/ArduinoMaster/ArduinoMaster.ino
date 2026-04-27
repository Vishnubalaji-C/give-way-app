// ─── GIVEWAY: Advanced Traffic Hub (v4.0 - Mixed Reality Hardware) ──────────
// Optimized for: Arduino Mega 2560
//
// HARWARE CONFIGURATION:
// - Lane 1 (South): RFID (EM-18) on Pin A4 (SoftwareSerial RX)
// - Lane 2 (East):  RFID (EM-18) on Pin A3 (SoftwareSerial RX)
// - Lane 3 (West):  ESP32-CAM Pulses on Pins 19, 5, 3
// - Signals:        Pins 8-16 (R1,Y1,G1, R2,Y2,G2, R3,Y3,G3)
// - Buzzer:         Pin 22 (Priority Alert)
// ─────────────────────────────────────────────────────────────────────────────

#include <Arduino.h>
#include <SoftwareSerial.h>
#include <ctype.h>

// RFID Readers (SoftwareSerial)
// Note: We use 255 as a dummy TX pin since we only need to READ from the EM-18
SoftwareSerial rfidSouth(A4, 255); 
SoftwareSerial rfidEast(A3, 255);  

// Signals (8 to 16)
const int R1 = 8;  const int Y1 = 9;  const int G1 = 10;
const int R2 = 11; const int Y2 = 12; const int G2 = 13;
const int R3 = 14; const int Y3 = 15; const int G3 = 16;

// ESP32-CAM Pulse Pins (Lane 3)
const int PIN_LOW  = 19;
const int PIN_MED  = 5;
const int PIN_HIGH = 3;

const int BUZZER = 22;

void setup() {
  Serial.begin(115200);   // To PC
  rfidSouth.begin(9600); // EM-18 Lane 1
  rfidEast.begin(9600);  // EM-18 Lane 2

  // Signal Pins
  pinMode(R1, OUTPUT); pinMode(Y1, OUTPUT); pinMode(G1, OUTPUT);
  pinMode(R2, OUTPUT); pinMode(Y2, OUTPUT); pinMode(G2, OUTPUT);
  pinMode(R3, OUTPUT); pinMode(Y3, OUTPUT); pinMode(G3, OUTPUT);
  
  // ESP Pulse Pins
  pinMode(PIN_LOW, INPUT_PULLUP);
  pinMode(PIN_MED, INPUT_PULLUP);
  pinMode(PIN_HIGH, INPUT_PULLUP);
  
  pinMode(BUZZER, OUTPUT);

  // --- STARTUP LED DANCE (Hardware Verification) ---
  for(int i=0; i<3; i++) {
    digitalWrite(R1, HIGH); digitalWrite(R2, HIGH); digitalWrite(R3, HIGH);
    delay(100);
    digitalWrite(R1, LOW); digitalWrite(R2, LOW); digitalWrite(R3, LOW);
    delay(100);
  }
  
  allRed();
  Serial.println("GIVEWAY_V4_INIT_SUCCESS");
}

String fastReadRFID(SoftwareSerial &port) {
  String id = "";
  unsigned long start = millis();
  while (millis() - start < 40) { // Tiny 40ms window
    if (id.length() >= 12) break;
    if (port.available() > 0) {
      char c = port.read();
      if (isalnum(c)) id += c;
    }
  }
  return id;
}

void readPulses() {
  static int lastDensity = -1;
  int currentDensity = 0;
  
  if (digitalRead(PIN_HIGH) == LOW) currentDensity = 30;
  else if (digitalRead(PIN_MED) == LOW) currentDensity = 15;
  else if (digitalRead(PIN_LOW) == LOW) currentDensity = 5;
  
  if (currentDensity != lastDensity) {
    Serial.println("HW_PULSE:3:" + String(currentDensity));
    lastDensity = currentDensity;
  }
}

void setSignal(char lane, char color) {
  int r, y, g;
  if (lane == '1')      { r = R1; y = Y1; g = G1; }
  else if (lane == '2') { r = R2; y = Y2; g = G2; }
  else if (lane == '3') { r = R3; y = Y3; g = G3; }
  else return;

  if (color == 'R') { digitalWrite(r, HIGH); digitalWrite(y, LOW);  digitalWrite(g, LOW);  }
  if (color == 'Y') { digitalWrite(r, LOW);  digitalWrite(y, HIGH); digitalWrite(g, LOW);  }
  if (color == 'G') { digitalWrite(r, LOW);  digitalWrite(y, LOW);  digitalWrite(g, HIGH); }
}

void allRed() {
  setSignal('1', 'R');
  setSignal('2', 'R');
  setSignal('3', 'R');
}

void loop() {
  // 1. Handle Commands from PC (USB) - Non-blocking
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "B") { tone(BUZZER, 1000, 200); }
    else if (cmd.length() == 2) {
       setSignal(cmd[0], cmd[1]);
    }
    else if (cmd.startsWith("M:")) {
       String mode = cmd.substring(2);
       if (mode == "EMG") {
         // Siren tone for Emergency All-Stop
         tone(BUZZER, 2000, 1000);
       } else if (mode == "VIP") {
         // Solid acknowledgment beep
         tone(BUZZER, 500, 500);
       } else if (mode == "FES") {
         // Cheerful double-beep
         tone(BUZZER, 800, 200);
         delay(250);
         tone(BUZZER, 1000, 200);
       }
    }
  }

  // 2. High-Speed SoftwareSerial Fast-Poll
  rfidSouth.listen();
  if (rfidSouth.available() > 0) {
    String tag = fastReadRFID(rfidSouth);
    if (tag.length() >= 10) Serial.println("HW_RFID:1:" + tag);
  }

  rfidEast.listen();
  if (rfidEast.available() > 0) {
    String tag = fastReadRFID(rfidEast);
    if (tag.length() >= 10) Serial.println("HW_RFID:2:" + tag);
  }

  // 3. Lane 3 Pulsed Check
  readPulses();
}
