#include <stdio.h>
#include "esp_log.h"

#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/version.h"

// Nhúng model
extern const unsigned char MobileFaceNet_model_tflite[];
extern const unsigned int MobileFaceNet_model_tflite_len;

static const char* TAG = "MobileFaceNet";

// Tensor arena (dùng PSRAM nếu cần)
constexpr int kTensorArenaSize = 200 * 1024;
static uint8_t tensor_arena[kTensorArenaSize];

extern "C" void app_main(void) {
	ESP_LOGI(TAG, "Khởi động MobileFaceNet...");

	// Load model
	const tflite::Model* model = tflite::GetModel(MobileFaceNet_model_tflite);
	if (model->version() != TFLITE_SCHEMA_VERSION) {
		ESP_LOGE(TAG, "Phiên bản schema không phù hợp!");
		return;
	}

	// Resolver + Interpreter
	static tflite::AllOpsResolver resolver;
	static tflite::MicroInterpreter interpreter(model, resolver, tensor_arena, kTensorArenaSize);

	if (interpreter.AllocateTensors() != kTfLiteOk) {
		ESP_LOGE(TAG, "Không thể cấp phát Tensor!");
		return;
	}

	TfLiteTensor* input = interpreter.input(0);
	TfLiteTensor* output = interpreter.output(0);

	// In thông tin input
	ESP_LOGI(TAG, "Input dims: %d %d %d %d | Type: %d",
		input->dims->data[0], input->dims->data[1],
		input->dims->data[2], input->dims->data[3], input->type);

	// TODO: Gán ảnh kích thước 112x112 RGB hoặc Grayscale (tùy model)
	// Ví dụ: giả lập input bằng 0
	for (int i = 0; i < input->bytes; i++) {
		input->data.uint8[i] = 0;
	}

	// Thực hiện suy luận
	if (interpreter.Invoke() != kTfLiteOk) {
		ESP_LOGE(TAG, "Không thể thực thi mô hình!");
		return;
	}

	// In vài output để kiểm tra
	ESP_LOGI(TAG, "Output size = %d bytes", output->bytes);
	for (int i = 0; i < 8; i++) {
		printf("out[%d] = %f\n", i, output->data.f[i]);
	}
}
