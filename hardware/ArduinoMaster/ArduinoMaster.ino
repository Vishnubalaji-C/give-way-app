/*
 * GIVEWAY - ANTIGRAVITY EDITION
 * Master Controller logic. Connect to Node.js backend via Serial or Wi-Fi Bridge.
 */

// Pin Definitions for 4 Lanes (North, East, South, West)
const int PIN_N_R = 2; const int PIN_N_Y = 3; const int PIN_N_G = 4;
const int PIN_E_R = 5; const int PIN_E_Y = 6; const int PIN_E_G = 7;
const int PIN_S_R = 8; const int PIN_S_Y = 9; const int PIN_S_G = 10;
const int PIN_W_R = 11; const int PIN_W_Y = 12; const int PIN_W_G = 13;

// Feature integration pins
const int BUZZER_PIN = 22; // For audio-visual ambulance alert
const int LDR_PIN = A0;    // For Solar-Ready eco mode logic

int density[4] = {0, 0, 0, 0}; // N, E, S, W
int waitTime[4] = {0, 0, 0, 0};
bool pedestrianInCrosswalk[4] = {false, false, false, false}; // Pedestrian Safety map
int activeLane = 0; // 0=N, 1=E, 2=S, 3=W

void setup() {
  Serial.begin(115200); // Communication with ESP32s
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);
  
  // Set all signal pins to OUTPUT
  for(int p=2; p<=13; p++) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }
  
  // Initialize safe state: North Solid Green, others Solid Red
  setSignal(0, 3); // N Green
  setSignal(1, 1); // E Red
  setSignal(2, 1); // S Red
  setSignal(3, 1); // W Red
}

void loop() {
  readSerialData();
  manageEcoMode();
  runAntigravityLogic();
  
  delay(1000); // Tick 1 sec
  
  for(int i=0; i<4; i++) {
     if(i != activeLane) waitTime[i]++; 
  }
}

void readSerialData() {
  // Expected Serial format from ESP32s: "N:45,S:12,E:999,W:2,PED_N:1"
  // Updates the density[4] array and pedestrianInCrosswalk array
  // 999 = Ambulance priority
}

void manageEcoMode() {
  // Solar-Ready Eco Mode Logic
  int ambientLight = analogRead(LDR_PIN);
  if (ambientLight < 300) { // Darkness threshold
    // Send signal to all ESP32-CAMs via serial RX/TX line
    Serial.println("SYS_CMD:ECO_NIGHT_MODE");
  } else {
    Serial.println("SYS_CMD:DAY_MODE");
  }
}

void runAntigravityLogic() {
  int bestLane = activeLane;
  float highestPriority = -1.0;
  bool emergencyActive = false;
  
  // 1. Check for Emergency & Audio Visual Buzzer Alert
  for(int i=0; i<4; i++) {
    if(density[i] >= 999) emergencyActive = true;
  }
  
  if(emergencyActive) {
    // High pitched rapid chirp for blind pedestrians & distracted drivers 
    tone(BUZZER_PIN, 1200, 150);
  } else {
    noTone(BUZZER_PIN);
  }
  
  // 2. Check Fairness Rule Limitation
  for(int i=0; i<4; i++) {
    if(waitTime[i] > 120) {
      switchLane(i);
      return;
    }
  }

  // 3. Compute Priority: Final_Priority = Density + (WaitTime * 1.5)
  for(int i=0; i<4; i++) {
     float priority = density[i] + (waitTime[i] * 1.5);
     if(priority > highestPriority) {
        highestPriority = priority;
        bestLane = i;
     }
  }
  
  if(bestLane != activeLane) {
     switchLane(bestLane);
  }
}

void switchLane(int next) {
   // Pedestrian Extra-Time Safety Feature
   if(pedestrianInCrosswalk[activeLane]) {
      // AI detects slow human in zebra cross - delays RED by 5 seconds
      delay(5000);
   }

   // Switch Sequence: Active -> Yellow -> Red -> Next -> Green
   setSignal(activeLane, 2); // Yellow
   delay(3000); // 3 sec Yellow Time
   setSignal(activeLane, 1); // Red
   
   activeLane = next;
   waitTime[activeLane] = 0;
   
   setSignal(activeLane, 3); // Green
}

void setSignal(int lane, int state) {
  // lane (0=N, 1=E, 2=S, 3=W)
  // state (1=Red, 2=Yellow, 3=Green)
  int offset = lane * 3;
  digitalWrite(2 + offset, state == 1 ? HIGH : LOW);
  digitalWrite(3 + offset, state == 2 ? HIGH : LOW);
  digitalWrite(4 + offset, state == 3 ? HIGH : LOW);
}
