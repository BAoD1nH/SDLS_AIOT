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
    const oldPass = document.getElementById("oldPass").value;
    const confirmOld = document.getElementById("confirmOld").value;
    const newPass = document.getElementById("newPass").value;
    const errorDiv = document.getElementById("password-error");

    if (!window.firebase || !window.firebase.auth) {
        showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        return;
    }

    const user = window.firebase.auth().currentUser;

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để đổi mật khẩu khóa.', false);
        return;
    }

    if (!oldPass || !confirmOld || !newPass) {
        showMessage(errorDiv, 'Vui lòng điền đầy đủ thông tin.', false);
        return;
    }

    if (oldPass !== confirmOld) {
        showMessage(errorDiv, 'Mật khẩu cũ và xác nhận mật khẩu không khớp.', false);
        return;
    }

    const passwordRegex = /^[0-9]{4,8}$/;
    if (!passwordRegex.test(newPass)) {
        showMessage(errorDiv, 'Mật khẩu mới phải là 4-8 chữ số.', false);
        return;
    }

    window.firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().lockPassword === oldPass) {
                return window.firebase.firestore().collection('users').doc(user.uid).set(
                    { lockPassword: newPass },
                    { merge: true }
                ).then(() => {
                    if (mqttClient && mqttClient.connected) {
                        mqttClient.publish("door/password", newPass);
                        // Log lock password update action
                        return logUserAction(user.uid, 'Cập nhật mật khẩu khóa').then(() => {
                            showMessage(errorDiv, 'Cập nhật mật khẩu khóa thành công!', true);
                            console.log('📤 Gửi mật khẩu mới tới ESP32:', newPass);
                            document.getElementById('oldPass').value = '';
                            document.getElementById('confirmOld').value = '';
                            document.getElementById('newPass').value = '';
                        });
                    } else {
                        showMessage(errorDiv, 'Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.', false);
                    }
                });
            } else {
                showMessage(errorDiv, 'Mật khẩu cũ không đúng.', false);
            }
        })
        .catch((error) => {
            console.error('Error updating lock password:', error.code, error.message);
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
}

function toggle2FA() {
    const checkbox = document.getElementById("twoFA");
    is2FAEnabled = checkbox.checked;

    if (mqttClient && mqttClient.connected) {
        const payload = is2FAEnabled ? "on" : "off";
        mqttClient.publish("door/2fa", payload);
        console.log("📤 Gửi trạng thái 2FA:", payload);
        // Log 2FA toggle action
        const user = window.firebase.auth().currentUser;
        if (user) {
            logUserAction(user.uid, is2FAEnabled ? 'Bật xác thực hai yếu tố' : 'Tắt xác thực hai yếu tố').then(() => {
                alert(`✅ Đã ${is2FAEnabled ? "bật" : "tắt"} xác thực hai bước (2FA).`);
            });
        }
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

// Function to log user actions to Firestore (duplicated here to ensure availability)
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

// Expose functions to global scope
window.toggleLock = toggleLock;
window.changePassword = changePassword;
window.toggle2FA = toggle2FA;
window.generateOTP = generateOTP;

// Define showMessage globally to match auth.js
function showMessage(div, message, isSuccess) {
    div.textContent = message;
    div.classList.remove('hidden', isSuccess ? 'text-red-400' : 'text-green-400');
    div.classList.add(isSuccess ? 'text-green-400' : 'text-red-400');
    setTimeout(() => div.classList.add('hidden'), 5000);
}
window.showMessage = showMessage;