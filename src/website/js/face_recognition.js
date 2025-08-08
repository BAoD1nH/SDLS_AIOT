// face_recognition.js
// Mục tiêu: Upload ảnh LOCAL lên backend và lưu vào thư mục uploads/faces/<userId>/...,
// đồng thời (nếu backend có) gọi /api/users để hiển thị danh sách người dùng.
//
// Giả định backend Node.js (Express + multer) có các endpoint:
//   POST /upload-face        -> nhận form-data: { userId, userName, faceImage }
//   GET  /api/users          -> (tùy chọn) trả danh sách [{userId, userName, timestamp}]
//
// Nếu bạn chưa có backend, xem mẫu server.js (Express + multer) mình đã gửi trước đó.

// ======================== cấu hình ========================
const API_BASE = ""; // nếu server khác origin, ví dụ: "http://localhost:8000"
const ENDPOINT_UPLOAD = `${API_BASE}/upload-face`;
const ENDPOINT_USERS  = `${API_BASE}/api/users`; // tùy chọn, nếu chưa có, loadUsers() sẽ hiện thông báo

// ======================== tiện ích UI =====================
function setStatus(el, msg, type = "info") {
	if (!el) return;
	el.textContent = msg;
	el.classList.remove("text-red-400", "text-green-400");
	if (type === "success") el.classList.add("text-green-400");
	else if (type === "error") el.classList.add("text-red-400");
}

function $(sel) {
	return document.querySelector(sel);
}

// ======================== ENROLL / UPLOAD =================
(() => {
	const form = $("#enroll-form");
	if (!form) return;

	const userIdEl    = $("#userId");
	const userNameEl  = $("#userName");
	const fileEl      = $("#faceImage");
	const statusEl    = $("#enroll-status");
	const submitBtn   = form.querySelector('button[type="submit"]');

	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const userId   = (userIdEl?.value || "").trim();
		const userName = (userNameEl?.value || "").trim();
		const image    = fileEl?.files?.[0];

		if (!userId || !userName || !image) {
			setStatus(statusEl, "Vui lòng điền đầy đủ thông tin và chọn ảnh.", "error");
			return;
		}

		// Khoá nút trong lúc upload
		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.classList.add("opacity-70", "cursor-not-allowed");
		}
		setStatus(statusEl, "Đang upload...");

		try {
			const fd = new FormData();
			fd.append("userId", userId);
			fd.append("userName", userName);
			fd.append("faceImage", image);

			const res = await fetch(ENDPOINT_UPLOAD, {
				method: "POST",
				body: fd,
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.message || `Upload thất bại (HTTP ${res.status})`);
			}

			setStatus(statusEl, "Đăng ký khuôn mặt thành công.", "success");
			form.reset();
			loadUsers(); // nếu backend có /api/users
		} catch (err) {
			console.error("Upload error:", err);
			setStatus(statusEl, `Đăng ký thất bại: ${err.message || err}`, "error");
		} finally {
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
			}
		}
	});
})();

// ======================== LOAD USERS ======================
async function loadUsers() {
	const tbody = $("#userList");
	if (!tbody) return;

	tbody.innerHTML = "";
	try {
		const res = await fetch(ENDPOINT_USERS, { method: "GET" });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const users = await res.json();

		if (!Array.isArray(users) || users.length === 0) {
			const tr = document.createElement("tr");
			tr.innerHTML = `<td colspan="3" class="px-4 py-2 text-gray-400">Chưa có người dùng.</td>`;
			tbody.appendChild(tr);
			return;
		}

		users.forEach(u => {
			const tr = document.createElement("tr");
			const ts = u.timestamp ? new Date(u.timestamp).toLocaleString() : "";
			tr.innerHTML = `
				<td class="px-4 py-2">${u.userId ?? ""}</td>
				<td class="px-4 py-2">${u.userName ?? ""}</td>
				<td class="px-4 py-2">${ts}</td>
			`;
			tbody.appendChild(tr);
		});
	} catch (err) {
		console.error("Lỗi tải danh sách người dùng:", err);
		const tr = document.createElement("tr");
		tr.innerHTML = `<td colspan="3" class="px-4 py-2 text-red-400">Không thể tải dữ liệu (chưa có /api/users hoặc server lỗi).</td>`;
		tbody.appendChild(tr);
	}
}
loadUsers();

// ======================== MQTT (nếu dùng) =================
function waitForMQTTConnection() {
	const list = $("#verificationList");
	if (!list) return;

	if (window.mqttClient && mqttClient.connected) {
		console.log("MQTT ready for face/verified");
		mqttClient.subscribe("face/verified", (err) => {
			if (err) console.error("Không thể subscribe topic face/verified:", err);
		});

		mqttClient.on("message", (topic, message) => {
			if (topic === "face/verified") {
				try {
					const data = JSON.parse(message.toString());
					const li = document.createElement("li");
					li.textContent = `${data.userName} (UserID: ${data.userId}) xác thực lúc ${new Date().toLocaleTimeString()}`;
					list.prepend(li);
				} catch (err) {
					console.error("Không thể parse message MQTT:", err);
				}
			}
		});
	} else {
		setTimeout(waitForMQTTConnection, 500);
	}
}
waitForMQTTConnection();
