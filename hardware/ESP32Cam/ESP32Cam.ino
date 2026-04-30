/*
 * Updated Traffic Signal Hardware Test
 * Target Hardware: Arduino Mega 2560
 * ---------------------------------------------------------
 * Pin Mapping from Screenshot:
 * Lane 1: Red 22, Yellow 23, Green 24
 * Lane 2: Red 25, Yellow 26, Green 27
 * Lane 3: Red 28, Yellow 29, Green 30
 */

// Lane Arrays based on your new configuration
const int redPins[]    = {22, 25, 28};
const int yellowPins[] = {23, 26, 29};
const int greenPins[]  = {24, 27, 30};

void setup() {
  // Set all 9 traffic light pins as OUTPUT
  for (int i = 0; i < 3; i++) {
    pinMode(redPins[i], OUTPUT);
    pinMode(yellowPins[i], OUTPUT);
    pinMode(greenPins[i], OUTPUT);
  }
  
  // Optional: Initialize Serial for the CAMs/RFID to ensure pins are ready
  Serial.begin(9600); 
  Serial1.begin(9600); // Pins 18/19
  Serial2.begin(9600); // Pins 16/17
  Serial3.begin(9600); // Pins 14/15
}

void loop() {
  // Cycle Green
  setGroup(greenPins, HIGH);
  delay(1000);
  setGroup(greenPins, LOW);

  // Cycle Yellow
  setGroup(yellowPins, HIGH);
  delay(1000);
  setGroup(yellowPins, LOW);

  // Cycle Red
  setGroup(redPins, HIGH);
  delay(1000);
  setGroup(redPins, LOW);
}

// Simple helper to toggle groups
void setGroup(const int pins[], int state) {
  for (int i = 0; i < 3; i++) {
    digitalWrite(pins[i], state);
  }
}