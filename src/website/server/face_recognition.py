from deepface import DeepFace
from pathlib import Path

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

for user_dir in gallery_root.iterdir():
	if not user_dir.is_dir():
		continue  # bỏ qua file lẻ trong upload/
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
				enforce_detection=False  # tránh lỗi khi không detect được mặt
			)
			distance = result["distance"]
			verified = result["verified"]

			status = "Authentication successfully" if verified and distance <= threshold else "Authentication failed"
			print(f"User {user_id} / {img_path.name}: {status} (distance: {distance:.4f})")

		except Exception as e:
			print(f"User {user_id} / {img_path.name}: ERROR - {e}")
