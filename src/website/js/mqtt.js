window.mqttClient = null; // Biến toàn cục
window.isDoorOpen = false;
window.is2FAEnabled = false; // Cờ lưu trạng thái 2FA trên web

function connectMQTT() {
    window.mqttClient = mqtt.connect("ws://localhost:9001");

    window.mqttClient.on("connect", () => {
        console.log("✅ Kết nối MQTT thành công");

        window.mqttClient.subscribe("door/status", (err) => {
            if (!err) {
                console.log("👂 Đang chờ trạng thái cửa từ ESP32...");
            } else {
                console.error("❌ Lỗi đăng ký topic 'door/status':", err.message);
            }
        });
    });

    window.mqttClient.on("message", (topic, message) => {
        const msg = message.toString();

        if (topic === "door/status") {
            console.log("📥 ESP32 gửi trạng thái:", msg);

            // Cập nhật hiển thị trên UI
            const el = document.getElementById("door-status");
            if (el) el.textContent = msg;

            // Cập nhật flag isDoorOpen theo nội dung nhận được
            if (msg.toLowerCase().includes("opened")) {
                window.isDoorOpen = true;
                console.log("🚪 Cửa đang MỞ");
            } else if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("closed")) {
                window.isDoorOpen = false;
                console.log("🔒 Cửa đang ĐÓNG");
            } else {
                console.warn("⚠️ Trạng thái không xác định:", msg);
            }
        }
    });

    window.mqttClient.on("error", (err) => {
        console.error("❌ Kết nối MQTT thất bại:", err.message);
    });

    mqttClient.subscribe("esp32/camera/latest", (err) => {
        if (err) {
            console.error("❌ Không thể subscribe esp32/camera/latest:", err);
        } else {
            console.log("📡 Subscribed to esp32/camera/latest");
        }
    });

    mqttClient.on("message", (topic, message) => {
        if (topic === "esp32/camera/latest") {
            try {
                const data = JSON.parse(message.toString());

                const imgEl = document.getElementById("esp32-camera-image");
                const timeEl = document.getElementById("esp32-image-timestamp");

                if (imgEl && data.imageUrl) {
                    imgEl.src = data.imageUrl + `?t=${Date.now()}`; // cache-busting
                    timeEl.textContent = `🕒 Gửi lúc: ${new Date(data.timestamp).toLocaleString()}`;
                }
            } catch (err) {
                console.error("❌ Không thể parse ảnh từ MQTT:", err);
            }
        }
    });

}

window.connectMQTT = connectMQTT;