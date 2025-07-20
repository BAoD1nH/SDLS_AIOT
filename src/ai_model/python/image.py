import serial
import os
import time

SAVE_DIR = r"C:\Users\Bao Dinh\Documents\Arduino\images"
PORT = "COM4"  # Thay COM port của ESP32-CAM
BAUDRATE = 115200

def capture_image():
	if not os.path.exists(SAVE_DIR):
		os.makedirs(SAVE_DIR)

	ser = serial.Serial(PORT, BAUDRATE, timeout=2)
	time.sleep(2)  # Đợi ESP32 khởi động

	ser.reset_input_buffer()
	ser.write(b'N')  # Gửi lệnh chụp ảnh

	print("Đang chờ ảnh từ ESP32-CAM...")

	buffer = bytearray()
	in_image = False

	while True:
		line = ser.readline()
		if line == b'IMG_START\n':
			in_image = True
			buffer = bytearray()
			continue
		elif line == b'IMG_END\n':
			break
		elif in_image:
			buffer.extend(line)

	if buffer:
		timestamp = time.strftime("%Y%m%d_%H%M%S")
		filename = os.path.join(SAVE_DIR, f"photo_{timestamp}.jpg")
		with open(filename, "wb") as f:
			f.write(buffer)
		print(f"[✓] Ảnh đã lưu tại: {filename}")
	else:
		print("[!] Không nhận được ảnh")

	ser.close()

if __name__ == "__main__":
	capture_image()
