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
        console.log("⚙️ is2FAEnabled =", is2FAEnabled);

		if (is2FAEnabled) {
			const otp = generateOTP();
			mqttClient.publish("door/otp", otp);
			console.log("📤 Gửi OTP tới ESP32:", otp);
			alert("✅ OTP: " + otp + "\nVui lòng nhập OTP này trên thiết bị.");

			// ⏱️ Delay 1–2 giây trước khi gửi lệnh mở cửa
			setTimeout(() => {
				mqttClient.publish("door/control", "open");
				console.log("📤 Gửi lệnh mở cửa tới ESP32.");
				alert("🚪 Đã gửi lệnh mở cửa.");
			}, 1500); // 1.5 giây chờ ESP32 nhận OTP trước
		} else {
			// Nếu không bật 2FA, gửi lệnh mở cửa như thường
			mqttClient.publish("door/control", "open");
			console.log("📤 Gửi lệnh mở cửa tới ESP32.");
			alert("🚪 Đã gửi lệnh mở cửa.");
		}
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

function toggle2FA() {
	const checkbox = document.getElementById("twoFA");
	is2FAEnabled = checkbox.checked;

	if (mqttClient && mqttClient.connected) {
		const payload = is2FAEnabled ? "on" : "off";
		mqttClient.publish("door/2fa", payload);
		console.log("📤 Gửi trạng thái 2FA:", payload);
		alert(`✅ Đã ${is2FAEnabled ? "bật" : "tắt"} xác thực hai bước (2FA).`);
	} else {
		alert("❌ MQTT chưa kết nối. Không thể gửi trạng thái 2FA.");
	}
}

function generateOTP(length = 6) {
	const digits = '0123456789';
	let otp = '';
	for (let i = 0; i < length; i++) {
		otp += digits[Math.floor(Math.random() * 10)];
	}
	return otp;
}