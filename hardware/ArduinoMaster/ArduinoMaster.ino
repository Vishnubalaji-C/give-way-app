// ─── GIVEWAY: Simplified Hardware Sync (v5.6 - Custom Pins) ──────────
// WIRING:
// Lane 1: Red=2, Yellow=3, Green=4
// Lane 2: Red=5, Yellow=6, Green=7
// Lane 3: Red=8, Yellow=9, Green=10
// REMOVED: ESP32-CAM UART logic to simplify hardware setup.

#include <Arduino.h>

unsigned long lastHeartbeat = 0;

void setup() {
  // 115200 is standard for GiveWay Backend
  Serial.begin(115200);   

  // Set Signal Pins as OUTPUT (Pins 2 to 10)
  for(int i=2; i<=10; i++) {
    pinMode(i, OUTPUT);
    digitalWrite(i, LOW);
  }
  
  // INITIAL TEST: Blink all LEDs for 1 second to verify power
  for(int i=2; i<=10; i++) digitalWrite(i, HIGH);
  delay(1000);
  for(int i=2; i<=10; i++) digitalWrite(i, LOW);

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

  // 2. PC COMMANDS (Signal Controls from Web/Mobile Dashboard)
  if (Serial.available() > 0) {
    char lane = Serial.read();
    
    // Active Ping Response
    if (lane == '?') {
      Serial.println("GIVEWAY_ALIVE");
    }
    // Receive Lane ID (1, 2, or 3)
    else if (lane == '1' || lane == '2' || lane == '3') {
      while (Serial.available() == 0); // Wait for color byte
      char color = Serial.read();
      setSignal(lane, color);
    }
  }
}

// Function to control specific lane colors based on PC commands
void setSignal(char lane, char color) {
  int startPin = 0;
  
  // Map Lane to its starting RED pin based on your configuration
  if (lane == '1') startPin = 2;       // Lane 1 starts at 2
  else if (lane == '2') startPin = 5;  // Lane 2 starts at 5
  else if (lane == '3') startPin = 8;  // Lane 3 starts at 8
  else return; // Safety exit
  
  // Reset all 3 LEDs for this lane to LOW
  digitalWrite(startPin,   LOW); // Red
  digitalWrite(startPin+1, LOW); // Yellow
  digitalWrite(startPin+2, LOW); // Green

  // Set the requested color to HIGH
  if (color == 'R') digitalWrite(startPin,   HIGH);
  else if (color == 'Y') digitalWrite(startPin+1, HIGH);
  else if (color == 'G') digitalWrite(startPin+2, HIGH);
}
