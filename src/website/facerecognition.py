#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys, argparse, tempfile, shutil, numpy as np, cv2
import firebase_admin
from firebase_admin import credentials, storage
from insightface.app import FaceAnalysis

# ---------------------------------------
# Config gợi ý: đổi theo môi trường của bạn
# ---------------------------------------
DEFAULT_THRESH = 0.40

def init_firebase(cred_json: str, bucket_name: str):
	"""
	Khởi tạo Firebase Admin + bucket Storage
	"""
	if not firebase_admin._apps:
		cred = credentials.Certificate(cred_json)
		firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
	bkt = storage.bucket()
	return bkt

def init_face_app(det_size=(640, 640)):
	"""
	Khởi tạo InsightFace (CPU)
	"""
	app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
	app.prepare(ctx_id=0, det_size=det_size)
	return app

def get_face_embedding(app: FaceAnalysis, img_bgr: np.ndarray):
	"""
	Phát hiện và lấy embedding của mặt lớn nhất trong ảnh.
	Trả về vector đã L2-normalized (float32) hoặc None nếu không thấy mặt.
	"""
	faces = app.get(img_bgr)
	if len(faces) == 0:
		return None
	# lấy mặt có bbox lớn nhất
	faces.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
	emb = faces[0].normed_embedding  # đã normalized
	return emb.astype(np.float32)

def list_user_images(bucket, user_id: str):
	"""
	Liệt kê blob path cho đúng user_id (KHÔNG tải toàn bộ DB).
	Giả định ảnh nằm dưới faces/<user_id>/...
	"""
	prefix = f"faces/{user_id}/"
	blobs = bucket.list_blobs(prefix=prefix)
	paths = []
	for b in blobs:
		# bỏ "thư mục" ảo
		if b.name.endswith("/") or len(os.path.basename(b.name)) == 0:
			continue
		# lọc extension ảnh cơ bản
		name_lower = b.name.lower()
		if any(name_lower.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]):
			paths.append(b.name)
	return paths

def download_blob_to_tmp(bucket, blob_name: str, tmp_dir: str):
	"""
	Tải 1 blob về thư mục tạm, trả về local path
	"""
	local_path = os.path.join(tmp_dir, os.path.basename(blob_name))
	blob = bucket.blob(blob_name)
	blob.download_to_filename(local_path)
	return local_path

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
	"""
	Cosine similarity cho 2 vector đã/hoặc chưa normalized.
	"""
	a = a.astype(np.float32)
	b = b.astype(np.float32)
	na = np.linalg.norm(a)
	nb = np.linalg.norm(b)
	if na == 0 or nb == 0:
		return 0.0
	return float(np.dot(a, b) / (na * nb))

def recognize_user_with_frame(frame_path: str, user_id: str, cred_json: str, bucket_name: str, thresh: float = DEFAULT_THRESH):
	"""
	So khớp frame.jpg với tập ảnh của user_id trên Firebase Storage.
	Trả về dict gồm matched(bool), best_score(float), best_blob(str|None), best_local(str|None)
	"""
	# 1) Init
	bucket = init_firebase(cred_json, bucket_name)
	app = init_face_app()

	# 2) Embedding cho frame
	img = cv2.imread(frame_path)
	if img is None:
		return {"status":"error", "reason":"frame_not_found", "matched":False}
	fq = get_face_embedding(app, img)
	if fq is None:
		return {"status":"ok", "reason":"no_face_in_frame", "matched":False, "best_score":0.0, "best_blob":None, "best_local":None}

	# 3) Liệt kê ảnh của user_id duy nhất
	blob_paths = list_user_images(bucket, user_id)
	if len(blob_paths) == 0:
		return {"status":"ok", "reason":"no_images_for_user", "matched":False, "best_score":0.0, "best_blob":None, "best_local":None}

	# 4) Tải từng ảnh của user_id về tạm, tính score, lấy max
	tmp_dir = tempfile.mkdtemp(prefix=f"fr_{user_id}_")
	best_score = -1.0
	best_blob = None
	best_local = None

	try:
		for blob_name in blob_paths:
			local = download_blob_to_tmp(bucket, blob_name, tmp_dir)
			db_img = cv2.imread(local)
			if db_img is None:
				continue
			fi = get_face_embedding(app, db_img)
			if fi is None:
				continue
			score = cosine_similarity(fq, fi)
			if score > best_score:
				best_score = score
				best_blob = blob_name
				best_local = local

		if best_score < 0.0:
			return {"status":"ok", "reason":"no_valid_faces_in_user_images", "matched":False, "best_score":0.0, "best_blob":None, "best_local":None}

		matched = best_score >= thresh
		return {
			"status":"ok",
			"matched": matched,
			"best_score": best_score,
			"best_blob": best_blob,
			"best_local": best_local,
			"user_id": user_id,
			"threshold": thresh
		}
	finally:
		# Nếu muốn giữ lại ảnh đối sánh tốt nhất để kiểm tra, có thể KHÔNG xoá tmp_dir
		# Ở đây ta chỉ xoá các file khác, giữ lại best_local nếu có.
		if best_local and os.path.exists(best_local):
			# di chuyển best_local ra ngoài trước khi xóa tmp_dir
			dst = os.path.abspath(f"best_match_{user_id}.jpg")
			try:
				shutil.copy2(best_local, dst)
				keep_path = dst
			except Exception:
				keep_path = best_local
		else:
			keep_path = None

		# xóa thư mục tạm
		try:
			shutil.rmtree(tmp_dir, ignore_errors=True)
		except Exception:
			pass

		# bổ sung đường dẫn giữ lại (nếu copy được)
		if keep_path:
			# trả kèm đường dẫn đã copy
			pass

def main():
	parser = argparse.ArgumentParser(description="Face recognition: frame.jpg vs Firebase Storage images of a specific user_id")
	parser.add_argument("--frame", required=True, help="Path to frame.jpg")
	parser.add_argument("--user_id", required=True, help="User ID to verify against (only images under faces/<user_id>/ are used)")
	parser.add_argument("--firebase_cred", required=True, help="Path to Firebase service account JSON")
	parser.add_argument("--bucket", required=True, help="Firebase Storage bucket name, e.g. my-project.appspot.com")
	parser.add_argument("--thresh", type=float, default=DEFAULT_THRESH, help="Cosine similarity threshold (default 0.40)")
	args = parser.parse_args()

	res = recognize_user_with_frame(args.frame, args.user_id, args.firebase_cred, args.bucket, args.thresh)
	print(res)

if __name__ == "__main__":
	main()
