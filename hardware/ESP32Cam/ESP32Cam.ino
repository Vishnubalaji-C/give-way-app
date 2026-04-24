#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

/**
 * GIVEWAY: ESP32-CAM AI Uplink Node
 * This firmware captures JPEG frames and sends them to the Python Inference Server.
 * It also triggers physical pulses to the Arduino Mega based on traffic density.
 */

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_LAPTOP_IP:5000/detect?lane=3"; // Lane 3 is the AI lane

// --- PIN DEFINITIONS (To Arduino Mega) ---
const int PIN_LOW  = 14; 
const int PIN_MED  = 15;
const int PIN_HIGH = 13;

// --- CAMERA PINS (AI-Thinker Model) ---
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

void setup() {
  Serial.begin(115200);
  
  pinMode(PIN_LOW, OUTPUT);  digitalWrite(PIN_LOW, HIGH);
  pinMode(PIN_MED, OUTPUT);  digitalWrite(PIN_MED, HIGH);
  pinMode(PIN_HIGH, OUTPUT); digitalWrite(PIN_HIGH, HIGH);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) { Serial.printf("Camera init failed with error 0x%x", err); return; }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) { Serial.println("Camera capture failed"); return; }

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "image/jpeg");
    
    int httpResponseCode = http.POST(fb->buf, fb->len);
    
    if (httpResponseCode == 200) {
      String payload = http.getString();
      Serial.println(payload);
      
      // LOGIC: Reset all pulses
      digitalWrite(PIN_LOW, HIGH); digitalWrite(PIN_MED, HIGH); digitalWrite(PIN_HIGH, HIGH);

      // Trigger Arduino based on PCE Score (Simplistic check for this demo)
      if (payload.indexOf("\"pce_score\":") > 0) {
         // Note: Real parsing would use ArduinoJson
         if (payload.indexOf("\"ambulance\":1") > 0) digitalWrite(PIN_HIGH, LOW); // Max Priority
         else if (payload.indexOf("\"bus\":1") > 0)   digitalWrite(PIN_MED, LOW);
      }
    }
    
    http.end();
    esp_camera_fb_return(fb);
  }
  delay(3000); // Send frame every 3s
}