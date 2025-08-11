SERVICE_ID = 'service_mn6g0ha'
TEMPLATE_ID = 'template_wkkkq4u'

function toggleLock() {
    if (!mqttClient || !mqttClient.connected) {
        alert("Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.");
        return;
    }

    // Chỉ gửi lệnh mở cửa. KHÔNG sinh/gửi OTP ở đây.
    mqttClient.publish("door/control", "open");
    console.log("Đã gửi lệnh mở cửa tới ESP32.");

    if (window.is2FAEnabled) {
        // Thông báo rõ là sẽ đợi thiết bị yêu cầu OTP
        alert("Đã gửi lệnh mở. Vui lòng chờ thiết bị yêu cầu OTP, khi đó OTP sẽ hiển thị trên web.");
    } else {
        alert("Đã gửi lệnh mở cửa.");
    }

    // Ghi log
    const user = window.firebase?.auth?.().currentUser;
    if (user) {
        logUserAction(user.uid, "Mở khóa cửa");
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

  // Lưu Firestore
  const user = window.firebase?.auth?.().currentUser;
  if (user) {
    const db = window.firebase.firestore();
    db.collection("users").doc(user.uid)
      .set({ twoFA: window.is2FAEnabled }, { merge: true })
      .catch(err => console.error("Lỗi lưu twoFA:", err));
  }

  // Lưu localStorage (dự phòng)
  localStorage.setItem("twoFA", window.is2FAEnabled ? "1" : "0");

  // Gửi cho ESP32 nếu MQTT đang connected
  if (window.mqttClient?.connected) {
    const payload = window.is2FAEnabled ? "on" : "off";
    window.mqttClient.publish("door/2fa", payload);
    console.log("📤 Gửi trạng thái 2FA:", payload);
  } else {
    const errorDiv = document.getElementById("password-error");
    if (errorDiv) showMessage(errorDiv, "MQTT chưa kết nối. Trạng thái 2FA đã được lưu, sẽ đồng bộ khi kết nối lại.", false);
  }

  // Log
  if (user) {
    logUserAction(user.uid, window.is2FAEnabled ? 'Bật xác thực hai yếu tố' : 'Tắt xác thực hai yếu tố')
      .then(() => alert(`✅ Đã ${window.is2FAEnabled ? "bật" : "tắt"} xác thực hai bước (2FA).`));
  }
}

// Function to send OTP via email using EmailJS
async function sendOTPByEmail(userId, otp) {
    const user = window.firebase?.auth?.().currentUser;
    if (!user || user.uid !== userId) {
        console.warn("Không có user đăng nhập hoặc userId không khớp, không thể gửi OTP qua email.");
        return { success: false, error: "No authenticated user or userId mismatch" };
    }
    if (typeof emailjs === 'undefined') {
        console.error("EmailJS SDK not loaded, cannot send OTP email.");
        const errorDiv = document.getElementById("password-error") || document.getElementById("error-message");
        if (errorDiv) {
            showMessage(errorDiv, "Lỗi: EmailJS chưa sẵn sàng, không thể gửi OTP.", false);
        } else {
            alert("Lỗi: EmailJS chưa sẵn sàng, không thể gửi OTP.");
        }
        return { success: false, error: "EmailJS SDK not loaded" };
    }
    try {
        const db = window.firebase.firestore();
        const userDoc = await db.collection('users').doc(user.uid).get();
        const username = userDoc.exists ? (userDoc.data().username || user.email.split('@')[0]) : user.email.split('@')[0];
        const email = user.email;
        const templateParams = {
            username: username,
            otp: otp,
            to_email: email
        };
        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
        console.log("Đã gửi OTP qua email đến:", email);

		const errorDiv = document.getElementById("password-error") || document.getElementById("error-message");
        if (errorDiv) {
            showMessage(errorDiv, "OTP đã được gửi đến email của bạn: " + email, true);
        } else {
            alert("OTP đã được gửi đến email của bạn: " + email);
        }
        return { success: true, otp: otp };
    } catch (e) {
        console.error("Lỗi khi gửi OTP qua email:", e);
        const errorDiv = document.getElementById("password-error") || document.getElementById("error-message");
        if (errorDiv) {
            showMessage(errorDiv, "Lỗi: Không thể gửi OTP qua email. Vui lòng thử lại.", false);
        } else {
            alert("Lỗi: Không thể gửi OTP qua email. Vui lòng thử lại.");
        }
        return { success: false, error: e.message };
    }
}

function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    const user = window.firebase?.auth?.().currentUser;
    if (user) {
        sendOTPByEmail(user.uid, otp).catch(err => console.error("Failed to send OTP email:", err));
    } else {
        console.warn("No authenticated user, skipping OTP email.");
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
window.sendOTPByEmail = sendOTPByEmail;