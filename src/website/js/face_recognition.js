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
// const ENDPOINT_VERIFICATIONS = `${API_BASE}/api/verifications`;
const ENDPOINT_VERIFICATIONS = `${API_BASE}/api/auth-logs`; // đúng với server.py
const ENDPOINT_VERIF_INDEX   = `${API_BASE}/verification_results/index.json`; // fallback đúng origin
const ENDPOINT_LATEST = `${API_BASE}/verification_results/latest.json`;
// ======================== Tiện ích UI ========================
function $(sel) { return document.querySelector(sel); }

function setStatus(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("text-red-400", "text-green-400");
  if (type === "success") el.classList.add("text-green-400");
  else if (type === "error") el.classList.add("text-red-400");
}

// Đặt gần đầu file
window.seenEvents = window.seenEvents || new Set();
function eventKey(it) {
	const uid = it.event_id || it.user_id || it.userId || "";
	const dist = Number.isFinite(Number(it.distance)) ? Number(it.distance).toFixed(4) : "";
	const ts = it.ts ?? it.timestamp ?? "";
	return `${uid}|${dist}|${ts}`;
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

function setEsp32Status(ts) {
  const el = document.querySelector("#esp32Status");
  if (!el) return;
  let ms = ts;
  if (typeof ts === "number" && ts < 1e12) ms = ts * 1000; // ts tính bằng giây -> ms
  if (!ms) ms = Date.now();
  el.textContent = `Đã nhận kết quả từ ESP32-CAM lúc ${new Date(ms).toLocaleString()}`;
  el.classList.remove("text-gray-400");
  el.classList.add("text-green-400");
}


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

// ======================== Load danh sách Xác thực =================
async function loadVerifications() {
	const list = document.querySelector("#verificationList");
	const banner = document.querySelector("#authResult");
	if (!list) return;

	const fmtTime = (ts) => {
		if (typeof ts === "number" && ts < 1e12) ts *= 1000;
		return new Date(ts || Date.now()).toLocaleString();
	};
	const setBanner = (text, ok) => {
		if (!banner) return;
		banner.classList.remove("text-gray-400", "text-green-400", "text-red-400");
		banner.classList.add(ok ? "text-green-400" : "text-red-400");
		banner.textContent = text;
	};

	list.innerHTML = "";
	try {
		// 1) thử API
		let items;
		try {
			const res = await fetch(ENDPOINT_VERIFICATIONS, { method: "GET" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			items = await res.json();
			if (!Array.isArray(items)) throw new Error("Response is not an array");
		} catch (e) {
			// 2) fallback: index.json do script tạo trong RESULTS_DIR
			const idx = await fetch(ENDPOINT_VERIF_INDEX, { method: "GET" });
			if (!idx.ok) throw new Error(`HTTP ${idx.status} (index.json)`);
			const files = await idx.json(); // ["<file1>.json", ...]
			const all = await Promise.all(
				files.map(f => fetch(`${API_BASE}/verification_results/${f}`)
					.then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${f}`); return r.json(); }))
			);
			items = all.flatMap(x => Array.isArray(x) ? x : [x]);
		}

		if (!items.length) {
			list.innerHTML = `<li class="text-gray-400">Chưa có kết quả xác thực.</li>`;
			if (banner) {
				banner.classList.remove("text-green-400", "text-red-400");
				banner.classList.add("text-gray-400");
				banner.textContent = "Chưa có kết quả.";
			}
			return;
		}

		items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
		for (const it of items) {
      const key = eventKey(it);
      if (window.seenEvents.has(key)) continue;   // đã có -> bỏ qua
      window.seenEvents.add(key);

			const ok = it.status === "ok" || it.result === "success";
			const distNum = Number(it.distance);
			const dist = Number.isFinite(distNum) ? distNum.toFixed(4) : "";
			const userId = it.user_id ?? it.userId ?? "";
			const t = fmtTime(it.ts ?? it.timestamp);

			const li = document.createElement("li");
			li.classList.add("whitespace-pre-wrap", ok ? "text-green-400" : "text-red-400");
			li.textContent = `${ok ? "SUCCESS" : "FAILED"} | User ${userId} | distance=${dist} | ${t}`;
			list.appendChild(li);
		}

		const newest = items[0];
		const ok = newest.status === "ok" || newest.result === "success";
		const dNum = Number(newest.distance);
		const d = Number.isFinite(dNum) ? dNum.toFixed(4) : "";
		setBanner(
			ok ? `Authentication successful${d ? ` (distance: ${d})` : ""}`
			   : `Authentication failed${d ? ` (distance: ${d})` : ""}`,
			ok
		);

    setEsp32Status(newest.ts ?? newest.timestamp);

	} catch (err) {
		console.error("Lỗi tải danh sách xác thực:", err);
		list.innerHTML = `<li class="text-red-400">Không thể tải dữ liệu xác thực.</li>`;
		if (banner) {
			banner.classList.remove("text-green-400");
			banner.classList.add("text-red-400");
			banner.textContent = "Không thể tải dữ liệu xác thực.";
		}
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const btn = document.getElementById("runFaceRecogBtn");
	const out = document.getElementById("faceRecogOutput");
	if (!btn) return;

	btn.addEventListener("click", async () => {
		btn.disabled = true;
		btn.textContent = "Đang chạy...";
		if (out) out.textContent = "";
		try {
			const res = await fetch(`${API_BASE}/run-face-recognition`, { method: "POST" });
			const data = await res.json();
			if (data.success) {
				out.textContent = (data.stdout || "").trim() || "Đã chạy thành công.";
			} else {
				const msg = data.error || data.stderr || "Lỗi không xác định.";
				out.textContent = `Lỗi: ${msg}`;
			}
			// Sau khi chạy xong, refresh danh sách xác thực
			await loadVerifications();
		} catch (e) {
			out.textContent = "Không thể gọi API /run-face-recognition.";
		} finally {
			btn.disabled = false;
			btn.textContent = "Chạy Face Recognition";
		}
	});
});



// Tải danh sách ngay khi trang load
window.addEventListener("DOMContentLoaded", loadUsers);
window.addEventListener("DOMContentLoaded", loadVerifications);



/// ======================== MQTT (subscribe smartlock/verify) =====================
(function initMQTTListener() {
  const list = document.querySelector("#verificationList");
  const banner = document.querySelector("#authResult");
  if (!list) return;

  function fmtTime(ts) {
    if (typeof ts === "number" && ts < 1e12) ts *= 1000;
    return new Date(ts || Date.now()).toLocaleString();
  }

  function setBanner(text, ok) {
    if (!banner) return;
    banner.classList.remove("text-gray-400", "text-green-400", "text-red-400");
    banner.classList.add(ok ? "text-green-400" : "text-red-400");
    banner.textContent = text;
  }

  // Chờ mqtt.js gọi connectMQTT() và thiết lập window.mqttClient
  function attach() {
    if (!window.mqttClient) return setTimeout(attach, 300);

    // Đăng ký subscribe khi MQTT thực sự connect
    window.mqttClient.on("connect", () => {
      const TOPIC = "smartlock/verify";
      window.mqttClient.subscribe(TOPIC, (err) => {
        if (err) console.error("Subscribe error:", err);
      });
    });

    // Nhận message
    window.mqttClient.on("message", (topic, buf) => {
      if (topic !== "smartlock/verify") return;

      let data;
      try { data = JSON.parse(buf.toString()); }
      catch (e) { console.error("Bad JSON:", e, buf.toString()); return; }

      const ok = data.status === "ok";
      const distNum = Number(data.distance);
      const dist = Number.isFinite(distNum) ? distNum.toFixed(4) : "";
      const userId = data.user_id ?? data.userId ?? "";
      const timeStr = fmtTime(data.ts ?? data.timestamp);

      setBanner(
        ok ? `Authentication successful (distance: ${dist})`
           : `Authentication failed${dist ? ` (distance: ${dist})` : ""}`,
        ok
      );

      const li = document.createElement("li");
      li.classList.add("whitespace-pre-wrap", ok ? "text-green-400" : "text-red-400");
      li.textContent = `${ok ? "SUCCESS" : "FAILED"} | User ${userId} | distance=${dist} | ${timeStr}`;
      list.prepend(li);
    });
  }

  attach();
})();

async function pollLatestResult() {
  try {
    // DÙNG URL TUYỆT ĐỐI TỚI FLASK
    const res = await fetch(ENDPOINT_LATEST, { cache: "no-store" });
    if (!res.ok) return;
    const it = await res.json();

    // Chuẩn hoá dữ liệu
    const ok = it.status === "ok" || it.result === "success";
    const distNum = Number(it.distance);
    const dist = Number.isFinite(distNum) ? distNum.toFixed(4) : "";
    const userId = it.user_id ?? it.userId ?? "";
    const ts = it.ts ?? it.timestamp ?? Date.now();

    // CHỐNG TRÙNG (tránh trùng với MQTT / loadVerifications)
    const key = eventKey({ user_id: userId, distance: dist, ts });
    if (window.seenEvents.has(key)) return;
    window.seenEvents.add(key);

    // Banner
    const banner = document.querySelector("#authResult");
    if (banner) {
      banner.classList.remove("text-gray-400", "text-green-400", "text-red-400");
      banner.classList.add(ok ? "text-green-400" : "text-red-400");
      banner.textContent = ok
        ? `Authentication successful${dist ? ` (distance: ${dist})` : ""}`
        : `Authentication failed${dist ? ` (distance: ${dist})` : ""}`;
    }

    // Danh sách
    const list = document.querySelector("#verificationList");
    if (list) {
      const li = document.createElement("li");
      li.classList.add("whitespace-pre-wrap", ok ? "text-green-400" : "text-red-400");
      const timeStr = (typeof ts === "number" && ts < 1e12)
        ? new Date(ts * 1000).toLocaleString()
        : new Date(ts).toLocaleString();
      li.textContent = `${ok ? "SUCCESS" : "FAILED"} | User ${userId} | distance=${dist} | ${timeStr}`;
      list.prepend(li);
    }

    // Dòng trạng thái ESP32
    setEsp32Status(ts);
  } catch (err) {
    console.error("Polling error:", err);
  }
}

// Gọi mỗi 2 giây (nếu đã dùng MQTT realtime thì có thể giảm/tắt polling)
setInterval(pollLatestResult, 2000);

