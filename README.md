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


Các bước kết nối esp32 với website:
B1: Bật cmd, gõ "mosquitto -c + "<đường dẫn chứa file .conf ví dụ như C\Users\Bao Dinh\Documents\mosquitto.conf>"
-> Mosquitto.conf chạy tức là mqtt đã được khởi động 

B2: Chọn mylock.html (hoặc file html nào khác), nhấn chuột phải chọn "Open with live server" (chưa có live sever thì cài extension)

B3: Compile và upload code vào esp32, vào Tools > Serial monitor để xem liệu mạch đã vào wifi và kết nối MQTT thành công chưa

B4: Sau đó quay về web page và F12 chọn tab console và xem message mà esp32 gửi tới web
