idf_component_register(
	SRCS "main.cpp" "MobileFaceNet_model_tflite.cc"
	INCLUDE_DIRS "."
	REQUIRES tflite-micro
)
