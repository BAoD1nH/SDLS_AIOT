let mqttClient; // Biến toàn cục

function connectMQTT() {
	mqttClient = mqtt.connect("ws://localhost:9001");

	mqttClient.on("connect", () => {
		console.log("✅ Kết nối MQTT thành công");

		mqttClient.subscribe("door/status", (err) => {
			if (!err) {
				console.log("👂 Đang chờ trạng thái cửa từ ESP32...");
			} else {
				console.error("❌ Lỗi đăng ký topic 'door/status':", err.message);
			}
		});
	});

	mqttClient.on("error", (err) => {
		console.error("❌ Kết nối MQTT thất bại:", err.message);
	});
}
