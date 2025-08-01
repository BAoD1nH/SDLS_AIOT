//----------------------------------------------------  LIBRARIES ----------------------------------------------------//
#include <ESP32Servo.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>

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
const char* mqttServer = "192.168.1.7";
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
	lcdShowMessage("Welcome", "Smart Door Lock");
	delay(1500);

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

	// ✅ Nếu đủ điều kiện auto-lock → gọi luôn
	if (auto_lock_var && (millis() - lastUnlockTime >= 10000)) {
		autoLockOn();  // Hàm này tự delay 2s rồi mới kết thúc
	}

	// ✅ Sau khi auto lock hoặc không còn flow nào đang chạy
	if (!enablePinFlow && !enableWebFlow && !enableFaceFlow && !auto_lock_var) {
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
			// client.subscribe("door/password_check");
			client.subscribe("door/otp");    // ✅ Nhận OTP từ web
			client.subscribe("door/2fa");    // ✅ Nhận tín hiệu bật/tắt 2FA
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
			Serial.print("[WEB] Đã cập nhật mật khẩu mới từ website: ");
			Serial.println(currentLockPassword);
			lcdShowMessage("Password Updated", "From Website");
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
	// ✅ Nếu bật 2FA thì kiểm tra OTP trước
	if (enable2FA) {
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

  Serial.println("[SETUP] Please input new password and press * to confirm.");

  while (true) {
    char key = keypad.getKey();
    if (key) {
      if (key == '*') {  // Xác nhận
        if (inputString.length() > 0) {
          currentLockPassword = inputString;
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
		} else {
			lcdShowMessage("Locked Out!", "");
			publishWarning();
			triggerAlarm();
			failedAttempts = 0;
		}
		delay(2000);
		inputString = "";
		return false;  // <-- Sai mật khẩu
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
	if (!otpReceived) {
		Serial.println("[2FA] Chưa nhận được OTP từ web!");
		lcdShowMessage("Waiting for OTP", "From Website...");
		delay(2000);
		return false;
	}

	String userInputOTP = "";
	unsigned long startTime = millis();

	lcd.clear();
	lcd.setCursor(0, 0);
	lcd.print("Enter OTP:");

	while (millis() - startTime < 30000) {
		char key = keypad.getKey();

		if (key) {
			if (key == '*') {
				if (userInputOTP == otpFromWeb) {
					Serial.println("[2FA] OTP correct!");
					otpReceived = false;  // ✅ Reset flag
					return true;
				} else {
					Serial.println("[2FA] OTP incorrect!");
					otpReceived = false;  // ✅ Reset flag
					return false;
				}
			} else if (key == '#') {
				userInputOTP = "";
				lcdShowMessage("OTP Cleared", "");
				delay(500);
				lcd.clear();
				lcd.print("Enter OTP:");
			} else {
				userInputOTP += key;
				lcdShowMessage("OTP:", userInputOTP);
			}
		}
	}

	Serial.println("[2FA] Timeout waiting for OTP.");
	otpReceived = false;  // ✅ Reset flag dù timeout
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
	lcdShowMessage("UNLOCK OPTION", "1PIN 2WEB 3FACE");
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
	if (key) {
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
		} else {
			inputString += key;
			lcdShowMessage("Input:", inputString);
		}
	}
}

void handleWebFlow() {
	static bool waitingShown = false;

	// Bước 1: Hiển thị thông báo chờ web gửi lệnh (chỉ 1 lần)
	if (!waitingShown) {
		lcdShowMessage("Waiting for Web", "Web open...");
		waitingShown = true;
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


void handleFaceFlow() {}
