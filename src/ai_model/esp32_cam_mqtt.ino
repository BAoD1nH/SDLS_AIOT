#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_camera.h"

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker IP (PC đang chạy Mosquitto)
const char* mqtt_server = "192.168.1.5";

// MQTT topics
const char* mqtt_pub_topic = "face/image";
const char* mqtt_sub_topic = "face/result";

// Setup camera pins (for ESP32-CAM AI Thinker)
#define PWDN_GPIO_NUM     -1
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

WiFiClient espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length) {
	String result;
	for (int i = 0; i < length; i++) {
		result += (char)payload[i];
	}
	Serial.print("Result: ");
	Serial.println(result);
	if (result == "Yes") {
		Serial.println("✅ Access Granted");
		// Mở cửa (servo hoặc relay tùy bạn)
	} else {
		Serial.println("❌ Access Denied");
	}
}

void reconnect() {
	while (!client.connected()) {
		Serial.print("Attempting MQTT connection...");
		if (client.connect("ESP32-CAM")) {
			Serial.println("connected");
			client.subscribe(mqtt_sub_topic);
		} else {
			Serial.print("failed, rc=");
			Serial.print(client.state());
			Serial.println(" try again in 5 seconds");
			delay(5000);
		}
	}
}

void setupCamera() {
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
	config.pin_sccb_sda = SIOD_GPIO_NUM;
	config.pin_sccb_scl = SIOC_GPIO_NUM;
	config.pin_pwdn = PWDN_GPIO_NUM;
	config.pin_reset = RESET_GPIO_NUM;
	config.xclk_freq_hz = 20000000;
	config.pixel_format = PIXFORMAT_JPEG;
	config.frame_size = FRAMESIZE_QVGA;
	config.jpeg_quality = 12;
	config.fb_count = 1;

	esp_err_t err = esp_camera_init(&config);
	if (err != ESP_OK) {
		Serial.printf("Camera init failed with error 0x%x", err);
		return;
	}
}

void setup() {
	Serial.begin(115200);
	WiFi.begin(ssid, password);
	while (WiFi.status() != WL_CONNECTED) {
		delay(500);
		Serial.print(".");
	}
	Serial.println("\nWiFi connected");

	setupCamera();

	client.setServer(mqtt_server, 1883);
	client.setCallback(callback);
}

void loop() {
	if (!client.connected()) {
		reconnect();
	}
	client.loop();

	camera_fb_t * fb = esp_camera_fb_get();
	if (!fb) {
		Serial.println("Camera capture failed");
		return;
	}

	// Gửi ảnh JPEG qua MQTT (dạng nhị phân)
	client.publish(mqtt_pub_topic, fb->buf, fb->len);

	Serial.println("Ảnh đã gửi qua MQTT");

	esp_camera_fb_return(fb);
	delay(5000); // Gửi ảnh mỗi 5 giây
}
