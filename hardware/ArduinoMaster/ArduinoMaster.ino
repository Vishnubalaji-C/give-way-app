// ─── GIVEWAY: Simplified Hardware Sync (v5.5 - Power Optimized) ──────────
// MATCHES YOUR WIRING: CAMs(14-19), LEDs(22-30)
// REMOVED: Buzzer and RFID Readers (To save power & pins)
// Optimized for: Arduino Mega 2560

#include <Arduino.h>

unsigned long lastHeartbeat = 0;

void setup() {
  // 115200 is standard for GiveWay Backend
  Serial.begin(115200);   
  
  // Hardware UARTs for ESP32-CAMs (Lane 1, 2, 3)
  Serial1.begin(115200);  
  Serial2.begin(115200);  
  Serial3.begin(115200);  

  // Set Signal Pins as OUTPUT
  for(int i=22; i<=30; i++) {
    pinMode(i, OUTPUT);
    digitalWrite(i, LOW);
  }
  
  // INITIAL TEST: Blink all LEDs for 1 second to verify power
  for(int i=22; i<=30; i++) digitalWrite(i, HIGH);
  delay(1000);
  for(int i=22; i<=30; i++) digitalWrite(i, LOW);

  // Default state: ALL RED
  setSignal('1', 'R'); setSignal('2', 'R'); setSignal('3', 'R');
  
  Serial.println("GIVEWAY_READY");
}

void loop() {
  // 1. HEARTBEAT: Tell the PC "I am alive" every 2 seconds for auto-connection
  if (millis() - lastHeartbeat > 2000) {
    Serial.println("GIVEWAY_ALIVE");
    lastHeartbeat = millis();
  }

  // 2. PC COMMANDS (Signal Controls)
  if (Serial.available() > 0) {
    char lane = Serial.read();
    
    // Active Ping Response
    if (lane == '?') {
      Serial.println("GIVEWAY_ALIVE");
    }
    else if (lane == '1' || lane == '2' || lane == '3') {
      while (Serial.available() == 0); // Wait for color byte
      char color = Serial.read();
      setSignal(lane, color);
    }
  }

  // 3. CAM POLL (Forwarding density data from ESP32-CAMs to Server)
  if (Serial1.available()) {
    String data = Serial1.readStringUntil('\n');
    data.trim();
    if (data.length() > 0) Serial.println("HW_CAM:1:" + data);
  }
  
  if (Serial2.available()) {
    String data = Serial2.readStringUntil('\n');
    data.trim();
    if (data.length() > 0) Serial.println("HW_CAM:2:" + data);
  }
  
  if (Serial3.available()) {
    String data = Serial3.readStringUntil('\n');
    data.trim();
    if (data.length() > 0) Serial.println("HW_CAM:3:" + data);
  }
}

void setSignal(char lane, char color) {
  int startPin = 22 + (lane - '1') * 3; // Lane 1: 22, Lane 2: 25, Lane 3: 28
  
  // Reset all 3 LEDs for this lane
  digitalWrite(startPin,   LOW);
  digitalWrite(startPin+1, LOW);
  digitalWrite(startPin+2, LOW);

  // Set the specific color
  if (color == 'R') digitalWrite(startPin,   HIGH);
  if (color == 'Y') digitalWrite(startPin+1, HIGH);
  if (color == 'G') digitalWrite(startPin+2, HIGH);
}
