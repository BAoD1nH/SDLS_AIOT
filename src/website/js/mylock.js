function toggleLock() {
    if (mqttClient && mqttClient.connected) {
        console.log("⚙️ is2FAEnabled =", window.is2FAEnabled);

        if (window.is2FAEnabled) {
            const otp = generateOTP();
            mqttClient.publish("door/otp", otp);
            console.log("📤 Gửi OTP tới ESP32:", otp);
            alert("✅ OTP: " + otp + "\nVui lòng nhập OTP này trên thiết bị.");

            // ⏱️ Delay 1–2 giây trước khi gửi lệnh mở cửa
            setTimeout(() => {
                mqttClient.publish("door/control", "open");
                console.log("📤 Gửi lệnh mở cửa tới ESP32.");
                alert("🚪 Đã gửi lệnh mở cửa.");
                // Log door open action
                const user = window.firebase.auth().currentUser;
                if (user) {
                    logUserAction(user.uid, 'Mở khóa cửa');
                }
            }, 1500); // 1.5 giây chờ ESP32 nhận OTP trước
        } else {
            // Nếu không bật 2FA, gửi lệnh mở cửa như thường
            mqttClient.publish("door/control", "open");
            console.log("📤 Gửi lệnh mở cửa tới ESP32.");
            alert("🚪 Đã gửi lệnh mở cửa.");
            // Log door open action
            const user = window.firebase.auth().currentUser;
            if (user) {
                logUserAction(user.uid, 'Mở khóa cửa');
            }
        }
    } else {
        alert("❌ Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.");
    }
}

function changePassword() {
	const oldPass = document.getElementById("oldPass").value?.trim();
	//Add to fix "Update password via web"
	const newPass = document.getElementById("newPass").value?.trim();
	const confirmNew = document.getElementById("confirmNew").value?.trim();
	const errorDiv = document.getElementById("password-error");

	if (!window.firebase || !window.firebase.auth) {
		showMessage(errorDiv, "Lỗi: Firebase chưa được khởi tạo.", false);
		return;
	}
	const user = window.firebase.auth().currentUser;
	if (!user) {
		showMessage(errorDiv, "Vui lòng đăng nhập để đổi mật khẩu khóa.", false);
		return;
	}

	// 1) Kiểm tra đủ dữ liệu
	if (!oldPass || !newPass || !confirmNew) {
		showMessage(errorDiv, "Vui lòng điền đầy đủ thông tin.", false);
		return;
	}

	// 2) Ràng buộc định dạng 4–8 chữ số cho cả 3 trường
	const pinRegex = /^[0-9]{4,8}$/;
	if (!pinRegex.test(oldPass)) {
		showMessage(errorDiv, "Mật khẩu cũ phải là 4–8 chữ số.", false);
		return;
	}

	if (!pinRegex.test(newPass) || !pinRegex.test(confirmNew)) {
		showMessage(errorDiv, "Mật khẩu mới phải là 4–8 chữ số.", false);
		return;
	}

	// 3) Xác nhận mật khẩu mới
	if (newPass !== confirmNew) {
		showMessage(errorDiv, "Xác nhận mật khẩu mới không khớp.", false);
		return;
	}

	// 4) Không cho đổi sang cùng mật khẩu
	if (oldPass === newPass) {
		showMessage(errorDiv, "Mật khẩu mới trùng với mật khẩu cũ.", false);
		return;
	}

	const userRef = window.firebase.firestore().collection("users").doc(user.uid);

	userRef.get().then((snap) => {
		//8.11.25 - Add to fix "Update password via web"
		const DEFAULT_DEVICE_PASS = "1234";
		
		// Cho phép lần đầu nếu biết pass mặc định thiết bị
		if (!snap.exists) {
			// Chưa có doc → cho phép khởi tạo nếu oldPass trùng mặc định thiết bị (ví dụ "1234")
			// Nếu bạn muốn bắt buộc có doc, đổi thông điệp tại đây.
			if (oldPass === DEFAULT_DEVICE_PASS) {
				return userRef.set({ lockPassword: String(newPass) }, { merge: true })
					.then(() => afterUpdate(newPass, errorDiv));
			}
			showMessage(errorDiv, "Tài khoản chưa có mật khẩu khóa trong hệ thống.", false);
			return;
		}

		const data = snap.data() || {};
		// Ép kiểu về chuỗi để tránh 1234 (number) !== "1234" (string)
		const stored = data.lockPassword != null ? String(data.lockPassword).trim() : "";

		// Nếu Firestore chưa có (mới lần đầu sync)
		if (!stored) {
			if (oldPass === DEFAULT_DEVICE_PASS) {
				return userRef.set({ lockPassword: String(newPass) }, { merge: true })
					.then(() => afterUpdate(newPass, errorDiv));
			}
			showMessage(errorDiv, "Chưa có mật khẩu khóa để đối chiếu.", false);
			return;
		}

		// So khớp oldPass với mật khẩu đang lưu trong Firestore
		if (stored === String(oldPass)) {
			return userRef.set({ lockPassword: String(newPass) }, { merge: true })
				.then(() => afterUpdate(newPass, errorDiv));
		} else {
			console.warn("Lock password mismatch:", { stored, oldPass });
			showMessage(errorDiv, "Mật khẩu cũ không đúng.", false);
		}
	}).catch((error) => {
		console.error("Error updating lock password:", error.code, error.message);
		showMessage(errorDiv, "Lỗi: " + error.message, false);
	});

	function afterUpdate(newPass, errorDiv) {
		// Gửi cập nhật xuống ESP32-S3
		if (window.mqttClient && window.mqttClient.connected) {
			window.mqttClient.publish("door/password", String(newPass));
		}
		// Ghi log nếu có
		if (typeof logUserAction === "function") {
			logUserAction(window.firebase.auth().currentUser.uid, "Cập nhật mật khẩu khóa").catch(()=>{});
		}
		showMessage(errorDiv, "Cập nhật mật khẩu khóa thành công!", true);

		// Clear form
		document.getElementById("oldPass").value = "";
		document.getElementById("newPass").value = "";
		document.getElementById("confirmNew").value = "";
	}
}

function toggle2FA() {
    const checkbox = document.getElementById("twoFA");
    window.is2FAEnabled = !!checkbox.checked;

    if (window.mqttClient && window.mqttClient.connected) {
        const payload = window.is2FAEnabled ? "on" : "off";
        window.mqttClient.publish("door/2fa", payload);
        console.log("📤 Gửi trạng thái 2FA:", payload);
        // Log 2FA toggle action
        const user = window.firebase.auth().currentUser;
        if (user) {
            logUserAction(user.uid, window.is2FAEnabled ? 'Bật xác thực hai yếu tố' : 'Tắt xác thực hai yếu tố').then(() => {
                alert(`✅ Đã ${window.is2FAEnabled ? "bật" : "tắt"} xác thực hai bước (2FA).`);
            });
        }
    } else {
        const errorDiv = document.getElementById("password-error");
		if (errorDiv) showMessage(errorDiv, "MQTT chưa kết nối. Không thể gửi trạng thái 2FA.", false);
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

// Function to log user actions to Firestore (duplicated here to ensure availability)
function logUserAction(userId, action) {
	if (!window.firebase || !window.firebase.firestore) {
		console.error('Firebase Firestore not initialized in logUserAction');
		return Promise.resolve();
	}
	const db = window.firebase.firestore();
	// NEW (đã đổi)
	const FieldValue = firebase.firestore.FieldValue;
	if (FieldValue && FieldValue.arrayUnion && FieldValue.serverTimestamp) {
	return db.collection('users').doc(userId).set({
		history: FieldValue.arrayUnion({ date: FieldValue.serverTimestamp(), action })
	}, { merge: true });
	}
	// Fallback an toàn nếu FieldValue chưa sẵn sàng
	const ref = db.collection('users').doc(userId);
	return ref.get().then(snap => {
	const data = snap.exists ? (snap.data() || {}) : {};
	const hist = Array.isArray(data.history) ? data.history.slice() : [];
	hist.push({ date: new Date(), action });
	return ref.set({ history: hist }, { merge: true });
	});
}

// Define showMessage globally to match auth.js
function showMessage(div, message, isSuccess) {
    div.textContent = message;
    div.classList.remove('hidden', isSuccess ? 'text-red-400' : 'text-green-400');
    div.classList.add(isSuccess ? 'text-green-400' : 'text-red-400');
    setTimeout(() => div.classList.add('hidden'), 5000);
}

// Expose functions to global scope
window.toggleLock = toggleLock;
window.changePassword = changePassword;
window.toggle2FA = toggle2FA;
window.generateOTP = generateOTP;
window.showMessage = showMessage;