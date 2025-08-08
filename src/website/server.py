from flask import Flask, request

app = Flask(__name__)

@app.route("/upload", methods=["POST"])
def upload():
	meta = request.form.get('meta')
	f = request.files['file']
	f.save("frame.jpg")
	print("Meta:", meta, "Saved frame.jpg")
	return "ok", 200

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=8000)  # ⚠️ host=0.0.0.0
