let mqttClient; // Biến toàn cục
let isDoorOpen = false;

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

	mqttClient.on("message", (topic, message) => {
		const msg = message.toString();

		if (topic === "door/status") {
			console.log("📥 ESP32 gửi trạng thái:", msg);

			// Cập nhật hiển thị trên UI
			const el = document.getElementById("door-status");
			if (el) el.textContent = msg;

			// Cập nhật flag isDoorOpen theo nội dung nhận được
			if (msg.toLowerCase().includes("opened")) {
				isDoorOpen = true;
				console.log("🚪 Cửa đang MỞ");
			} else if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("closed")) {
				isDoorOpen = false;
				console.log("🔒 Cửa đang ĐÓNG");
			} else {
				console.warn("⚠️ Trạng thái không xác định:", msg);
			}
		}
	});
	
	mqttClient.on("error", (err) => {
		console.error("❌ Kết nối MQTT thất bại:", err.message);
	});
}


