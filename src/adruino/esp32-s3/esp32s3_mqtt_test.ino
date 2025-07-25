#include <WiFi.h>
#include <PubSubClient.h>

// Cấu hình Wi-Fi
const char* ssid = "Gia Bao";
const char* password = "28092004";

// Cấu hình MQTT
const char* mqtt_server = "192.168.1.2";  // Bạn có thể thay bằng broker riêng
const int mqtt_port = 1883;
const char* mqtt_client_id = "esp32s3_test_client";
const char* mqtt_topic = "esp32s3/test";

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
	Serial.print("🔌 Đang kết nối Wi-Fi");
	WiFi.begin(ssid, password);
	int retry = 0;
	while (WiFi.status() != WL_CONNECTED && retry < 20) {
		delay(500);
		Serial.print(".");
		retry++;
	}
	if (WiFi.status() == WL_CONNECTED) {
		Serial.println();
		Serial.println("✅ Kết nối Wi-Fi thành công!");
		Serial.print("IP: ");
		Serial.println(WiFi.localIP());
	} else {
		Serial.println("\n❌ Kết nối Wi-Fi thất bại!");
	}
}

void reconnect_mqtt() {
	while (!client.connected()) {
		Serial.print("🔁 Đang kết nối MQTT...");
		if (client.connect(mqtt_client_id)) {
			Serial.println("✅ MQTT kết nối thành công!");
			// Có thể đăng ký nhận tin nếu muốn
			// client.subscribe("esp32s3/test");
		} else {
			Serial.print("❌ MQTT thất bại, mã lỗi = ");
			Serial.print(client.state());
			Serial.println(" -> thử lại sau 5 giây");
			delay(5000);
		}
	}
}

void setup() {
	Serial.begin(115200);
	delay(1000);

	setup_wifi();

	client.setServer(mqtt_server, mqtt_port);
}

void loop() {
	if (!client.connected()) {
		reconnect_mqtt();
	}

	client.loop(); // Bắt buộc phải gọi thường xuyên

	// Gửi message test
	static unsigned long lastSend = 0;
	// if (millis() - lastSend > 5000) {
	// 	String message = "Xin chào từ ESP32-S3!";
	// 	client.publish(mqtt_topic, message.c_str());
	// 	Serial.print("📤 Đã gửi: ");
	// 	Serial.println(message);
	// 	lastSend = millis();
	// }

  if (millis() - lastSend > 10000) {
    client.publish("door/status", "Door opened");
    Serial.println("Đã gửi door/status: Dooropened");
    lastSend = millis();
  }
}
