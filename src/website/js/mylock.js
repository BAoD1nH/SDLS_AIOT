window.onload = () => {
	auth.onAuthStateChanged(user => {
		if (!user) {
			alert("⚠️ Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.");
			window.location.href = "signin.html";
		} else {
			document.getElementById("welcome").textContent = "Xin chào, " + user.email;
			connectMQTT(); // MQTT sẽ khởi động sau khi đăng nhập thành công
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

function changePassword() {
	const oldPass = document.getElementById("oldPass").value;
	const confirmOld = document.getElementById("confirmOld").value;
	const newPass = document.getElementById("newPass").value;

	if (oldPass !== confirmOld) {
		alert("❌ Mật khẩu cũ không khớp. Vui lòng nhập lại.");
		return;
	}

	if (mqttClient && mqttClient.connected) {
		const msg = JSON.stringify({ old: oldPass, confirm: confirmOld, new: newPass });
		mqttClient.publish("door/password", msg);
		alert("🔐 Yêu cầu thay đổi mật khẩu đã được gửi.");
	} else {
		alert("❌ Không thể kết nối đến MQTT. Vui lòng kiểm tra kết nối.");
	}
}
