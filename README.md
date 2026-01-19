# Smart-Door-Lock-System-with-Face-Recognition

> A smart door lock system integrated with face recognition, featuring remote control and monitoring via a Web Interface, powered by MQTT protocol and Firebase.

## 🚀 Key Features
* **Face Recognition:** Automatically unlocks the door upon detecting a registered face (processed via ESP32-CAM or Server).
* **Remote Control:** Lock/Unlock mechanism via a Web Interface.
* **Real-time Communication:** Low-latency signal transmission between the device and the web client using MQTT.
* **Access Logs:** Stores entry/exit history on Firebase (real-time log display).
* **Security:** User authentication system.

## 🛠️ Tech Stack

* **Hardware:** ESP32 (WROOM/CAM), Relay Module/Solenoid Lock.
* **Firmware:** C++ (Arduino Framework).
* **Communication Protocol:** MQTT (Message Queuing Telemetry Transport).
* **Broker:** Mosquitto.
* **Frontend:** HTML5, CSS3, JavaScript.
* **Backend/Database:** Google Firebase, MQTT Broker.

## 📂 Resources
* **Documentation & Reports:** *[Google Drive Link](https://drive.google.com/drive/folders/1VZbXMlG_8XMpnekmuLuBldt7XAZF0HcC?usp=sharing)*
* **Demo Video:** *[Google Drive Link](https://drive.google.com/drive/u/0/folders/1bkMnTYiFPN3r1eLRinoaCSbuWMonA_jR)*

## ⚙️ Installation & Setup
### 📥 Clone the Repository
```bash
git clone https://github.com/BAoD1nH/SDLS_AIOT.git --recursive
cd SDLS_AIOT
```

To run this project, you need to set up the environment for both the Hardware (ESP32) and the Software (Web/MQTT Broker).

### 1. Prerequisites
* **Mosquitto Broker:** Installed on your local machine.
* **VS Code:** Installed with the **"Live Server"** extension.
* **Arduino IDE:** Installed with `PubSubClient`, `WiFi`, and ESP32 Board support.

### 2. Start MQTT Broker
Open **Command Prompt (CMD)** or Terminal and run the following command to start Mosquitto with your configuration file:

```bash
mosquitto -c "C:\Users\Bao Dinh\Documents\mosquitto.conf"
```
Instructions:
B1: Bật cmd, gõ "mosquitto -c + "<đường dẫn chứa file .conf ví dụ như C\Users\Bao Dinh\Documents\mosquitto.conf>"
-> Mosquitto.conf chạy tức là mqtt đã được khởi động 

B2: Chọn mylock.html (hoặc file html nào khác), nhấn chuột phải chọn "Open with live server" (chưa có live sever thì cài extension)

B3: Compile và upload code vào esp32, vào Tools > Serial monitor để xem liệu mạch đã vào wifi và kết nối MQTT thành công chưa

B4: Sau đó quay về web page và F12 chọn tab console và xem message mà esp32 gửi tới web


## 👥 Contributors

| Member | Role | Contact |
| :--- | :--- | :--- |
| **Dinh Nguyen Gia Bao** | AI Engineer, Backend, IoT (ESP32, MQTT) | [GitHub](https://github.com/BAoD1nH) |
| **Nguyen Cong Tuan** | Frontend Engineer (Web Interface) | [GitHub](https://github.com/0Nguyen0Cong0Tuan0) |
