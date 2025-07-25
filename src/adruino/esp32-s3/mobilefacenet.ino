#include <ESP32Servo.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>

// Function prototypes
void reconnectMQTT();
void callback(char* topic, byte* payload, unsigned int length);
void controlServo(bool lock);

// Keypad setup
#define ROW_NUM 4
#define COLUMN_NUM 4
char keys[ROW_NUM][COLUMN_NUM] = {
    {'1', '2', '3', 'A'},
    {'4', '5', '6', 'B'},
    {'7', '8', '9', 'C'},
    {'*', '0', '#', 'D'}
};
byte pin_rows[ROW_NUM] = {42, 41, 40, 39};
byte pin_column[COLUMN_NUM] = {38, 37, 36, 35};
Keypad keypad = Keypad(makeKeymap(keys), pin_rows, pin_column, ROW_NUM, COLUMN_NUM);

// Servo setup
Servo myServo1;
const int servoPin = 17;

// LCD setup
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Wi-Fi and MQTT setup
const char* ssid = "NCD tret";
const char* password = "nguyencongdanh";
const char* mqttServer = "192.168.1.102";
const int mqttPort = 1883;
const char* mqttUser = "";
const char* mqttPassword = "";
const char* clientId = "AbtqLqY5Rcc43dBatoYJHflsAUg1";

WiFiClient espClient;
PubSubClient client(espClient);

String inputString = "";
String currentLockPassword = "1234"; // Default password
int failedAttempts = 0;
const int maxFailedAttempts = 3;

void setup() {
    Serial.begin(115200);
    myServo1.attach(servoPin);
    Wire.begin(48, 47);
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enter Password:");

    // Connect to Wi-Fi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());

    // Setup MQTT
    client.setServer(mqttServer, mqttPort);
    client.setCallback(callback);
}

void loop() {
    if (!client.connected()) {
        reconnectMQTT();
    }
    client.loop();

    // Check keypad input
    char key = keypad.getKey();
    if (key) {
        if (key == '*') {
            lcd.clear();
            if (inputString == currentLockPassword) {
                controlServo(false); // Unlock
                lcd.setCursor(0, 0);
                lcd.print("Welcome!!");
                client.publish(clientId, ("Welcome: " + inputString).c_str());
                failedAttempts = 0;
            } else {
                failedAttempts++;
                lcd.setCursor(0, 0);
                lcd.print("Try Again :((");
                client.publish(clientId, ("Failed: " + inputString).c_str());
                if (failedAttempts >= maxFailedAttempts) {
                    client.publish(clientId, "Warning: Suspicious activity detected");
                    lcd.setCursor(0, 1);
                    lcd.print("Locked Out!");
                    delay(5000); // Lockout for 5 seconds
                }
            }
            inputString = "";
            delay(2000);
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Enter Password:");
        } else {
            inputString += key;
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Input: ");
            lcd.print(inputString);
        }
    }
}

void reconnectMQTT() {
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        if (client.connect(clientId, mqttUser, mqttPassword)) {
            Serial.println("connected");
            client.subscribe(clientId);
            client.subscribe("door/control");
            client.subscribe("door/password");
            client.subscribe("door/password_check");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}

void callback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    Serial.println("Message arrived [" + String(topic) + "]: " + message);

    if (String(topic) == "door/control") {
        if (message == "toggle") {
            controlServo(!myServo1.read()); // Toggle lock state
            client.publish(clientId, ("Door " + String(myServo1.read() ? "locked" : "unlocked")).c_str());
        }
    } else if (String(topic) == "door/password") {
        // Parse JSON message for password change
        // Expected format: {"old":"oldPass","confirm":"confirmOld","new":"newPass"}
        // For simplicity, assume message is the new password directly
        if (message.startsWith("{")) {
            // Parse JSON (requires ArduinoJSON library)
            // For now, assume message is just the new password
            currentLockPassword = message;
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Password Updated");
            client.publish(clientId, "Password changed successfully");
            delay(2000);
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Enter Password:");
        }
    } else if (String(topic) == "door/password_check") {
        if (message == currentLockPassword) {
            controlServo(false);
            client.publish(clientId, "Welcome: Door opened via web");
            failedAttempts = 0;
        } else {
            failedAttempts++;
            client.publish(clientId, "Failed: Invalid web password");
            if (failedAttempts >= maxFailedAttempts) {
                client.publish(clientId, "Warning: Suspicious activity detected");
                lcd.setCursor(0, 1);
                lcd.print("Locked Out!");
                delay(5000);
                lcd.clear();
                lcd.setCursor(0, 0);
                lcd.print("Enter Password:");
            }
        }
    }
}

void controlServo(bool lock) {
    if (lock) {
        myServo1.write(0); // Lock position
    } else {
        myServo1.write(90); // Unlock position
    }
}