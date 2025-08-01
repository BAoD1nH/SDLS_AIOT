window.onload = () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            alert("⚠️ Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.");
            window.location.href = "signin.html";
        } else {
            // Người dùng đã đăng nhập thông qua Firebase Auth
            document.getElementById("welcome").textContent = "Xin chào, " + user.email;
            localStorage.setItem('isLoggedIn', 'true'); // Đảm bảo flag này được đặt nếu người dùng đã đăng nhập
            localStorage.setItem('userEmail', user.email);

            connectMQTT();

            // Đợi MQTT kết nối rồi đăng ký lắng nghe message
            const interval = setInterval(() => {
                if (mqttClient && mqttClient.connected) {
                    mqttClient.on("message", (topic, message) => {
                        const msg = message.toString();

                        if (topic === "door/status") {
                            console.log("📥 Trạng thái cửa từ ESP32:", msg);
                            const el = document.getElementById("door-status");
                            if (el) el.textContent = msg;
                        }
                    });
                    clearInterval(interval);
                }
            }, 500);
        }
    });
};


function toggleLock() {
	if (mqttClient && mqttClient.connected) {
		mqttClient.publish("door/control", "open");
		console.log("📤 Gửi yêu cầu mở cửa tới ESP32");
		alert("🚪 Đã gửi lệnh mở cửa.");
	} else {
		alert("❌ Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.");
	}
}


function changePassword() {
	const oldPass = document.getElementById("oldPass").value;
	const confirmOld = document.getElementById("confirmOld").value;
	const newPass = document.getElementById("newPass").value;

	if (oldPass !== confirmOld) {
		alert("❌ Mật khẩu cũ không khớp. Vui lòng nhập lại.");
		return;
	}

	if (!newPass || newPass.length < 4) {
		alert("❌ Mật khẩu mới phải có ít nhất 4 ký tự.");
		return;
	}

	// ✅ Gửi qua MQTT
	if (mqttClient && mqttClient.connected) {
		mqttClient.publish("door/password", newPass);
		alert("✅ Đã gửi yêu cầu cập nhật mật khẩu tới thiết bị.");
	} else {
		alert("❌ MQTT chưa kết nối. Không thể gửi mật khẩu mới.");
	}
}
