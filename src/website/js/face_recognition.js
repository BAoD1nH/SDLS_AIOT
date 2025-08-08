// js/face_recognition.js
// Mục tiêu: Upload ảnh từ form lên server local và hiển thị danh sách người dùng đã đăng ký.
// Backend yêu cầu (Flask):
//  - POST /upload-face  (form-data: userId, userName, faceImage) -> lưu uploads/faces/<userId>/<timestamp>.jpg
//  - GET  /api/users    -> trả [{ userId, userName, timestamp }]
//  - (tùy chọn) MQTT: bạn đã có js/mqtt.js, phần dưới chỉ lắng nghe topic face/verified nếu có.

// ======================== Cấu hình API ========================
const API_BASE = "http://localhost:8000";           // đổi nếu server chạy chỗ khác
const ENDPOINT_UPLOAD = `${API_BASE}/upload-face`;
const ENDPOINT_USERS  = `${API_BASE}/api/users`;

// ======================== Tiện ích UI ========================
function $(sel) { return document.querySelector(sel); }

function setStatus(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("text-red-400", "text-green-400");
  if (type === "success") el.classList.add("text-green-400");
  else if (type === "error") el.classList.add("text-red-400");
}

// ======================== Upload / Enroll =====================
(function initEnroll() {
  const form = $("#enroll-form");
  if (!form) return;

  const userIdEl   = $("#userId");
  const userNameEl = $("#userName");
  const fileEl     = $("#faceImage");
  const statusEl   = $("#enroll-status");
  const submitBtn  = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId   = (userIdEl?.value || "").trim();
    const userName = (userNameEl?.value || "").trim();
    const file     = fileEl?.files?.[0];

    if (!userId || !userName || !file) {
      setStatus(statusEl, "Vui lòng điền đầy đủ thông tin và chọn ảnh.", "error");
      return;
    }

    try {
      // Disable nút trong lúc gửi
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("opacity-70", "cursor-not-allowed");
      }
      setStatus(statusEl, "Đang upload...");

      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("userName", userName);
      fd.append("faceImage", file);

      const res = await fetch(ENDPOINT_UPLOAD, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Upload thất bại (HTTP ${res.status})`);

      setStatus(statusEl, "Đăng ký khuôn mặt thành công.", "success");
      form.reset();
      // Refresh danh sách
      await loadUsers();
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

// ======================== Load danh sách Users =================
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
      tr.innerHTML = `
        <td class="px-4 py-2">${u.userId ?? ""}</td>
        <td class="px-4 py-2">${u.userName ?? ""}</td>
        <td class="px-4 py-2">${u.timestamp ? new Date(u.timestamp).toLocaleString() : ""}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi tải danh sách người dùng:", err);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" class="px-4 py-2 text-red-400">Không thể tải dữ liệu.</td>`;
    tbody.appendChild(tr);
  }
}

// Tải danh sách ngay khi trang load
window.addEventListener("DOMContentLoaded", loadUsers);

// ======================== MQTT (nếu dùng) =====================
(function initMQTTListener() {
  const list = $("#verificationList");
  if (!list) return;

  // Đợi mqttClient do js/mqtt.js tạo sẵn
  function attach() {
    if (window.mqttClient && mqttClient.connected) {
      try {
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
            } catch (e) {
              console.error("Không thể parse MQTT message:", e);
            }
          }
        });
      } catch (e) {
        console.error("MQTT attach error:", e);
      }
    } else {
      setTimeout(attach, 500);
    }
  }
  attach();
})();
