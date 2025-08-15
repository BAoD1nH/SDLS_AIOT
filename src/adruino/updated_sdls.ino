//----------------------------------------------------  LIBRARIES ----------------------------------------------------//
#include <ESP32Servo.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>  // NVS cho ESP32
//----------------------------------------------------  FLAGS ----------------------------------------------------//
bool enablePinFlow = false;
bool enableWebFlow = false;
bool enableFaceFlow = false;
bool webUnlockRequested = false;    // Khi website thật sự gửi yêu cầu mở cửa
bool firstTime = true;       // Cờ cho lần đầu thiết lập mật khẩu

bool is2FAOn = false;
bool auto_lock_var = false;
bool enableWiFiMQTT = true;  // <-- Bật khi test Web Flow hoặc các chức năng dùng MQTT
bool isDoorOpen = false;  // Khởi tạo trạng thái ban đầu là đóng

bool enable2FA = false;
String otpFromWeb = "";
bool otpReceived = false;

//Facerecognition
bool faceFlowInit = false;
bool faceVerified = false;
unsigned long faceStartTime = 0;
const unsigned long FACE_TIMEOUT_MS = 30000; // 30s
String faceUserId = "";
float faceDistance = 1.0f;

//8.11.25 - Add "Update password manually" - Flow đổi mật khẩu thủ công
Preferences prefs; 
bool enablePassChangeFlow = false;
enum PassChangeState { ENTER_OLD, ENTER_NEW, CONFIRM_NEW };
PassChangeState passChangeState = ENTER_OLD;
String passBuf = "";
String newPinCandidate = "";
unsigned long passChangeLastKeyTs = 0;
const unsigned long PASS_CHANGE_TIMEOUT_MS = 30000;  // 30s không bấm thì thoát

//----------------------------------------------------  VARIABLES ----------------------------------------------------//
String inputString = "";
String currentLockPassword = "1234";
String webPassword = "";

int failedAttempts = 0;
const int maxFailedAttempts = 3;
unsigned long lastUnlockTime = 0;

//----------------------------------------------------  WIFI - MQTT CONFIG ----------------------------------------------------//
const char* ssid = "Gia Bao";
const char* password = "28092004";
const char* mqttServer = "192.168.1.2";
const int mqttPort = 1883;
const char* mqttUser = "";
const char* mqttPassword = "";
const char* clientId = "AbtqLqY5Rcc43dBatoYJHflsAUg1";

WiFiClient espClient;
PubSubClient client(espClient);

//----------------------------------------------------  KEYPAD CONFIG ----------------------------------------------------//
#define ROW_NUM 4
#define COLUMN_NUM 4
char keys[ROW_NUM][COLUMN_NUM] = {
    {'1', '2', '3', 'A'},
    {'4', '5', '6', 'B'},
    {'7', '8', '9', 'C'},
    {'*', '0', '#', 'D'}
};
byte pin_rows[ROW_NUM] = {4, 5, 6, 7};
byte pin_column[COLUMN_NUM] = {10, 11, 12, 13};
Keypad keypad = Keypad(makeKeymap(keys), pin_rows, pin_column, ROW_NUM, COLUMN_NUM);

//----------------------------------------------------  SERVO CONFIG ----------------------------------------------------//
Servo myServo1;
const int servoPin = 18;

//----------------------------------------------------  BUZZER CONFIG ----------------------------------------------------//
const int buzzerPin = 35;

//----------------------------------------------------  LCD CONFIG ----------------------------------------------------//
LiquidCrystal_I2C lcd(0x27, 16, 2);

///----------------------------------------------------  PROTOTYPES ----------------------------------------------------///

//---------------------------------------------------- WIFI & MQTT ----------------------------------------------------//
void connectToWiFi();
void reconnectMQTT();
void callback(char* topic, byte* payload, unsigned int length);

//---------------------------------------------------- DOOR CONTROL ----------------------------------------------------//
void controlServo(bool lock);   // Điều khiển servo mở/khóa
void lockDoor();                // Khóa cửa
void unlockDoor();              // Mở cửa
void autoLockOn();              // Tự động khóa sau 10s nếu bật auto_lock_var
void selectUnlockMode();        // Set hình thức mở cửa
//---------------------------------------------------- PIN FLOW ----------------------------------------------------//
void setupPassword();           // Thiết lập mật khẩu lần đầu
bool checkPassword();           // Kiểm tra mật khẩu
void resetFailedAttempts();     // Reset số lần nhập sai

//---------------------------------------------------- OTP (2FA) ----------------------------------------------------//
// String generateOTP();           // Tạo mã OTP ngẫu nhiên
// String sendOTPToWebsite();      // Gửi OTP tới website qua MQTT
bool check2FASecurity();        // Kiểm tra OTP nhập vào từ keypad

//---------------------------------------------------- FACEID FLOW ----------------------------------------------------//
void startFaceRecognition();    // Bắt đầu quá trình nhận diện khuôn mặt
void registerFace();            // Đăng ký khuôn mặt mới
void verifyFace();              // Xác minh khuôn mặt và mở khóa

//---------------------------------------------------- LCD DISPLAY ----------------------------------------------------//
void lcdShowUnlockOptions();               // Hiển thị menu chính: 1PIN 2WEB 3FACE
void lcdShowMessage(String line1, String line2);  // Hiển thị 2 dòng tùy ý
void lcdShowWelcome();                     // Hiển thị "Welcome, door locks after 10s"
void lcdShowEnterPassword();               // Hiển thị "Enter your password"
void lcdShowSetupSuccess();                // Hiển thị "Setup successfully"
void lcdShowWrongPassword(int remaining);  // Hiển thị số lần nhập sai còn lại
void lcdShowLocking();
void lcdShowLockSuccess();
//---------------------------------------------------- MQTT & WARNING ----------------------------------------------------//
void publishWarning();          // Gửi cảnh báo qua MQTT
void publishOpen();             // Gửi trạng thái mở cửa
void publishBlock();            // Gửi trạng thái khóa cửa
void triggerAlarm();            // Phát còi cảnh báo

//---------------------------------------------------- FLOW HANDLER ----------------------------------------------------//
void handlePinFlow();           // Quản lý toàn bộ flow 1PIN
void handleWebFlow();           // Quản lý toàn bộ flow 2WEB
void handleFaceFlow();          // Quản lý toàn bộ flow 3FACE

//---------------------------------------------------- Other functions ----------------------------------------------------//
void softResetToSetup();  // <-- THÊM
// --- Key helpers ---
void flushKeypad(uint16_t stable_ms = 120);


//----------------------------------------------------  SETUP ----------------------------------------------------//
void setup() {
	Serial.begin(115200);

	// Khởi tạo LCD I2C với SDA = 20, SCL = 21
	Wire.begin(20, 21);
	lcd.init();
	lcd.backlight();

	// Khởi tạo Servo
	myServo1.attach(servoPin);
	myServo1.write(0); // Mặc định khóa cửa

	// Buzzer
	pinMode(buzzerPin, OUTPUT);
	digitalWrite(buzzerPin, LOW);

	// Hiển thị chào mừng
	lcdShowMessage("Smart Door Lock", "B:Menu C:Reset");
	delay(2000);

	//8.11.25 - Add "Update password manually"
	enable2FA = false;

	// Đọc PIN từ NVS (nếu đã lưu trước đó)
	prefs.begin("lock", false);
	String savedPin = prefs.getString("pin", "");
	if (savedPin.length() >= 4 && savedPin.length() <= 8) {
		currentLockPassword = savedPin;
		firstTime = false;
		Serial.printf("[NVS] Loaded saved PIN: %s\n", currentLockPassword.c_str());
	} else {
		// Nếu chưa có, giữ "1234" và sẽ lưu khi người dùng setup/đổi
		firstTime = true;
		Serial.println("[NVS] No saved PIN, using default 1234");
	}

	// Nếu là lần đầu tiên thì setup mật khẩu
	if (firstTime) {
		setupPassword();    
		firstTime = false;
	}

	// Kết nối Wi-Fi/MQTT nếu được bật
	if (enableWiFiMQTT) {
		connectToWiFi();
		client.setServer(mqttServer, mqttPort);
		client.setCallback(callback);
		reconnectMQTT();
	}

	if (enableWiFiMQTT) {
		lcdShowMessage("Wi-Fi/MQTT", "ENABLED");
	} else {
		lcdShowMessage("Wi-Fi/MQTT", "DISABLED");
	}
	delay(1000);

}

//----------------------------------------------------  LOOP ----------------------------------------------------//
void loop() {
	// Bắt phím B toàn cục để quay về menu
	char globalKey = keypad.getKey();

	if (globalKey == 'B') {
			// Reset toàn bộ flow
			enablePinFlow = false;
			enableWebFlow = false;
			enableFaceFlow = false;
			enablePassChangeFlow = false;
			auto_lock_var = false;
			flushKeypad(120);
			// Trở về menu chính
			lcdShowUnlockOptions();

			return; // Dừng loop tại đây, sang vòng sau
	}
	
	if (globalKey == 'C') {           // <-- THÊM
			softResetToSetup();           // <-- THÊM
			flushKeypad(120);
			return;                       // <-- THÊM
	}

	// Xử lý các flow
	if (enableWiFiMQTT) {
	// Wi-Fi reconnect nếu cần (có thể bỏ nếu WiFi ổn định)
		if (WiFi.status() != WL_CONNECTED) {
			connectToWiFi();
		}

		// MQTT reconnect nếu mất kết nối
		if (!client.connected()) {
			reconnectMQTT();
		}

		client.loop();  // Quan trọng: cần để nhận callback MQTT
	}

	if (enablePinFlow) handlePinFlow();
	if (enableWebFlow) handleWebFlow();
	if (enableFaceFlow) handleFaceFlow();
	if (enablePassChangeFlow) handleManualPassChangeFlow();

	// ✅ Nếu đủ điều kiện auto-lock → gọi luôn
	if (auto_lock_var && (millis() - lastUnlockTime >= 10000)) {
		autoLockOn();  // Hàm này tự delay 2s rồi mới kết thúc
	}

	// ✅ Sau khi auto lock hoặc không còn flow nào đang chạy
	if (!enablePinFlow && !enableWebFlow && !enableFaceFlow && !enablePassChangeFlow && !auto_lock_var) {
		selectUnlockMode();  // Quay về menu chính
	}
}


//---------------------------------------------------- WIFI & MQTT ----------------------------------------------------//
void connectToWiFi() {
	Serial.print("Connecting to WiFi: ");
	Serial.println(ssid);
	WiFi.begin(ssid, password);

	lcd.clear();
	lcd.setCursor(0, 0);
	lcd.print("Connecting WiFi");

	// Chờ kết nối WiFi
	int dot = 0;
	while (WiFi.status() != WL_CONNECTED) {
		delay(500);
		Serial.print(".");
		lcd.setCursor(dot % 16, 1);
		lcd.print(".");
		dot++;
	}

	// Kết nối thành công
	Serial.println();
	Serial.println("Connected to WiFi!");
	Serial.print("IP: ");
	Serial.println(WiFi.localIP());

	lcd.clear();
	lcd.setCursor(0, 0);
	lcd.print("WiFi Connected!");
	lcd.setCursor(0, 1);
	lcd.print(WiFi.localIP().toString());
	delay(2000);
	lcdShowUnlockOptions(); // Quay lại menu chính
}

void reconnectMQTT() {
	// Duy trì kết nối MQTT
	while (!client.connected()) {
		Serial.print("Attempting MQTT connection...");
		lcd.clear();
		lcd.setCursor(0, 0);
		lcd.print("Connecting MQTT");

		// Thử kết nối với clientId
		if (client.connect(clientId, mqttUser, mqttPassword)) {
			Serial.println("connected");
			lcd.setCursor(0, 1);
			lcd.print("MQTT Connected");
			delay(1000);

			// Subscribe topic cần thiết
			client.subscribe(clientId);
			client.subscribe("door/control");
			client.subscribe("door/password");
			client.subscribe("door/password_check");
			client.subscribe("door/otp");    // ✅ Nhận OTP từ web
			client.subscribe("door/2fa");    // ✅ Nhận tín hiệu bật/tắt 2FA
			client.subscribe("smartlock/verify");   // face-recognition
			
			// if (currentLockPassword.length() > 0 && client.connected()) {
			// 	client.publish("door/password_sync", currentLockPassword.c_str(), true);
			// 	Serial.println("[SYNC] Re-published current password (retained).");
			// }
		} else {
			Serial.print("failed, rc=");
			Serial.print(client.state());
			Serial.println(" retry in 5 sec");
			lcd.setCursor(0, 1);
			lcd.print("MQTT Retry...");
			delay(5000);
		}
	}
}

void callback(char* topic, byte* payload, unsigned int length) {
	String topicStr = String(topic);
	String msg = "";

	for (int i = 0; i < length; i++) {
		msg += (char)payload[i];
	}

	Serial.print("[MQTT] Received on ");
	Serial.print(topicStr);
	Serial.print(": ");
	Serial.println(msg);

	// ✅ Nếu topic là door/control và lệnh là "open"
	if (topicStr == "door/control") {
		if (msg == "open") {
			Serial.println("[WEB] Mở cửa từ website!");
			webUnlockRequested = true;

			// Khi 2FA bật → yêu cầu nhập OTP sau đó mới unlockDoor ở nơi khác
			if (!enable2FA) {
				lcdShowMessage("Web Request", "Door Opening...");
				unlockDoor();
				publishOpen();
			} else {
				lcdShowMessage("2FA Enabled", "Waiting OTP...");
				// Sẽ xử lý phần nhập OTP ở handleWebFlow() hoặc unlockDoor()
			}
		} else if (msg == "lock") {
			Serial.println("[WEB] Khoá cửa từ website!");
			lcdShowMessage("Web Request", "Locking...");
			lockDoor();
			publishBlock();
		}
	}
	// ----------- Nhận mật khẩu mới từ Web ----------- //
	else if (topicStr == "door/password") {
		String newPass = msg;

		if (newPass.length() >= 4 && newPass.length() <= 10) { // hoặc điều kiện bạn mong muốn
			currentLockPassword = newPass;
			//8.11.25 - ADD "Update password manually"
			prefs.putString("pin", currentLockPassword); 

			Serial.print("[WEB] Đã cập nhật mật khẩu mới từ website: ");
			Serial.println(currentLockPassword);
			lcdShowMessage("Password Updated", "From Website");

			//8.11.25 - Add to fix "Update password via web"
			if (client.connected()) {
				client.publish("door/password_sync", currentLockPassword.c_str(), true);
			}
		} else {
			Serial.println("[WEB] Mật khẩu mới không hợp lệ.");
			lcdShowMessage("Pass Update Failed", "Invalid Format");
		}
	}
	
	// ----------- Nhận OTP từ Web để dùng trong 2FA ----------- //
	else if (topicStr == "door/otp") {
		otpFromWeb = msg;
		otpReceived = true;
		Serial.print("[2FA] Nhận OTP từ Web: ");
		Serial.println(otpFromWeb);
		lcdShowMessage("OTP Received", "Check Now");
	}

	// ----------- Bật/Tắt tính năng 2FA từ Web ----------- //
	else if (topicStr == "door/2fa") {
		if (msg == "on") {
			enable2FA = true;
			Serial.println("[2FA] Đã bật xác thực hai bước");
			lcdShowMessage("2FA Enabled", "");
		} else if (msg == "off") {
			enable2FA = false;
			Serial.println("[2FA] Đã tắt xác thực hai bước");
			lcdShowMessage("2FA Disabled", "");
		}
	}

	else if (topicStr == "smartlock/verify") {
		// Payload JSON: {"status":"ok","user_id":"1","distance":0.18,"threshold":0.3,"ts":...}
		StaticJsonDocument<256> doc;
		DeserializationError err = deserializeJson(doc, msg);
		if (err) {
			Serial.printf("[FACE] JSON parse failed: %s\n", err.c_str());
			return;
		}
		const char* status = doc["status"] | "fail";
		if (strcmp(status, "ok") == 0) {
			faceVerified = true;
			faceUserId = String(doc["user_id"] | "");
			faceDistance = doc["distance"] | 1.0f;
			Serial.printf("[FACE] VERIFY OK user=%s dist=%.4f\n", faceUserId.c_str(), faceDistance);
			lcdShowMessage("Face Verified", "Opening...");
		} else {
			Serial.println("[FACE] VERIFY FAIL");
			// tuỳ chọn: hiển thị trạng thái fail nếu muốn
		}
	}
}


//---------------------------------------------------- DOOR CONTROL ----------------------------------------------------//
void controlServo(bool lock) {
  if (lock) {
        myServo1.write(0);   // Góc khóa
    } else {
        myServo1.write(90);  // Góc mở
    }
}

void lockDoor() {
  controlServo(true);
  lcdShowLockSuccess();

	isDoorOpen = false;  // ✅ Cập nhật flag
	if (client.connected()) {
		client.publish("door/status", "Door locked");
	}
}

void unlockDoor() {
	// Chỉ check OTP nếu 2FA bật *và* không phải luồng FACE đã verify
  if (enable2FA && !(enableFaceFlow && faceVerified)) {
    if (!check2FASecurity()) {
      Serial.println("[2FA] OTP sai hoặc timeout. Không mở cửa.");
      lcdShowMessage("2FA Failed", "Access Denied");
      return;
    }
  }

	// ✅ Nếu không dùng 2FA hoặc OTP đúng → mở cửa như bình thường
	controlServo(false);
	lcdShowMessage("Door Opened", "");
	lastUnlockTime = millis();
	auto_lock_var = true;  // Bật auto lock

	isDoorOpen = true;  // ✅ Cập nhật flag

	if (client.connected()) {
		client.publish("door/status", "Door opened");
	}
}


void autoLockOn() {
	
  lcdShowLocking();     // Hiển thị "Locking door..."
  lockDoor();           // Khóa cửa + hiển thị "Door Locked"
  publishBlock();       // Gửi trạng thái
  Serial.println("[AUTO LOCK] Door has been automatically locked.");
  auto_lock_var = false;
  delay(2000);
}




//---------------------------------------------------- PIN FLOW ----------------------------------------------------//
void setupPassword() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Set New Password");
  inputString = "";

	flushKeypad(120);

  Serial.println("[SETUP] Please input new password and press * to confirm.");

  while (true) {
    char key = keypad.getKey();
    if (key) {
      if (key == '*') {  // Xác nhận
				bool formatOK = (inputString.length() >= 4 && inputString.length() <= 8);
        if (formatOK) {
          currentLockPassword = inputString;

					//8.11.25 - Add "Update password manually"
					prefs.putString("pin", currentLockPassword);

					//8.11.25 - Add to fix bug "Update password via web"
					if (client.connected()) {
						// retained = true để các subscriber nhận được ngay cả khi subscribe trễ
						client.publish("door/password_sync", currentLockPassword.c_str(), true);
					}

          lcdShowSetupSuccess();   // "Setup successfully"
          Serial.print("[SETUP] New password set: ");
          Serial.println(currentLockPassword);
          delay(2000);
          break;
        } else {
          lcdShowMessage("Password Empty", "Try Again");
          inputString = "";
          delay(2000);
          lcd.clear();
          lcd.print("Set New Password");
        }
      } else if (key == '#') {  // Xóa nhập
        inputString = "";
        lcdShowMessage("Clear", "");
        delay(500);
        lcd.clear();
        lcd.print("Set New Password");
      } else {
        inputString += key;
        lcdShowMessage("New Password:", inputString);
      }
    }
  }
}

bool checkPassword() {
	if (inputString == currentLockPassword) {
		failedAttempts = 0;
		lcdShowWelcome();
		unlockDoor();
		publishOpen();
		delay(2000);
		inputString = "";
		return true;  // <-- Đúng mật khẩu
	} else {
		failedAttempts++;
		int remaining = maxFailedAttempts - failedAttempts;
		if (remaining > 0) {
			lcdShowWrongPassword(remaining);
			delay(2000);
			inputString = "";
			return false;  // <-- Sai mật khẩu
		} else {
			lcdShowMessage("Locked Out!", "");
			publishWarning();
			triggerAlarm();
			failedAttempts = 0;

			// NEW: tắt flow PIN và về menu
			enablePinFlow = false;        
			lcdShowUnlockOptions();        
			return false;
		}
	}
}


void resetFailedAttempts() {
  failedAttempts = 0;
}

//---------------------------------------------------- OTP (2FA) ----------------------------------------------------//
// String generateOTP() {
//   String otp = "";
//   for (int i = 0; i < 6; i++) {  // Tạo OTP 6 chữ số
//     otp += String(random(0, 10));  // random() sinh số từ 0 đến 9
//   }
//   Serial.print("[OTP] Generated OTP: ");
//   Serial.println(otp);
//   return otp;
// }

// String sendOTPToWebsite() {
//   String otp = generateOTP();  // Gọi hàm tạo OTP

//   if (client.connected()) {
//     String message = "OTP: " + otp;
//     client.publish(clientId, message.c_str()); // Gửi OTP qua MQTT
//     Serial.print("[OTP] Published to topic: ");
//     Serial.println(clientId);
//     Serial.print("[OTP] Message: ");
//     Serial.println(message);
//   } else {
//     Serial.println("[OTP] MQTT client not connected. Unable to publish OTP.");
//   }
//   return otp;
// }

bool check2FASecurity() {
  // Nếu ai đó gọi nhầm khi 2FA đang tắt thì cho qua luôn
  if (!enable2FA) return true;

  // Clear trạng thái cũ để không ăn nhầm
  otpReceived = false;
  otpFromWeb  = "";

  // 1) Gửi yêu cầu OTP lên web (KHÔNG retained)
  if (enableWiFiMQTT && client.connected()) {
    client.publish("door/otp_request", "pin", /*retained=*/false);
  } else {
    lcdShowMessage("2FA needs MQTT", "Press B to back");
    delay(1200);
    return false;
  }

  // 2) Chờ web gửi OTP (tối đa 20s) – vẫn chạy MQTT và cho phép hủy bằng B/C
  lcdShowMessage("Waiting for OTP", "B:Back  C:Reset");
  unsigned long waitStart = millis();
  while (!otpReceived && (millis() - waitStart < 20000)) {
    client.loop(); // quan trọng để nhận MQTT
    char k = keypad.getKey();
    if (k == 'B') return false;           // quay về menu
    if (k == 'C') { softResetToSetup(); return false; } // reset mềm về setup
    delay(5);
  }
  if (!otpReceived) {
    lcdShowMessage("2FA Timeout", "No OTP");
    delay(1200);
    return false;
  }

  // 3) Đã có OTP -> cho nhập trong 30s
  String userInputOTP = "";
  unsigned long startTime = millis();
  lcd.clear(); lcd.setCursor(0,0); lcd.print("Enter OTP:");

  while (millis() - startTime < 30000) {
    client.loop();
    char key = keypad.getKey();
    if (!key) continue;

    if (key == 'B') { otpReceived = false; return false; }
    if (key == 'C') { otpReceived = false; softResetToSetup(); return false; }
    if (key == '#') {
      userInputOTP = "";
      lcdShowMessage("OTP Cleared", "");
      delay(400);
      lcd.clear(); lcd.setCursor(0,0); lcd.print("Enter OTP:");
    } else if (key == '*') {
      bool ok = (userInputOTP == otpFromWeb);
      otpReceived = false; otpFromWeb = "";
      if (ok) return true;
      lcdShowMessage("2FA Failed", "Wrong OTP");
      delay(1200);
      return false;
    } else if (key >= '0' && key <= '9') {
      userInputOTP += key;
      lcdShowMessage("OTP:", userInputOTP);
    }
  }

  // 4) Hết giờ nhập
  otpReceived = false; otpFromWeb = "";
  return false;
}

//---------------------------------------------------- FACEID FLOW ----------------------------------------------------//
void startFaceRecognition() {}
void registerFace() {}
void verifyFace() {}

// //---------------------------------------------------- WEB FLOW ----------------------------------------------------//
// void waitForWebLogin() {}
// void verifyWebPassword() {}

//---------------------------------------------------- LCD DISPLAY ----------------------------------------------------//

void lcdShowMessage(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);

}
//---------------------------------------------------- LCD DISPLAY ----------------------------------------------------//

void lcdShowUnlockOptions() {
	lcdShowMessage("1PIN 2WEB 3FACE", "A:Change PIN");
}

void lcdShowWelcome() {
	lcdShowMessage("Welcome!", "Door locks in 10s");
	delay(2000);  // Cho người dùng đọc
}

void lcdShowEnterPassword() {
	lcdShowMessage("Enter Password:", "");
}

void lcdShowSetupSuccess() {
	lcdShowMessage("Setup successfully", "");
	Serial.println("[LCD] Setup successfully");
	delay(1000);
}

void lcdShowWrongPassword(int remaining) {
	String line2 = "Attempts: " + String(remaining);
	lcdShowMessage("Wrong Password!", line2);
}

void lcdShowLocking() {
	lcdShowMessage("Locking door...", "Please wait");
	Serial.println("[LCD] Locking door...");
	delay(1000);
}

void lcdShowLockSuccess() {
	lcdShowMessage("Door Locked!", "Secure Mode ON");
	Serial.println("[LCD] Door successfully locked.");
	delay(2000);
}

//---------------------------------------------------- MQTT & WARNING ----------------------------------------------------//
void publishWarning() {
  if (client.connected()) client.publish(clientId, "warning");
}

void publishOpen() {
  if (client.connected()) client.publish(clientId, "open");
}
void publishBlock() {
  if (client.connected()) client.publish(clientId, "block");
}

void triggerAlarm() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(buzzerPin, HIGH);
    delay(300);
    digitalWrite(buzzerPin, LOW);
    delay(300);
  }
}

void selectUnlockMode() {
	lcdShowUnlockOptions();
	char key = 0;

	while (true) {
		key = keypad.getKey();
		if (key == '1') {
			enablePinFlow = true;
			break;
		} else if (key == '2') {
			enableWebFlow = true;
			break;
		} else if (key == '3') {
			enableFaceFlow = true;
			break;
		} else if (key == 'A') {
			enablePassChangeFlow = true;
			passChangeState = ENTER_OLD;
			passBuf = "";
			newPinCandidate = "";
			passChangeLastKeyTs = millis();
			lcdShowMessage("Enter Old PIN", "");
			break;
		} else if (key == 'B'){
			lcdShowUnlockOptions();
			flushKeypad(80);
		} else if (key == 'C') {        // <-- THÊM
			softResetToSetup();       // <-- THÊM
			flushKeypad(120);
			break;                    // <-- THÊM
		}
	}
}

//---------------------------------------------------- FLOW HANDLER ----------------------------------------------------//
void handlePinFlow() {
	static bool initialized = false;

	if (!initialized) {
		lcdShowEnterPassword();  // Hiển thị lần đầu
		inputString = "";
		initialized = true;
	}

	char key = keypad.getKey();
	if (!key) return;

  // Ưu tiên xử lý phím điều hướng
  if (key == 'B') {
    // Về menu
    initialized = false;
    enablePinFlow = false;
    lcdShowUnlockOptions();
		flushKeypad(120);
    return;
  }
  if (key == 'C') {
    // Reset mềm: mở lại flow setup password (không xoá PIN đã lưu)
    initialized = false;
    enablePinFlow = false;
    softResetToSetup();
		flushKeypad(120);
    return;
  }

	if (key == '*') {
		bool success = checkPassword();  // Gọi và lưu kết quả

		if (success) {
			// Đúng pass → mở cửa → kết thúc flow, chờ auto lock
			initialized = false;
			enablePinFlow = false;
		} else {
			// Sai → reset để cho nhập lại
			inputString = "";
			lcdShowEnterPassword();
		}
	} else if (key == '#') {
		inputString = "";
		lcdShowEnterPassword();
	} else if (key >= '0' && key <= '9') {   // <-- CHỈ NHẬN CHỮ SỐ
    inputString += key;
    lcdShowMessage("Input:", inputString);
  } else {
    // Bỏ qua các phím khác (A/D...) để không bị append linh tinh
  }
}

void handleWebFlow() {
	static bool waitingShown = false;
	
	// Bước 1: Hiển thị thông báo chờ web gửi lệnh (chỉ 1 lần)
	if (!waitingShown) {
		lcdShowMessage("Waiting for Web", "Web open...");
		waitingShown = true;
	}

	char key = keypad.getKey();
  if (key == 'B') {
    // Thoát về menu
    waitingShown = false;
    enableWebFlow = false;    // <-- đúng flow
    lcdShowUnlockOptions();
    flushKeypad(120);
    return;
  }
  if (key == 'C') {
    // Reset mềm
    waitingShown = false;
    enableWebFlow = false;    // <-- đúng flow
    softResetToSetup();
    flushKeypad(120);
    return;
  }

	// Bước 2: Nếu chưa nhận yêu cầu mở cửa từ Web → chờ tiếp
	if (!webUnlockRequested) return;

	// Bước 3: Thực hiện mở cửa
	lcdShowWelcome();
	unlockDoor();
	publishOpen();
	Serial.println("[WEB] Đã mở cửa thành công.");

	// Bước 4: Reset trạng thái Web Flow
	waitingShown = false;
	webUnlockRequested = false;
	enableWebFlow = false;
}


void handleFaceFlow() {
	// Khởi tạo lần đầu khi vào flow
	if (!faceFlowInit) {
		lcdShowMessage("FACE ID MODE", "Show your face");
		faceVerified = false;
		faceUserId = "";
		faceDistance = 1.0f;
		faceStartTime = millis();
		faceFlowInit = true;

		// Tuỳ chọn: phát tín hiệu yêu cầu phía camera/server bắt đầu xử lý
		// - Nếu bạn có ESP32-CAM subscribe topic này để chụp ảnh mới:
		// client.publish("smartlock/face/request", "start", true);

		// - Hoặc server subscribe topic này để chạy script DeepFace rồi publish smartlock/verify
		// (chọn 1 luồng phù hợp với hệ thống của bạn)
	}

	// 3) Bắt phím điều hướng tại chỗ, để thoát ngay
  char k = keypad.getKey();
  if (k == 'B') {
    faceFlowInit = false;
    enableFaceFlow = false;
    lcdShowUnlockOptions();
    flushKeypad(120);
    return;
  }
  if (k == 'C') {
    faceFlowInit = false;
    enableFaceFlow = false;
    softResetToSetup();
    flushKeypad(120);
    return;
  }

	// Đợi kết quả từ server qua MQTT (callback sẽ set faceVerified)
	if (faceVerified) {
		// Nếu bật 2FA thì unlockDoor() sẽ tự gọi check2FASecurity()
		unlockDoor();
		publishOpen();
		Serial.println("[FACE] Door opened by FaceID");

		// reset & thoát flow
		faceFlowInit = false;
		enableFaceFlow = false;
		return;
	}

	// Timeout
	if (millis() - faceStartTime > FACE_TIMEOUT_MS) {
		lcdShowMessage("Face Timeout", "Try again");
		Serial.println("[FACE] Timeout waiting verification");
		delay(1500);
		faceFlowInit = false;
		enableFaceFlow = false;
	}
}

void handleManualPassChangeFlow() {
  // Timeout không thao tác
  if (millis() - passChangeLastKeyTs > PASS_CHANGE_TIMEOUT_MS) {
    lcdShowMessage("Change PIN", "Timeout");
    delay(1200);
    // reset và thoát
    passChangeState = ENTER_OLD;
    passBuf = "";
    newPinCandidate = "";
    enablePassChangeFlow = false;
    return;
  }

  char key = keypad.getKey();
  if (!key) return;
  passChangeLastKeyTs = millis();

	// ===== ƯU TIÊN PHÍM ĐIỀU HƯỚNG =====
  if (key == 'B') {
    // Về menu, huỷ flow
    passChangeState = ENTER_OLD;
    passBuf = "";
    newPinCandidate = "";
    enablePassChangeFlow = false;
    lcdShowUnlockOptions();
		flushKeypad(120);
    return;
  }
  if (key == 'C') {
    // Reset mềm, huỷ flow và mở lại setup
    passChangeState = ENTER_OLD;
    passBuf = "";
    newPinCandidate = "";
    enablePassChangeFlow = false;
    softResetToSetup();
		flushKeypad(120);
    return;
  }

	// ===== XỬ LÝ NHẬP LIỆU =====
  if (key == '#') {
    passBuf = "";
    lcdShowMessage("Cleared", "");
    delay(400);
  } else if (key >= '0' && key <= '9') {
    if (passBuf.length() < 8) {
      passBuf += key;
      switch (passChangeState) {
        case ENTER_OLD:   lcdShowMessage("Old PIN:", passBuf); break;
        case ENTER_NEW:   lcdShowMessage("New PIN:", passBuf); break;
        case CONFIRM_NEW: lcdShowMessage("Confirm:", passBuf); break;
      }
    }
  } else if (key == '*') {
    // Xác nhận theo state
    if (passChangeState == ENTER_OLD) {
      if (passBuf == currentLockPassword) {
        passChangeState = ENTER_NEW;
        passBuf = "";
        lcdShowMessage("Enter New PIN", "(4-8 digits)");
      } else {
        lcdShowMessage("Wrong Old PIN", "Try again");
        passBuf = "";
        delay(1000);
        lcdShowMessage("Enter Old PIN", "");
      }
    } else if (passChangeState == ENTER_NEW) {
      if (passBuf.length() >= 4 && passBuf.length() <= 8) {
        newPinCandidate = passBuf;
        passChangeState = CONFIRM_NEW;
        passBuf = "";
        lcdShowMessage("Confirm New PIN", "");
      } else {
        lcdShowMessage("PIN 4-8 digits", "Try again");
        passBuf = "";
        delay(1000);
        lcdShowMessage("Enter New PIN", "");
      }
    } else if (passChangeState == CONFIRM_NEW) {
      if (passBuf == newPinCandidate) {
        currentLockPassword = newPinCandidate;
        prefs.putString("pin", currentLockPassword);  // lưu NVS
        lcdShowMessage("PIN Updated", "Publishing...");
        // Publish retained để web hứng (nếu đang kết nối)
        if (client.connected()) {
          client.publish("door/password_sync", currentLockPassword.c_str(), true);
        }
        delay(1200);
        // reset & thoát
        passChangeState = ENTER_OLD;
        passBuf = "";
        newPinCandidate = "";
        enablePassChangeFlow = false;
        lcdShowUnlockOptions();
      } else {
        lcdShowMessage("Not Match", "Re-enter new");
        passBuf = "";
        newPinCandidate = "";
        passChangeState = ENTER_NEW;
        delay(1000);
        lcdShowMessage("Enter New PIN", "");
      }
    }
  }
}

void softResetToSetup() {
    // Huỷ toàn bộ flow đang chạy
    enablePinFlow = false;
    enableWebFlow = false;
    enableFaceFlow = false;
    enablePassChangeFlow = false;
    auto_lock_var = false;

    // Tuỳ chọn: khoá cửa về trạng thái an toàn
    lockDoor();

    // Không xoá NVS, chỉ mở lại flow setup
    lcdShowMessage("RESET MODE", "Setup PIN");
    delay(800);

    // Chạy lại flow setup như lần đầu (chỉ ghi khi người dùng xác nhận *)
    setupPassword();

    // Quay về menu
    lcdShowUnlockOptions();
}


// Giữ trạng thái "không có phím nhấn" liên tục trong stable_ms
void flushKeypad(uint16_t stable_ms) {
  unsigned long t0 = millis();
  while (millis() - t0 < stable_ms) {
    if (keypad.getKey()) t0 = millis();  // nếu còn phím, gia hạn thời gian
    delay(5);
  }
}
