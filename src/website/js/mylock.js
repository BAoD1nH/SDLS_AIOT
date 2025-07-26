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
        mqttClient.publish("door/control", "toggle");
        alert("🔄 Đã gửi lệnh mở/đóng cửa.");
    } else {
        alert("❌ Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.");
    }
}

window.onload = () => {
    connectMQTT();
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
        } else {
            console.error('MQTT client not initialized or not connected');
        }
    }, 500);
};

function changePassword() {
    const oldPass = document.getElementById("oldPass").value;
    const confirmOld = document.getElementById("confirmOld").value;
    const newPass = document.getElementById("newPass").value;

    if (oldPass !== confirmOld) {
        alert("❌ Mật khẩu cũ không khớp. Vui lòng nhập lại.");
        return;
    }

    const user = auth.currentUser;
    if (user) {
        // Để thay đổi mật khẩu, người dùng cần xác thực lại.
        // Đây là một ví dụ đơn giản, trong ứng dụng thực tế bạn sẽ cần cơ chế xác thực lại (ví dụ: prompt nhập lại mật khẩu).
        // For simplicity, we're directly updating. In a real app, you'd re-authenticate.
        user.updatePassword(newPass)
            .then(() => {
                alert("✅ Mật khẩu đã được thay đổi thành công!");
            })
            .catch((error) => {
                alert("❌ Lỗi khi thay đổi mật khẩu: " + error.message);
            });
    } else {
        alert("❌ Bạn cần đăng nhập để thay đổi mật khẩu.");
    }
}

// MQTT listener được gọi trong connectMQTT (ở file mqtt.js)
