# Smart-Door-Lock-System-with-Face-Recognition


# 🔐 Smart Door Lock - Website (HTML/CSS/JS + Firebase + MQTT)

Tên nhóm: Nhóm 12
Tên sản phẩm: Smart Door Lock System
Thành viên: 
Đinh Nguyễn Gia Bảo (22127027) (Trưởng nhóm)
Nguyễn Công Tuấn (22127436)
Hoàng Lê Minh Đăng (22127051)
Nguyễn Quang Sáng (22127364)

Link Drive:https://drive.google.com/drive/u/0/folders/18kOKDldTDm6pFZRxwpJJaAG9Qr4IssV3


Giao diện web đơn giản được viết bằng HTML, CSS, JavaScript thuần, sử dụng:
- **Firebase Authentication** để đăng ký / đăng nhập người dùng
- **MQTT over WebSocket** để điều khiển khóa cửa
- **Mosquitto MQTT Broker** chạy bằng Docker
- Giao diện **Dark Mode** hiện đại, dễ sử dụng

---

## 📁 Cấu trúc thư mục

```
src/
└── website/
    ├── index.html            # Trang giới thiệu sản phẩm + lựa chọn đăng ký/đăng nhập
    ├── signin.html           # Trang đăng nhập
    ├── signup.html           # Trang đăng ký tài khoản
    ├── mylock.html           # Giao diện chính sau khi đăng nhập
    ├── css/
    │   └── style.css         # Giao diện dark mode
    ├── js/
    │   ├── firebase.js       # Kết nối Firebase
    │   ├── auth.js           # Xử lý đăng nhập / đăng ký
    │   ├── mqtt.js           # Kết nối MQTT qua WebSocket
    │   └── mylock.js         # Điều khiển cửa và đổi mật khẩu
    └── mosquitto_config/
        └── mosquitto.conf    # File cấu hình Mosquitto (MQTT broker)
```

---

## 🚀 Cách chạy web

### ✅ 1. Mở web bằng trình duyệt
```bash
cd src/website
start index.html
```

> Hoặc mở bằng VS Code rồi chạy Live Server.

---

## 🔧 Cấu hình Firebase

1. Truy cập [https://console.firebase.google.com](https://console.firebase.google.com)
2. Tạo Project mới
3. Bật **Authentication → Sign-in method → Email/Password**
4. Lấy cấu hình và thay thế vào `js/firebase.js`

```js
// js/firebase.js
firebase.initializeApp({
	apiKey: "...",
	authDomain: "...",
	projectId: "...",
	appId: "...",
});
const auth = firebase.auth();
```

---

## 📡 Cấu hình MQTT WebSocket (với Docker)

### 🧩 Bước 1: Tạo file cấu hình `mosquitto.conf`

```conf
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous true
```

Lưu vào:  
`src/website/mosquitto_config/mosquitto.conf`

---

### 🐳 Bước 2: Chạy Mosquitto bằng Docker

```bash
docker run -it -p 1883:1883 -p 9001:9001 ^
  -v "C:\Full\Path\to\mosquitto.conf":/mosquitto/config/mosquitto.conf ^
  eclipse-mosquitto
```

> ⚠️ Đảm bảo không có phần mềm nào khác đang chiếm cổng 1883 hoặc 9001.

---

## ✨ Tính năng đã hỗ trợ

- ✅ Giao diện Dark Mode
- ✅ Firebase Authentication (Email/Password)
- ✅ Tự động chuyển trang nếu chưa đăng nhập
- ✅ Gửi lệnh mở/đóng cửa qua MQTT
- ✅ Gửi yêu cầu thay đổi mật khẩu
- ✅ Hiển thị email người dùng khi đăng nhập

---

## 💡 Các tính năng mở rộng (gợi ý thêm)

- 📝 Lưu lịch sử mở cửa vào Firestore
- 🟢 Hiển thị trạng thái cửa realtime
- 🔐 Thêm xác thực người dùng cho MQTT broker
- 📱 Kết nối ESP32 để nhận lệnh và điều khiển thật

---

## 👨‍💻 Tác giả

- 📌 Dự án: Smart Door Lock System 2025  
- ✍️ Người thực hiện: [Tên bạn ở đây]

---

## 📷 Ảnh demo (tuỳ chọn)

> Bạn có thể chụp giao diện website và chèn ảnh demo tại đây bằng Markdown nếu upload lên GitHub.