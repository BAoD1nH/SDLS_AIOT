from deepface import DeepFace
from pathlib import Path
import json
import time
import paho.mqtt.client as mqtt

# ========= MQTT CONFIG =========
MQTT_BROKER = "192.168.1.6"  # broker của bạn
MQTT_PORT = 1883
MQTT_TOPIC = "smartlock/verify"  # ESP32-S3 sẽ subscribe
MQTT_CLIENT_ID = "server-face-recog"

client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
client.connect(MQTT_BROKER, MQTT_PORT, keepalive=30)
client.loop_start()
# ===============================

# Ảnh probe từ ESP32-CAM
probe_path = Path("./upload-esp32/frame.jpg")

# Thư mục gốc chứa các user
gallery_root = Path("./upload")

# Threshold mặc định cho Facenet512
threshold = 0.3

if not probe_path.exists():
	print(f"[ERROR] Probe image not found: {probe_path}")
	exit(1)

if not gallery_root.exists():
	print(f"[ERROR] Gallery folder not found: {gallery_root}")
	exit(1)

authenticated = False

for user_dir in gallery_root.iterdir():
	if not user_dir.is_dir():
		continue
	user_id = user_dir.name

	for img_path in user_dir.iterdir():
		if not img_path.is_file():
			continue
		if img_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
			continue

		try:
			result = DeepFace.verify(
				img1_path=str(probe_path),
				img2_path=str(img_path),
				model_name="Facenet512",
				enforce_detection=False
			)
			distance = result["distance"]
			verified = result["verified"]

			if verified and distance <= threshold:
				status = "Authentication successfully"
				print(f"User {user_id} / {img_path.name}: {status} (distance: {distance:.4f})")

				# ======= PUBLISH MQTT NGAY LẬP TỨC =======
				payload = {
					"status": "ok",
					"user_id": user_id,
					"image": img_path.name,
					"distance": float(distance),
					"threshold": threshold,
					"ts": int(time.time())
				}
				client.publish(MQTT_TOPIC, json.dumps(payload), qos=1, retain=False)
				# =========================================

				authenticated = True
				break
			else:
				status = "Authentication failed"
				print(f"User {user_id} / {img_path.name}: {status} (distance: {distance:.4f})")

		except Exception as e:
			print(f"User {user_id} / {img_path.name}: ERROR - {e}")

	if authenticated:
		break

# Tuỳ chọn: nếu muốn báo thất bại tổng thể
if not authenticated:
	fail_payload = {
		"status": "fail",
		"user_id": None,
		"distance": None,
		"threshold": threshold,
		"ts": int(time.time())
	}
	client.publish(MQTT_TOPIC, json.dumps(fail_payload), qos=0, retain=False)

client.loop_stop()
client.disconnect()
