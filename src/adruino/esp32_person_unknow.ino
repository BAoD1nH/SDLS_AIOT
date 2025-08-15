/* Edge Impulse Arduino examples
 * Copyright (c) 2022 EdgeImpulse Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// These sketches are tested with 2.0.4 ESP32 Arduino Core
// https://github.com/espressif/arduino-esp32/releases/tag/2.0.4

/* Includes ---------------------------------------------------------------- */
#include <Person_vs_unknown_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"
#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// Select camera model - find more camera models in camera_pins.h file here
// https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h


// #define CAMERA_MODEL_ESP_EYE // Has PSRAM
#define CAMERA_MODEL_AI_THINKER // Has PSRAM

#if defined(CAMERA_MODEL_ESP_EYE)
#define PWDN_GPIO_NUM    -1
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM    4
#define SIOD_GPIO_NUM    18
#define SIOC_GPIO_NUM    23

#define Y9_GPIO_NUM      36
#define Y8_GPIO_NUM      37
#define Y7_GPIO_NUM      38
#define Y6_GPIO_NUM      39
#define Y5_GPIO_NUM      35
#define Y4_GPIO_NUM      14
#define Y3_GPIO_NUM      13
#define Y2_GPIO_NUM      34
#define VSYNC_GPIO_NUM   5
#define HREF_GPIO_NUM    27
#define PCLK_GPIO_NUM    25

#elif defined(CAMERA_MODEL_AI_THINKER)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#else
#error "Camera model not selected"
#endif

/* Constant defines -------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS           320
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS           240
#define EI_CAMERA_FRAME_BYTE_SIZE                 3

/* Private variables ------------------------------------------------------- */
static bool debug_nn = false; // Set this to true to see e.g. features generated from the raw signal
static bool is_initialised = false;
uint8_t *snapshot_buf; //points to the output of the capture

const char* ssid = "Gia Bao";
const char* password = "28092004";
WebServer server(80);

WiFiClient espClient;

unsigned long last_inference_time = 0;
const unsigned long inference_interval = 4000;  // mỗi 2 giây

// Biến toàn cục chứa kết quả inference
String latest_label = "unknown";
float latest_confidence = 0.0;

// ===== Server nhận ảnh =====
const char* UPLOAD_HOST = "192.168.1.8";	// đổi theo server của bạn
const uint16_t UPLOAD_PORT = 8000;			// đổi theo server
const char* UPLOAD_PATH = "/upload";		// endpoint trên server
unsigned long last_upload_ms = 0;
const unsigned long upload_cooldown_ms = 3000; // chống spam: 1 ảnh / 3s


static camera_config_t camera_config = {
    .pin_pwdn = PWDN_GPIO_NUM,
    .pin_reset = RESET_GPIO_NUM,
    .pin_xclk = XCLK_GPIO_NUM,
    .pin_sscb_sda = SIOD_GPIO_NUM,
    .pin_sscb_scl = SIOC_GPIO_NUM,

    .pin_d7 = Y9_GPIO_NUM,
    .pin_d6 = Y8_GPIO_NUM,
    .pin_d5 = Y7_GPIO_NUM,
    .pin_d4 = Y6_GPIO_NUM,
    .pin_d3 = Y5_GPIO_NUM,
    .pin_d2 = Y4_GPIO_NUM,
    .pin_d1 = Y3_GPIO_NUM,
    .pin_d0 = Y2_GPIO_NUM,
    .pin_vsync = VSYNC_GPIO_NUM,
    .pin_href = HREF_GPIO_NUM,
    .pin_pclk = PCLK_GPIO_NUM,

    //XCLK 20MHz or 10MHz for OV2640 double FPS (Experimental)
    .xclk_freq_hz = 20000000,
    .ledc_timer = LEDC_TIMER_0,
    .ledc_channel = LEDC_CHANNEL_0,

    .pixel_format = PIXFORMAT_JPEG, //YUV422,GRAYSCALE,RGB565,JPEG
    .frame_size = FRAMESIZE_QVGA,    //QQVGA-UXGA Do not use sizes above QVGA when not JPEG

    .jpeg_quality = 10, //0-63 lower number means higher quality
    .fb_count = 2,       //if more than one, i2s runs in continuous mode. Use only with JPEG
    .fb_location = CAMERA_FB_IN_PSRAM,
    // .grab_mode = CAMERA_GRAB_WHEN_EMPTY,
    .grab_mode  = CAMERA_GRAB_LATEST,   // lấy khung hình mới nhất
};

/* Function definitions ------------------------------------------------------- */
bool ei_camera_init(void);
void ei_camera_deinit(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) ;
volatile bool camBusy = false;
/**
* @brief      Arduino setup function
*/

void handlePrediction() {
	String json = "{\"label\":\"" + latest_label + "\",\"confidence\":" + String(latest_confidence, 4) + "}";
	server.send(200, "application/json", json);
}

void setup()
{
    // put your setup code here, to run once:
    //1. Kết nối Wifi
    Serial.begin(115200);

    WiFi.begin(ssid, password);
    Serial.print("Connecting to Wi-Fi...");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWi-Fi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    //comment out the below line to start inference immediately after upload
    //2. Khởi tạo camera
    while (!Serial);
    Serial.println("Edge Impulse Inferencing Demo");
    if (ei_camera_init() == false) {
        ei_printf("Failed to initialize Camera!\r\n");
    }
    else {
        ei_printf("Camera initialized\r\n");
    }

	// server.on("/stream", HTTP_GET, []() {
	// 	// start MJPEG stream
	// 	stream_handler();  // bạn cần viết hoặc đã có hàm này ở file .ino
	// });

    server.on("/jpg", HTTP_GET, []() {
        if (camBusy) {                     // tránh tranh chấp với infer
            server.send(503, "text/plain", "Camera busy");
            return;
        }

        camBusy = true;                    // khóa camera
        camera_fb_t *fb = esp_camera_fb_get();
        if (!fb) {
            camBusy = false;
            server.send(500, "text/plain", "Camera capture failed");
            return;
        }

        WiFiClient client = server.client();
        client.printf(
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: image/jpeg\r\n"
            "Content-Length: %u\r\n"
            "Cache-Control: no-store\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "\r\n",
            fb->len
        );
        client.write(fb->buf, fb->len);

        esp_camera_fb_return(fb);
        camBusy = false;                   // mở khóa
    });


    // JSON kết quả inferencing cho frontend poll
    server.on("/prediction", HTTP_OPTIONS, [](){ // CORS preflight
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.sendHeader("Access-Control-Allow-Headers", "*");
        server.sendHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        server.send(204);
    });

	server.on("/prediction", HTTP_GET, []() {
        String json = "{\"label\":\"" + latest_label +
                        "\",\"confidence\":" + String(latest_confidence, 4) + "}";
        server.sendHeader("Access-Control-Allow-Origin", "*"); // bật CORS
        server.send(200, "application/json", json);
    });

	server.begin();  // ⚠️ Đừng quên dòng này!
	ei_printf("HTTP server started\r\n");
	ei_printf("\nStarting continuous inference in 2 seconds...\n");
	ei_sleep(2000);

}

/**
* @brief      Get data and run inferencing
*
* @param[in]  debug  Get debug info if true
*/
void loop()
{   
    // Luôn cho phép web server xử lý các HTTP request (stream, HTML, JSON...)
	server.handleClient();

    // Nếu chưa đủ thời gian, thì bỏ qua phần inference, nhưng KHÔNG return luôn
	if (millis() - last_inference_time < inference_interval) {
		delay(10);  // Nghỉ nhẹ, tránh CPU 100%
		return;
	}

	// Cập nhật thời điểm chạy inference gần nhất
	last_inference_time = millis();

    // instead of wait_ms, we'll wait on the signal, this allows threads to cancel us...
    if (ei_sleep(5) != EI_IMPULSE_OK) {
        return;
    }

    snapshot_buf = (uint8_t*)malloc(EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * EI_CAMERA_FRAME_BYTE_SIZE);

    // check if allocation was successful
    if(snapshot_buf == nullptr) {
        ei_printf("ERR: Failed to allocate snapshot buffer!\n");
        return;
    }

    ei::signal_t signal;
    signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
    signal.get_data = &ei_camera_get_data;

    //8.11.25
    camBusy = true;
    bool capok = ei_camera_capture(
        (size_t)EI_CLASSIFIER_INPUT_WIDTH,
        (size_t)EI_CLASSIFIER_INPUT_HEIGHT,
        snapshot_buf
    );
    camBusy = false;

    if (!capok) {
        ei_printf("Failed to capture image\r\n");
        free(snapshot_buf);
        return;
    }

    if (ei_camera_capture((size_t)EI_CLASSIFIER_INPUT_WIDTH, (size_t)EI_CLASSIFIER_INPUT_HEIGHT, snapshot_buf) == false) {
        ei_printf("Failed to capture image\r\n");
        free(snapshot_buf);
        return;
    }

    // Run the classifier
    ei_impulse_result_t result = { 0 };

    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, debug_nn);
    if (err != EI_IMPULSE_OK) {
        ei_printf("ERR: Failed to run classifier (%d)\n", err);
        free(snapshot_buf);  // ✅ BỔ SUNG CHỖ NÀY
        return;
    }

    // print the predictions
    ei_printf("Predictions (DSP: %d ms., Classification: %d ms., Anomaly: %d ms.): \n",
                result.timing.dsp, result.timing.classification, result.timing.anomaly);

#if EI_CLASSIFIER_OBJECT_DETECTION == 1
    ei_printf("Object detection bounding boxes:\r\n");
    for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
        ei_impulse_result_bounding_box_t bb = result.bounding_boxes[i];
        if (bb.value == 0) {
            continue;
        }
        ei_printf("  %s (%f) [ x: %u, y: %u, width: %u, height: %u ]\r\n",
                bb.label,
                bb.value,
                bb.x,
                bb.y,
                bb.width,
                bb.height);
    }

    // Print the prediction results (classification)
#else
    ei_printf("Predictions:\r\n");
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        ei_printf("  %s: ", ei_classifier_inferencing_categories[i]);
        ei_printf("%.5f\r\n", result.classification[i].value);
    }

    float person_score = result.classification[0].value;

    if (person_score > 0.5f) {
        Serial.println("Person detected!");
        latest_label = "person";
        latest_confidence = person_score;

        // Chống spam upload: tối thiểu mỗi 3 giây mới gửi 1 ảnh
        if (millis() - last_upload_ms >= upload_cooldown_ms) {
            bool sent = capture_and_send_current_frame("person", person_score);
            Serial.println(sent ? "Upload OK" : "Upload FAIL");
            last_upload_ms = millis();
        }
    } else {
        Serial.println("Low confidence. No person detected.");
        latest_label = "unknown";
        latest_confidence = 1.0f - person_score;
    }

    
#endif

    // Print anomaly result (if it exists)
#if EI_CLASSIFIER_HAS_ANOMALY
    ei_printf("Anomaly prediction: %.3f\r\n", result.anomaly);
#endif

#if EI_CLASSIFIER_HAS_VISUAL_ANOMALY
    ei_printf("Visual anomalies:\r\n");
    for (uint32_t i = 0; i < result.visual_ad_count; i++) {
        ei_impulse_result_bounding_box_t bb = result.visual_ad_grid_cells[i];
        if (bb.value == 0) {
            continue;
        }
        ei_printf("  %s (%f) [ x: %u, y: %u, width: %u, height: %u ]\r\n",
                bb.label,
                bb.value,
                bb.x,
                bb.y,
                bb.width,
                bb.height);
    }
#endif


    free(snapshot_buf);

}

/**
 * @brief   Setup image sensor & start streaming
 *
 * @retval  false if initialisation failed
 */
bool ei_camera_init(void) {

    if (is_initialised) return true;

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

    //initialize the camera
    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
      Serial.printf("Camera init failed with error 0x%x\n", err);
      return false;
    }

    sensor_t * s = esp_camera_sensor_get();
    // initial sensors are flipped vertically and colors are a bit saturated
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1); // flip it back
      s->set_brightness(s, 1); // up the brightness just a bit
      s->set_saturation(s, 0); // lower the saturation
    }

#if defined(CAMERA_MODEL_M5STACK_WIDE)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
#elif defined(CAMERA_MODEL_ESP_EYE)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
    s->set_awb_gain(s, 1);
#endif

    is_initialised = true;
    return true;
}

/**
 * @brief      Stop streaming of sensor data
 */
void ei_camera_deinit(void) {

    //deinitialize the camera
    esp_err_t err = esp_camera_deinit();

    if (err != ESP_OK)
    {
        ei_printf("Camera deinit failed\n");
        return;
    }

    is_initialised = false;
    return;
}


/**
 * @brief      Capture, rescale and crop image
 *
 * @param[in]  img_width     width of output image
 * @param[in]  img_height    height of output image
 * @param[in]  out_buf       pointer to store output image, NULL may be used
 *                           if ei_camera_frame_buffer is to be used for capture and resize/cropping.
 *
 * @retval     false if not initialised, image captured, rescaled or cropped failed
 *
 */
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) {
    bool do_resize = false;

    if (!is_initialised) {
        ei_printf("ERR: Camera is not initialized\r\n");
        return false;
    }

    camera_fb_t *fb = esp_camera_fb_get();

    if (!fb) {
        ei_printf("Camera capture failed\n");
        return false;
    }

   bool converted = fmt2rgb888(fb->buf, fb->len, PIXFORMAT_JPEG, snapshot_buf);

   esp_camera_fb_return(fb);

   if(!converted){
       ei_printf("Conversion failed\n");
       return false;
   }

    if ((img_width != EI_CAMERA_RAW_FRAME_BUFFER_COLS)
        || (img_height != EI_CAMERA_RAW_FRAME_BUFFER_ROWS)) {
        do_resize = true;
    }

    if (do_resize) {
        ei::image::processing::crop_and_interpolate_rgb888(
        out_buf,
        EI_CAMERA_RAW_FRAME_BUFFER_COLS,
        EI_CAMERA_RAW_FRAME_BUFFER_ROWS,
        out_buf,
        img_width,
        img_height);
    }


    return true;
}

static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr)
{
    // we already have a RGB888 buffer, so recalculate offset into pixel index
    size_t pixel_ix = offset * 3;
    size_t pixels_left = length;
    size_t out_ptr_ix = 0;

    while (pixels_left != 0) {
        // Swap BGR to RGB here
        // due to https://github.com/espressif/esp32-camera/issues/379
        out_ptr[out_ptr_ix] = (snapshot_buf[pixel_ix + 2] << 16) + (snapshot_buf[pixel_ix + 1] << 8) + snapshot_buf[pixel_ix];

        // go to the next pixel
        out_ptr_ix++;
        pixel_ix+=3;
        pixels_left--;
    }
    // and done!
    return 0;
}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "Invalid model for current sensor"
#endif

void stream_handler() {
	camera_fb_t *fb = nullptr;
	WiFiClient client = server.client();

	String response = "HTTP/1.1 200 OK\r\n";
	response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
	server.sendContent(response);

	while (client.connected()) {
		fb = esp_camera_fb_get();
		if (!fb) {
			Serial.println("Camera capture failed");
			break;
		}

		client.print("--frame\r\n");
		client.print("Content-Type: image/jpeg\r\n");
		client.print("Content-Length: " + String(fb->len) + "\r\n\r\n");
		client.write(fb->buf, fb->len);
		client.print("\r\n");

		esp_camera_fb_return(fb);

		delay(100);  // Giảm tần suất gửi ảnh (tùy nhu cầu)
	}
}

bool http_post_jpeg(const char* host, uint16_t port, const char* path,
		const uint8_t* jpg, size_t jpg_len,
		const char* label, float conf) {

	WiFiClient client;
	if (!client.connect(host, port)) {
		Serial.println("Connect upload host failed");
		return false;
	}

	String boundary = "----esp32camboundary";
	// meta JSON nhỏ gọn để tiết kiệm RAM
	String meta = String("{\"label\":\"") + label + "\",\"confidence\":" + String(conf, 4) + "}";

	String head =
		String("--") + boundary + "\r\n"
		"Content-Disposition: form-data; name=\"meta\"\r\n\r\n" +
		meta + "\r\n" +
		"--" + boundary + "\r\n"
		"Content-Disposition: form-data; name=\"file\"; filename=\"frame.jpg\"\r\n"
		"Content-Type: image/jpeg\r\n\r\n";

	String tail = String("\r\n--") + boundary + "--\r\n";

	// Request header
	String req =
		String("POST ") + path + " HTTP/1.1\r\n"
		"Host: " + host + ":" + String(port) + "\r\n"
		"Content-Type: multipart/form-data; boundary=" + boundary + "\r\n"
		"Connection: close\r\n"
		"Content-Length: " + String(head.length() + jpg_len + tail.length()) + "\r\n\r\n";

	// Gửi lần lượt để tránh copy buffer lớn
	client.print(req);
	client.print(head);
	client.write(jpg, jpg_len);
	client.print(tail);

	// Đọc phản hồi (tùy chọn)
	unsigned long t0 = millis();
	while (client.connected() && millis() - t0 < 5000) {
		while (client.available()) {
			(void)client.read(); // bỏ qua nội dung
		}
	}
	client.stop();
	return true;
}

bool capture_and_send_current_frame(const char* label, float conf) {
	camera_fb_t *fb = esp_camera_fb_get();
	if (!fb) {
		Serial.println("capture_and_send_current_frame: camera_fb_get failed");
		return false;
	}
	bool ok = http_post_jpeg(UPLOAD_HOST, UPLOAD_PORT, UPLOAD_PATH, fb->buf, fb->len, label, conf);
	esp_camera_fb_return(fb);
	return ok;
}
