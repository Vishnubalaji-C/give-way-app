#include <SoftwareSerial.h>

// --- PIN DEFINITIONS (LOCKED) ---
const int G_South = 8;  const int Y_South = 9;  const int R_South = 10;
const int G_East = 11;  const int Y_East = 12; const int R_East = 13;
const int G_West = 14;  const int Y_West = 15; const int R_West = 16; 
const int buzzerPin = 22; 

const int pulseSouth = 19;
const int pulseEast = 5;
const int pulseWest = 3;

SoftwareSerial rfidSouth(A4, 100); 
SoftwareSerial rfidEast(A3, 100);  

void setup() {
  Serial.begin(9600);
  rfidSouth.begin(9600);
  rfidEast.begin(9600);
  
  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW); 

  pinMode(pulseSouth, INPUT);
  pinMode(pulseEast, INPUT);
  pinMode(pulseWest, INPUT);

  for (int i = 8; i <= 16; i++) pinMode(i, OUTPUT);
  
  forceAllRed();
  Serial.println("SYSTEM READY: UPLOAD SUCCESSFUL");
}

void loop() {
  runCycle(G_South, Y_South, R_South, "SOUTH");
  runCycle(G_East, Y_East, R_East, "EAST");
  runCycle(G_West, Y_West, R_West, "WEST");
}

void runCycle(int green, int yellow, int red, String label) {
  cleanBuffers(); 
  digitalWrite(red, LOW);
  digitalWrite(green, HIGH);

  // Monitor sensors during the 10-second green phase
  for (int i = 0; i < 100; i++) {
    if (checkPriority(label)) return; 
    delay(100); 
  }

  // Standard Yellow Transition
  digitalWrite(green, LOW);
  digitalWrite(yellow, HIGH);
  delay(3000); 
  digitalWrite(yellow, LOW);
  digitalWrite(red, HIGH);
}

bool checkPriority(String activeLane) {
  // Check South
  if (activeLane != "SOUTH") {
    rfidSouth.listen();
    if (rfidSouth.available() > 0 || digitalRead(pulseSouth) == HIGH) {
      handlePriorityTrigger(G_South, R_South, "SOUTH");
      return true;
    }
  }
  // Check East
  if (activeLane != "EAST") {
    rfidEast.listen();
    if (rfidEast.available() > 0 || digitalRead(pulseEast) == HIGH) {
      handlePriorityTrigger(G_East, R_East, "EAST");
      return true;
    }
  }
  // Check West
  if (activeLane != "WEST" && digitalRead(pulseWest) == HIGH) {
    handlePriorityTrigger(G_West, R_West, "WEST");
    return true;
  }
  return false;
}

void handlePriorityTrigger(int green, int red, String laneName) {
  digitalWrite(buzzerPin, HIGH); 
  delay(400);                    
  digitalWrite(buzzerPin, LOW);  
  
  forceAllRed();
  delay(1000); // Safety All-Red
  
  digitalWrite(red, LOW);
  digitalWrite(green, HIGH);
  delay(10000); // 10s Priority

  // Smooth clear using the next pin (Yellow)
  digitalWrite(green, LOW);
  digitalWrite(green + 1, HIGH); // Green + 1 is always the Yellow pin
  delay(2000);
  digitalWrite(green + 1, LOW);
  
  cleanBuffers(); 
  forceAllRed();
  delay(1000); 
}

void cleanBuffers() {
  while(rfidSouth.available() > 0) rfidSouth.read();
  while(rfidEast.available() > 0) rfidEast.read();
}

void forceAllRed() {
  digitalWrite(G_South, LOW); digitalWrite(Y_South, LOW); digitalWrite(R_South, HIGH);
  digitalWrite(G_East, LOW);  digitalWrite(Y_East, LOW);  digitalWrite(R_East, HIGH);
  digitalWrite(G_West, LOW);  digitalWrite(Y_West, LOW);  digitalWrite(R_West, HIGH);
}