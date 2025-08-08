// ====== 1. Enroll Face Form Submit ======
document.getElementById("enroll-form").addEventListener("submit", async (e) => {
	e.preventDefault();

	const userId = document.getElementById("userId").value.trim();
	const userName = document.getElementById("userName").value.trim();
	const imageFile = document.getElementById("faceImage").files[0];
	const statusDiv = document.getElementById("enroll-status");

	if (!userId || !userName || !imageFile) {
		statusDiv.textContent = "❌ Vui lòng điền đầy đủ thông tin và chọn ảnh.";
		statusDiv.classList.replace("text-green-400", "text-red-400");
		return;
	}

	const formData = new FormData();
	formData.append("userId", userId);
	formData.append("userName", userName);
	formData.append("image", imageFile);

	try {
		const response = await fetch("/api/enroll", {
			method: "POST",
			body: formData
		});

		if (response.ok) {
			statusDiv.textContent = "✅ Đăng ký khuôn mặt thành công!";
			statusDiv.classList.replace("text-red-400", "text-green-400");
			document.getElementById("enroll-form").reset();
			loadUsers();
		} else {
			const errText = await response.text();
			statusDiv.textContent = "❌ Đăng ký thất bại: " + errText;
			statusDiv.classList.replace("text-green-400", "text-red-400");
		}
	} catch (err) {
		console.error("Enroll error:", err);
		statusDiv.textContent = "❌ Lỗi kết nối server.";
		statusDiv.classList.replace("text-green-400", "text-red-400");
	}
});

// ====== 2. Load Registered Users ======
async function loadUsers() {
	const tbody = document.getElementById("userList");
	tbody.innerHTML = "";

	try {
		const res = await fetch("/api/users");
		const users = await res.json();

		users.forEach(user => {
			const tr = document.createElement("tr");
			tr.innerHTML = `
				<td class="px-4 py-2">${user.userId}</td>
				<td class="px-4 py-2">${user.userName}</td>
				<td class="px-4 py-2">${new Date(user.timestamp).toLocaleString()}</td>
			`;
			tbody.appendChild(tr);
		});
	} catch (err) {
		console.error("Lỗi tải danh sách người dùng:", err);
		const tr = document.createElement("tr");
		tr.innerHTML = `<td colspan="3" class="px-4 py-2 text-red-400">❌ Không thể tải dữ liệu.</td>`;
		tbody.appendChild(tr);
	}
}

loadUsers();

// ====== 3. Listen to MQTT Verification Events ======
function waitForMQTTConnection() {
	const list = document.getElementById("verificationList");

	if (window.mqttClient && mqttClient.connected) {
		console.log("✅ MQTT ready for face/verified");

		mqttClient.subscribe("face/verified", (err) => {
			if (err) console.error("❌ Không thể subscribe topic face/verified:", err);
		});

		mqttClient.on("message", (topic, message) => {
			if (topic === "face/verified") {
				try {
					const data = JSON.parse(message.toString());

					const li = document.createElement("li");
					li.textContent = `✅ ${data.userName} (UserID: ${data.userId}) xác thực lúc ${new Date().toLocaleTimeString()}`;
					list.prepend(li);
				} catch (err) {
					console.error("❌ Không thể parse message MQTT:", err);
				}
			}
		});
	} else {
		setTimeout(waitForMQTTConnection, 500); // Đợi kết nối xong
	}
}

waitForMQTTConnection();
