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

        //8.11.25 - Add to fix "Update password via web"
        window.mqttClient.subscribe("door/password_sync", (err) => {
            if (err) {
                console.error("Không thể subscribe door/password_sync:", err);
            } else {
                console.log("Subscribed door/password_sync để đồng bộ mật khẩu về Firestore");
            }
        });

        //8.11.25 - Dời vào bên trong connectMQTT để logic đúng hơn
        window.mqttClient.subscribe("esp32/camera/latest", (err) => {
            if (err) {
                console.error("❌ Không thể subscribe esp32/camera/latest:", err);
            } else {
                console.log("📡 Subscribed to esp32/camera/latest");
            }
        });
    });

    window.mqttClient.on("error", (err) => {
        console.error("❌ Kết nối MQTT thất bại:", err.message);
    });

    //8.11.25 - Gộp 3 message lại chung 1 khổi
    window.mqttClient.on("message", async (topic, payload) => {
		const msg = payload.toString();

		switch (topic) {
			case "door/status": {
				console.log("ESP32 gửi trạng thái:", msg);

				const el = document.getElementById("door-status");
				if (el) el.textContent = msg;

				const user = window.firebase?.auth?.().currentUser || null;
				if (user) {
					if (msg.toLowerCase().includes("opened")) {
						window.isDoorOpen = true;
						console.log("Cửa đang MỞ");
						logUserAction(user.uid, "Cửa được mở");
					} else if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("closed")) {
						window.isDoorOpen = false;
						console.log("Cửa đang ĐÓNG");
						logUserAction(user.uid, "Cửa được đóng");
					} else {
						console.warn("Trạng thái không xác định:", msg);
					}
				}
				break;
			}

			case "esp32/camera/latest": {
				try {
					const data = JSON.parse(msg);
					const imgEl = document.getElementById("esp32-camera-image");
					const timeEl = document.getElementById("esp32-image-timestamp");
					if (imgEl && data.imageUrl) {
						imgEl.src = data.imageUrl + `?t=${Date.now()}`;
						if (timeEl) {
							timeEl.textContent = `Gửi lúc: ${new Date(data.timestamp).toLocaleString()}`;
						}
					}
				} catch (e) {
					console.error("Không thể parse ảnh từ MQTT:", e);
				}
				break;
			}

			case "door/password_sync": {
				// Lưu ý: demo plaintext; production nên hash + xử lý qua server
				const user = window.firebase?.auth?.().currentUser || null;
				if (!user) {
					console.warn("Không có user đăng nhập, bỏ qua đồng bộ mật khẩu từ thiết bị.");
					return;
				}
				try {
					const db = window.firebase.firestore();
					await db.collection("users").doc(user.uid)
						.set({ lockPassword: String(msg) }, { merge: true });
					console.log("Đã đồng bộ lockPassword từ thiết bị vào Firestore");
				} catch (e) {
					console.error("Lỗi ghi Firestore khi đồng bộ lockPassword:", e);
				}
				break;
			}

			default:
				// ignore
				break;
		}
	});
}

window.connectMQTT = connectMQTT;

// Function to log user actions to Firestore
function logUserAction(userId, action) {
    if (!window.firebase || !window.firebase.firestore) {
        console.error('Firebase Firestore not initialized in logUserAction');
        return;
    }
    const db = window.firebase.firestore();
    return db.collection('users').doc(userId).update({
        history: window.firebase.firestore.FieldValue.arrayUnion({
            date: window.firebase.firestore.FieldValue.serverTimestamp(),
            action: action
        })
    }).catch((error) => {
        console.error('Error logging user action:', error.code, error.message);
    });
}
