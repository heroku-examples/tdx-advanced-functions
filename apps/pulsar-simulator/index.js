const mqtt = require("mqtt");

const MQTT_URL = process.env.MQTT_URL;
if (!MQTT_URL) {
  console.error("MQTT_URL is not set");
  process.exit(1);
}

const mqttClient = mqtt.connect(MQTT_URL);

mqttClient.on("connect", () => {
  mqttClient.subscribe("/chargingstations/#", () => {
    mqttClient.on("message", (topic, message) => {
      console.log(`${topic}: ${message}`);
    });
  });
});

mqttClient.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
