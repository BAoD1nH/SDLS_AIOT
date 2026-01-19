# Smart-Door-Lock-System-with-Face-Recognition

> A smart door lock system integrated with face recognition, featuring remote control and monitoring via a Web Interface, powered by MQTT protocol and Firebase.
<img width="1050" height="611" alt="Screenshot from 2026-01-19 23-35-08" src="https://github.com/user-attachments/assets/70ae2a06-74b2-4099-a266-bfb0463536a6" />
<img width="1149" height="733" alt="Screenshot from 2026-01-19 23-25-59" src="https://github.com/user-attachments/assets/88e563fc-bbd8-47e9-8cbd-851d0f4f506f" />
<img width="528" height="648" alt="Screenshot from 2026-01-19 23-28-13" src="https://github.com/user-attachments/assets/c5df3bd2-c62f-4dfa-afef-0973aeac9d89" />
<img width="546" height="606" alt="Screenshot from 2026-01-19 23-28-45" src="https://github.com/user-attachments/assets/8d8338ec-4295-4e92-bf98-d991ba8db30a" />

<img width="520" height="498" alt="Screenshot from 2026-01-19 23-29-54" src="https://github.com/user-attachments/assets/68079bc8-c475-41b4-81e2-d0a129d9fd46" />
<img width="520" height="498" alt="Screenshot from 2026-01-19 23-30-00" src="https://github.com/user-attachments/assets/951bd4e1-1065-44b2-924f-8e4e05f18495" />
<img width="520" height="498" alt="Screenshot from 2026-01-19 23-30-06" src="https://github.com/user-attachments/assets/90cd6aae-3cba-459b-8b3f-a2d76631edb3" />


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

## News
- 19-1-2026: Update Documentations (Readme)

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

## 👥 Contributors

| Member | Role | Contact |
| :--- | :--- | :--- |
| **Dinh Nguyen Gia Bao** | AI Engineer, Backend, IoT (ESP32, MQTT) | [GitHub](https://github.com/BAoD1nH) |
| **Nguyen Cong Tuan** | Frontend Engineer (Web Interface) | [GitHub](https://github.com/0Nguyen0Cong0Tuan0) |

## License
- This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
- If you want to use or contribute this framework, please contact via baodinhtfb@gmail.com
