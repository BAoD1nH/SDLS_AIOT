from deepface import DeepFace
from pathlib import Path
import json
import time
import paho.mqtt.client as mqtt

# ========= MQTT CONFIG =========
MQTT_BROKER = "10.124.8.57"  # broker của bạn
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

# Nơi lưu kết quả xác thực
results_dir = Path("./verification_results")       
results_dir.mkdir(parents=True, exist_ok=True)

# Threshold mặc định cho Facenet512
threshold = 0.3

if not probe_path.exists():
	print(f"[ERROR] Probe image not found: {probe_path}")
	exit(1)

if not gallery_root.exists():
	print(f"[ERROR] Gallery folder not found: {gallery_root}")
	exit(1)

authenticated = False
match_payload = None  # sẽ giữ payload khi match thành công

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
				match_payload = payload
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

def _build_index_json():
	"""
	Tạo/ghi verification_results/index.json: mảng tên file JSON (mới→cũ).
	Bỏ qua index.json và latest.json.
	"""
	files = []
	for p in results_dir.glob("*.json"):
		name = p.name
		if name in ("index.json", "latest.json"):
			continue
		try:
			mtime = p.stat().st_mtime
		except Exception:
			mtime = 0.0
		files.append((mtime, name))

	# sort theo mtime giảm dần
	files.sort(key=lambda x: x[0], reverse=True)
	names = [name for _, name in files]

	index_path = results_dir / "index.json"
	index_path.write_text(json.dumps(names, ensure_ascii=False, indent=2), encoding="utf-8")


def write_result_json(payload: dict, suffix: str = ""):
	"""
	Ghi payload ra file JSON: verification_results/<epoch><_suffix>.json
	Đồng thời cập nhật:
	- verification_results/latest.json
	- verification_results/index.json (danh sách file mới → cũ)
	"""
	ts = payload.get("ts", int(time.time()))
	name = f"{ts}{suffix}.json"
	out_file = results_dir / name

	# Ghi file riêng lẻ
	out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

	# Ghi latest.json
	latest_file = results_dir / "latest.json"
	latest_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

	# Cập nhật index.json
	_build_index_json()

	print(f"[WRITE] Saved result -> {out_file}")


# ====== Ghi kết quả ======
if authenticated and match_payload:
    # Lưu file kết quả thành công
    write_result_json(match_payload, suffix="_success")

else:
    # Không match với bất kỳ ảnh nào -> ghi kết quả fail tổng thể
    fail_payload = {
        "status": "fail",
        "user_id": None,
        "image": None,
        "distance": None,
        "threshold": threshold,
        "ts": int(time.time())
    }
    print("[RESULT] No match found. Writing fail record.")
    write_result_json(fail_payload, suffix="_fail")

client.loop_stop()
client.disconnect()
