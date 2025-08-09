# server.py
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pathlib import Path
from json import dumps, loads
from PIL import Image
import os, time, mimetypes
from pathlib import Path
import subprocess, sys

# Đường dẫn thư mục dự án & script
BASE_DIR = Path(__file__).parent.resolve()
FACE_SCRIPT = BASE_DIR / "face_recognition.py"

app = Flask(__name__)
CORS(app)  # Dev: mở CORS cho frontend (localhost/127.0.0.1)

# Giới hạn kích thước upload (10MB)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# ====== 1) ESP32-CAM: GIỮ NGUYÊN ENDPOINT nhưng lưu vào upload-esp32 ======
UPLOAD_ESP32_DIR = Path(__file__).parent / "upload-esp32"
UPLOAD_ESP32_DIR.mkdir(parents=True, exist_ok=True)

RESULTS_DIR = Path(__file__).parent / "verification_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

@app.route("/run-face-recognition", methods=["POST"])
def run_face_recognition():
	"""
	Chạy face_recognition.py đồng bộ và trả stdout/stderr về cho frontend.
	Yêu cầu: file upload-esp32/frame.jpg đã tồn tại (được ESP32 upload).
	"""
	# Kiểm tra file probe có sẵn chưa (tránh chạy vô ích)
	probe = BASE_DIR / "upload-esp32" / "frame.jpg"
	if not probe.exists():
		return jsonify({
			"success": False,
			"error": "Missing probe image: upload-esp32/frame.jpg"
		}), 409

	if not FACE_SCRIPT.exists():
		return jsonify({"success": False, "error": f"Not found: {FACE_SCRIPT.name}"}), 500

	try:
		# Dùng đúng executable hiện tại (python/python3) và set cwd để script tìm đúng thư mục
		proc = subprocess.run(
			[sys.executable, str(FACE_SCRIPT)],
			cwd=str(BASE_DIR),
			capture_output=True,
			text=True,
			timeout=120  # điều chỉnh nếu cần
		)
		ok = (proc.returncode == 0)
		return jsonify({
			"success": ok,
			"returncode": proc.returncode,
			"stdout": proc.stdout,
			"stderr": proc.stderr
		}), (200 if ok else 500)
	except subprocess.TimeoutExpired:
		return jsonify({"success": False, "error": "Timeout running face_recognition.py"}), 504
	except Exception as e:
		return jsonify({"success": False, "error": str(e)}), 500

@app.route("/verification_results/<path:subpath>")
def serve_verification_results(subpath):
    base = RESULTS_DIR.resolve()
    full = (base / subpath).resolve()
    if not str(full).startswith(str(base)):
        abort(403)
    if not full.exists():
        abort(404)
    return send_from_directory(base, subpath, mimetype="application/json")

@app.route("/upload", methods=["POST"])
def upload_frame():
    """
    ESP32-CAM post: form-data { meta, file }
    Lưu file thành upload-esp32/frame.jpg
    """
    if "file" not in request.files:
        return "missing file", 400
    f = request.files["file"]

    save_path = UPLOAD_ESP32_DIR / "frame.jpg"
    f.save(save_path)

    meta = request.form.get("meta")
    print(f"Meta: {meta}, Saved {save_path}")
    return "ok", 200

# ====== 2) Web upload ảnh theo userId vào local ======
# CHÚ Ý: đổi gốc lưu về 'upload' (không phải 'uploads/faces')
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ROOT = Path(__file__).parent.resolve()
UPLOAD_ROOT = ROOT / "upload"  # <- đổi sang 'upload'
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

def allowed_ext(filename: str) -> bool:
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXTS

def abs_url(rel_path: str) -> str:
    base = request.host_url.rstrip("/")  # vd: http://localhost:8000
    rel = rel_path if rel_path.startswith("/") else "/" + rel_path
    return f"{base}{rel}"

def _next_index(user_dir: Path) -> int:
    """
    Tìm chỉ số tiếp theo dựa theo các file có tên dạng số (1.jpg, 2.jpg,...)
    """
    max_idx = 0
    if user_dir.exists():
        for p in user_dir.iterdir():
            if p.is_file():
                stem = p.stem
                if stem.isdigit():
                    try:
                        max_idx = max(max_idx, int(stem))
                    except:
                        pass
    return max_idx + 1

@app.route("/upload-face", methods=["POST"])
def upload_face():
    """
    form-data:
      - userId (bắt buộc)
      - userName (tùy chọn)
      - faceImage (bắt buộc)

    Lưu: upload/<userId>/<n>.jpg  (n = 1,2,3,...)
    Đồng thời cập nhật _meta.json để lưu userName và updatedAt.
    """
    user_id = (request.form.get("userId") or "").strip()
    user_name = (request.form.get("userName") or "").strip()
    file = request.files.get("faceImage")

    if not user_id or not file:
        return jsonify({"message": "Thiếu userId hoặc file"}), 400
    if not allowed_ext(file.filename):
        return jsonify({"message": "Định dạng ảnh không hỗ trợ"}), 400

    safe_uid = secure_filename(user_id) or "unknown"
    user_dir = UPLOAD_ROOT / safe_uid
    user_dir.mkdir(parents=True, exist_ok=True)

    # Tính chỉ số tiếp theo và đặt tên file n.jpg
    next_idx = _next_index(user_dir)
    filename = f"{next_idx}.jpg"  # luôn .jpg
    save_path = user_dir / filename

    # Đọc ảnh, convert sang JPEG
    try:
        img = Image.open(file.stream).convert("RGB")
        img.save(save_path, format="JPEG", quality=95, optimize=True)
    except Exception as e:
        return jsonify({"message": f"Lỗi xử lý ảnh: {e}"}), 400

    ts = int(time.time() * 1000)

    # Cập nhật metadata userName vào _meta.json
    meta_path = user_dir / "_meta.json"
    meta = {"userId": safe_uid, "userName": user_name, "updatedAt": ts}
    if meta_path.exists():
        try:
            old = loads(meta_path.read_text(encoding="utf-8"))
            # Nếu request không gửi userName mới, giữ tên cũ
            if not user_name and isinstance(old, dict) and old.get("userName"):
                meta["userName"] = old["userName"]
        except Exception:
            pass
    meta_path.write_text(dumps(meta, ensure_ascii=False), encoding="utf-8")

    rel_path = f"/upload/{safe_uid}/{filename}"
    return jsonify({
        "message": "Upload thành công",
        "file_path": rel_path,
        "file_url": abs_url(rel_path),
        "userId": safe_uid,
        "userName": meta["userName"],
        "index": next_idx,
        "timestamp": ts
    }), 200

# ====== 3) Phục vụ ảnh đã lưu ======
# Đổi route phục vụ ảnh sang '/upload/...'
@app.route("/upload/<path:subpath>")
def serve_uploaded(subpath):
    base = UPLOAD_ROOT.resolve()
    full = (base / subpath).resolve()
    if not str(full).startswith(str(base)):  # tránh path traversal
        abort(403)
    if not full.exists():
        abort(404)
    mime, _ = mimetypes.guess_type(str(full))
    return send_from_directory(base, subpath, mimetype=mime or "application/octet-stream")

# ====== 4) API danh sách user & ảnh ======
@app.route("/api/users", methods=["GET"])
def list_users():
    """
    Trả danh sách user theo filesystem:
    [{ userId, userName, latest_index, timestamp }, ...]
    userName đọc từ _meta.json
    latest_index = chỉ số ảnh lớn nhất (nếu có)
    """
    result = []
    if not UPLOAD_ROOT.exists():
        return jsonify(result), 200

    for user_dir in UPLOAD_ROOT.iterdir():
        if not user_dir.is_dir():
            continue

        # tìm index lớn nhất
        latest_idx = 0
        latest_mtime = 0.0
        for p in user_dir.iterdir():
            if p.is_file() and p.name != "_meta.json":
                stem = p.stem
                if stem.isdigit():
                    try:
                        idx = int(stem)
                        latest_idx = max(latest_idx, idx)
                        latest_mtime = max(latest_mtime, p.stat().st_mtime)
                    except:
                        pass

        # đọc userName từ _meta.json nếu có
        user_name = ""
        meta_path = user_dir / "_meta.json"
        if meta_path.exists():
            try:
                data = loads(meta_path.read_text(encoding="utf-8"))
                user_name = data.get("userName", "") or ""
            except Exception:
                pass

        result.append({
            "userId": user_dir.name,
            "userName": user_name,
            "latest_index": latest_idx or None,
            "timestamp": int(latest_mtime * 1000) if latest_mtime else None
        })

    # sort theo thời gian sửa đổi mới nhất
    result.sort(key=lambda x: x["timestamp"] or 0, reverse=True)
    return jsonify(result), 200

@app.route("/api/users/<user_id>/images", methods=["GET"])
def list_user_images(user_id: str):
    """
    Liệt kê ảnh của 1 user:
    [{ file_name, file_path, file_url, index, timestamp }, ...]
    """
    safe_uid = secure_filename(user_id)
    user_dir = UPLOAD_ROOT / safe_uid
    images = []
    if user_dir.exists() and user_dir.is_dir():
        # sắp xếp theo index giảm dần
        files = []
        for p in user_dir.iterdir():
            if p.is_file() and p.name != "_meta.json" and p.stem.isdigit():
                files.append(p)
        files.sort(key=lambda x: int(x.stem), reverse=True)

        for p in files:
            try:
                idx = int(p.stem)
            except:
                idx = None
            rel_path = f"/upload/{safe_uid}/{p.name}"
            ts = int(p.stat().st_mtime * 1000)
            images.append({
                "file_name": p.name,
                "file_path": rel_path,
                "file_url": abs_url(rel_path),
                "index": idx,
                "timestamp": ts
            })
    return jsonify(images), 200

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/api/auth-logs", methods=["GET"])
def list_auth_logs():
    out = []
    for p in RESULTS_DIR.glob("*.json"):
        try:
            data = loads(p.read_text(encoding="utf-8"))
            # fallback nếu thiếu ts: dùng mtime
            data["ts"] = int(data.get("ts", p.stat().st_mtime))
            out.append(data)
        except Exception:
            pass
    out.sort(key=lambda x: x.get("ts", 0), reverse=True)
    return jsonify(out), 200

@app.route("/upload-esp32/<path:subpath>")
def serve_esp32(subpath):
    base = UPLOAD_ESP32_DIR.resolve()
    full = (base / subpath).resolve()
    if not str(full).startswith(str(base)):
        abort(403)
    if not full.exists():
        abort(404)
    mime, _ = mimetypes.guess_type(str(full))
    return send_from_directory(base, subpath, mimetype=mime or "application/octet-stream")


if __name__ == "__main__":
    # Chạy: pip install flask flask-cors pillow
    app.run(host="0.0.0.0", port=8000, debug=True)
