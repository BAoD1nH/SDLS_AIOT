let mqttClient;

function connectMQTT() {
	mqttClient = mqtt.connect("ws://localhost:9001");

	mqttClient.on("connect", () => {
		console.log("✅ MQTT Connected");
		mqttClient.subscribe("door/history");
	});

	mqttClient.on("message", (topic, message) => {
		if (topic === "door/history") {
			const li = document.createElement("li");
			li.textContent = message.toString();
			document.getElementById("historyList").prepend(li);
		}
	});
}
