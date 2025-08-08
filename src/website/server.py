# server.py
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pathlib import Path
from json import dumps, loads
import os, time, mimetypes

app = Flask(__name__)
CORS(app)  # Dev: mở CORS cho frontend (localhost/127.0.0.1)

# Giới hạn kích thước upload (10MB)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# ====== 1) ESP32-CAM: GIỮ NGUYÊN ENDPOINT ======
@app.route("/upload", methods=["POST"])
def upload_frame():
    """
    ESP32-CAM post: form-data { meta, file }
    Lưu file thành frame.jpg tại thư mục gốc dự án
    """
    if "file" not in request.files:
        return "missing file", 400
    f = request.files["file"]
    f.save("frame.jpg")
    meta = request.form.get("meta")
    print("Meta:", meta, "Saved frame.jpg")
    return "ok", 200


# ====== 2) Web upload ảnh theo userId vào local ======
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ROOT = Path(__file__).parent.resolve()
UPLOAD_ROOT = ROOT / "uploads" / "faces"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

def allowed_ext(filename: str) -> bool:
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXTS

def abs_url(rel_path: str) -> str:
    base = request.host_url.rstrip("/")  # vd: http://localhost:8000
    rel = rel_path if rel_path.startswith("/") else "/" + rel_path
    return f"{base}{rel}"

@app.route("/upload-face", methods=["POST"])
def upload_face():
    """
    form-data:
      - userId (bắt buộc)
      - userName (tùy chọn)
      - faceImage (bắt buộc)
    Lưu: uploads/faces/<userId>/<timestamp>.<ext>
    Đồng thời cập nhật _meta.json để lưu userName.
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

    ts = int(time.time() * 1000)
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{ts}{ext}"
    save_path = user_dir / filename
    file.save(save_path)

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

    rel_path = f"/uploads/faces/{safe_uid}/{filename}"
    return jsonify({
        "message": "Upload thành công",
        "file_path": rel_path,
        "file_url": abs_url(rel_path),
        "userId": safe_uid,
        "userName": meta["userName"],
        "timestamp": ts
    }), 200


# ====== 3) Phục vụ ảnh đã lưu ======
@app.route("/uploads/faces/<path:subpath>")
def serve_uploaded(subpath):
    base = UPLOAD_ROOT.resolve()
    full = (base / subpath).resolve()
    if not str(full).startswith(str(base)):  # tránh path traversal
        abort(403)
    mime, _ = mimetypes.guess_type(str(full))
    return send_from_directory(base, subpath, mimetype=mime or "application/octet-stream")


# ====== 4) API danh sách user & ảnh ======
@app.route("/api/users", methods=["GET"])
def list_users():
    """
    Trả danh sách user theo filesystem:
    [{ userId, userName, timestamp: <latest_ts> }, ...]
    userName đọc từ _meta.json
    """
    result = []
    if not UPLOAD_ROOT.exists():
        return jsonify(result), 200

    for user_dir in UPLOAD_ROOT.iterdir():
        if not user_dir.is_dir():
            continue

        # timestamp mới nhất từ tên file (bỏ qua _meta.json)
        latest_ts = 0
        for p in user_dir.iterdir():
            if p.is_file() and p.name != "_meta.json":
                try:
                    ts = int(Path(p).stem)
                    latest_ts = max(latest_ts, ts)
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
            "timestamp": latest_ts or None
        })

    result.sort(key=lambda x: x["timestamp"] or 0, reverse=True)
    return jsonify(result), 200


@app.route("/api/users/<user_id>/images", methods=["GET"])
def list_user_images(user_id: str):
    """
    Liệt kê ảnh của 1 user:
    [{ file_name, file_path, file_url, timestamp }, ...]
    """
    safe_uid = secure_filename(user_id)
    user_dir = UPLOAD_ROOT / safe_uid
    images = []
    if user_dir.exists() and user_dir.is_dir():
        for p in sorted(user_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if not p.is_file() or p.name == "_meta.json":
                continue
            ts = None
            try:
                ts = int(p.stem)
            except:
                pass
            rel_path = f"/uploads/faces/{safe_uid}/{p.name}"
            images.append({
                "file_name": p.name,
                "file_path": rel_path,
                "file_url": abs_url(rel_path),
                "timestamp": ts
            })
    return jsonify(images), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    # Chạy: pip install flask flask-cors
    app.run(host="0.0.0.0", port=8000, debug=True)
