/*
 * GIVEWAY - ESP32-CAM Edge Node
 * AI-Thinker ESP32-CAM Module
 * 
 * Captures JPEG frames via OV2640 camera, sends them to a YOLO inference 
 * endpoint for vehicle detection, computes a PCE Density Score from the 
 * results, and POSTs JSON payloads to the MakeWay Node.js server.
 * 
 * Hardware: ESP32-CAM (AI-Thinker)
 * Board:    "AI Thinker ESP32-CAM" in Arduino IDE
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include "esp_camera.h"

// ─── Wi-Fi Credentials ────────────────────────────────────────────────────────
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PWD";

// ─── Server Endpoints ─────────────────────────────────────────────────────────
// Replace with your PC / deployed server IP
const char* serverUrl    = "http://192.168.1.100:4000/api/edge-data";
const char* inferenceUrl = "http://192.168.1.100:5000/detect";  // YOLO endpoint
const String laneId      = "N";      // Change per node: N, S, E, W
const String junctionId  = "JN-001"; // Unique ID for this junction deployment

// ─── AI-Thinker ESP32-CAM Pin Definitions ─────────────────────────────────────
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Built-in flash LED
#define FLASH_GPIO_NUM     4

// ─── Runtime State ────────────────────────────────────────────────────────────
bool ecoModeActive     = false;
bool cameraInitialized = false;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 5000;  // 5 sec matching server architecture

// Fallback vehicle counts (used when inference endpoint is unavailable)
int fallbackAmbulance = 0;
int fallbackBus       = 0;
int fallbackCar       = 0;
int fallbackBike      = 0;

// ─── Camera Initialization ────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Use PSRAM if available for higher resolution
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;   // 640x480
    config.jpeg_quality = 12;
    config.fb_count     = 2;
    Serial.println("[CAM] PSRAM found — VGA mode, dual buffer");
  } else {
    config.frame_size   = FRAMESIZE_QVGA;  // 320x240
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    Serial.println("[CAM] No PSRAM — QVGA mode, single buffer");
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init FAILED: 0x%x\n", err);
    return false;
  }

  // Tune sensor defaults
  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_wb_mode(s, 0);
  }

  Serial.println("[CAM] Initialization successful");
  return true;
}

// ─── Wi-Fi Connection ─────────────────────────────────────────────────────────
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to %s", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection FAILED — will retry next cycle");
  }
}

// ─── Eco-Mode Handler (Serial commands from Arduino Master) ───────────────────
void handleSerialCommands() {
  while (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.indexOf("SYS_CMD:ECO_NIGHT_MODE") != -1 && !ecoModeActive) {
      ecoModeActive = true;
      sensor_t* s = esp_camera_sensor_get();
      if (s) {
        s->set_framesize(s, FRAMESIZE_QVGA);   // Low-res to save bandwidth
        s->set_special_effect(s, 2);            // Grayscale (30% less processing)
      }
      Serial.println("[ECO] Night mode engaged — QVGA Grayscale active");
    }
    else if (command.indexOf("SYS_CMD:DAY_MODE") != -1 && ecoModeActive) {
      ecoModeActive = false;
      sensor_t* s = esp_camera_sensor_get();
      if (s) {
        s->set_framesize(s, FRAMESIZE_VGA);     // Standard resolution
        s->set_special_effect(s, 0);            // Full color
      }
      Serial.println("[ECO] Day mode restored — VGA Full-Color active");
    }
  }
}

// ─── Send Frame to YOLO Inference Endpoint ────────────────────────────────────
// Returns true if inference was successful and vehicle counts were parsed
bool sendFrameForInference(camera_fb_t* fb, int &amb, int &bus, int &car, int &bike) {
  if (!fb || fb->len == 0) return false;

  HTTPClient http;
  http.begin(inferenceUrl);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(8000);  // 8 sec timeout for inference

  int httpCode = http.POST(fb->buf, fb->len);

  if (httpCode == 200) {
    String response = http.getString();
    
    // Parse JSON response: { "ambulance": 0, "bus": 1, "car": 4, "bike": 3 }
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      amb  = doc["ambulance"] | 0;
      bus  = doc["bus"]       | 0;
      car  = doc["car"]       | 0;
      bike = doc["bike"]      | 0;
      http.end();
      return true;
    } else {
      Serial.printf("[YOLO] JSON parse error: %s\n", error.c_str());
    }
  } else {
    Serial.printf("[YOLO] Inference request failed: HTTP %d\n", httpCode);
  }

  http.end();
  return false;
}

// ─── Post Vehicle Data to GiveWay Server ──────────────────────────────────────
void postEdgeData(int amb, int bus, int car, int bike, bool pedestrian) {
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["laneId"]     = laneId;
  doc["junctionId"] = junctionId;
  doc["secret"]     = "GIVEWAY_NODE_KEY";

  JsonObject vehicles = doc.createNestedObject("vehicles");
  vehicles["ambulance"] = amb;
  vehicles["bus"]       = bus;
  vehicles["car"]       = car;
  vehicles["bike"]      = bike;

  doc["pedestrian"] = pedestrian;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("[POST] Server response: HTTP %d\n", httpCode);
    if (httpCode == 200) {
      String response = http.getString();
      Serial.printf("[POST] Result: %s\n", response.c_str());
    }
  } else {
    Serial.printf("[POST] Request failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ─── Capture & Process Pipeline ───────────────────────────────────────────────
void captureAndProcess() {
  if (!cameraInitialized) {
    Serial.println("[PIPE] Camera not initialized — sending fallback data");
    postEdgeData(fallbackAmbulance, fallbackBus, fallbackCar, fallbackBike, false);
    return;
  }

  // Brief flash for low-light (eco mode)
  if (ecoModeActive) {
    digitalWrite(FLASH_GPIO_NUM, HIGH);
    delay(100);
  }

  // Capture frame
  camera_fb_t* fb = esp_camera_fb_get();

  if (ecoModeActive) {
    digitalWrite(FLASH_GPIO_NUM, LOW);
  }

  if (!fb) {
    Serial.println("[CAM] Frame capture failed!");
    postEdgeData(fallbackAmbulance, fallbackBus, fallbackCar, fallbackBike, false);
    return;
  }

  Serial.printf("[CAM] Captured frame: %d bytes (%dx%d)\n", fb->len, fb->width, fb->height);

  // Attempt YOLO inference
  int amb = 0, bus = 0, car = 0, bike = 0;
  bool inferenceOk = sendFrameForInference(fb, amb, bus, car, bike);

  // Release frame buffer immediately
  esp_camera_fb_return(fb);

  if (inferenceOk) {
    Serial.printf("[YOLO] Detected — Amb:%d Bus:%d Car:%d Bike:%d\n", amb, bus, car, bike);
    // Update fallback values with latest successful detection
    fallbackAmbulance = amb;
    fallbackBus       = bus;
    fallbackCar       = car;
    fallbackBike      = bike;
  } else {
    Serial.println("[YOLO] Inference unavailable — using last known counts");
    amb  = fallbackAmbulance;
    bus  = fallbackBus;
    car  = fallbackCar;
    bike = fallbackBike;
  }

  // Post to GiveWay server
  // pedestrian detection is part of YOLO — for now set false (extend later)
  postEdgeData(amb, bus, car, bike, false);
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n╔══════════════════════════════════════╗");
  Serial.println("║   GIVEWAY — ESP32-CAM Edge Node      ║");
  Serial.printf( "║   Lane: %s                            ║\n", laneId.c_str());
  Serial.println("╚══════════════════════════════════════╝\n");

  // Flash LED pin
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  // Initialize camera
  cameraInitialized = initCamera();

  // Connect to Wi-Fi
  connectWiFi();

  // Initialize Wireless Flashing Support
  ArduinoOTA.setHostname(("GiveWay-Node-" + laneId).c_str());
  ArduinoOTA.begin();

  Serial.println("[INIT] Setup complete — entering main loop\n");
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
void loop() {
  ArduinoOTA.handle(); // Watch for OTA firmware flashes

  // Handle eco-mode commands from Arduino Master
  handleSerialCommands();

  // Reconnect Wi-Fi if disconnected
  connectWiFi();

  // Capture and send at defined intervals
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;

    if (WiFi.status() == WL_CONNECTED) {
      captureAndProcess();
    } else {
      Serial.println("[WIFI] Not connected — skipping this cycle");
    }
  }

  delay(100);  // Small delay to prevent watchdog resets
}
