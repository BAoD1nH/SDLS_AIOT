import os

def convert_to_c_array(filename):
	with open(filename, "rb") as f:
		content = f.read()
	
	var_name = filename.split("/")[-1].replace(".", "_").replace("-", "_")
	header = f"unsigned char {var_name}[] = {{\n\t"
	body = ""
	for i, byte in enumerate(content):
		body += f"0x{byte:02x}, "
		if (i + 1) % 12 == 0:
			body += "\n\t"
	footer = "\n};\n"
	size = f"unsigned int {var_name}_len = {len(content)};\n"

	output_dir = "main"
	os.makedirs(output_dir, exist_ok=True)

	with open(os.path.join(output_dir, f"{var_name}.cc"), "w") as out_file:
		out_file.write(header + body.strip() + footer + size)

if __name__ == "__main__":
	convert_to_c_array("MobileFaceNet_model.tflite")
