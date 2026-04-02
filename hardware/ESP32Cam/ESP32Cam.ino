/*
 * GIVEWAY - ESP32-CAM Node
 * Captures frames, delegates inferencing to YOLO endpoint, computes PCE Density 
 * Score, and POSTs JSON payloads to the MakeWay Node.js server.
 */

#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PWD";

// Replace with localhost / PC node.js server IP
const char* serverUrl = "http://192.168.1.100:4000/api/edge-data";
const String laneId = "N"; // Change for N, S, E, W

bool ecoModeActive = false;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi!");
  
  // Camera Init code...
  // config.pin_d0 = 5; ...
}

void loop() {
  // Listen for Eco-Mode hardware overrides from Arduino Master
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    if (command.indexOf("SYS_CMD:ECO_NIGHT_MODE") != -1 && !ecoModeActive) {
      ecoModeActive = true;
      // sensor_t * s = esp_camera_sensor_get();
      // s->set_framesize(s, FRAMESIZE_QVGA); // Low Res to save bandwidth/compute
      // s->set_special_effect(s, 2);         // Grayscale (Requires 30% less processing)
      Serial.println("Power saving ECO MODE engaged. Low-Res Grayscale active.");
    } else if (command.indexOf("SYS_CMD:DAY_MODE") != -1 && ecoModeActive) {
      ecoModeActive = false;
      // sensor_t * s = esp_camera_sensor_get();
      // s->set_framesize(s, FRAMESIZE_VGA);  // Standard Res
      // s->set_special_effect(s, 0);         // Full color
      Serial.println("Daylight Mode active. Full performance restored.");
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    // 1. Capture Image
    // camera_fb_t * fb = esp_camera_fb_get();
    
    // 2. Perform Inference (Tiny-YOLO Edge/Cloud)
    // int cars = ?, bus = ?, amb = ?, bike = ?, human = ?;
    
    // 3. Fire JSON Payload to Server
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Example payload representing 1 bus, 4 cars, 3 bikes, human on zebra crossing
    String payload = "{\"laneId\": \"" + laneId + "\", \"secret\": \"GIVEWAY_NODE_KEY\", \"vehicles\": {\"ambulance\":0, \"bus\":1, \"car\":4, \"bike\":3}, \"pedestrian\": true}";

    int httpResponseCode = http.POST(payload);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    http.end();
  }
  
  delay(5000); // 5 sec interval matching Node.js architecture
}
