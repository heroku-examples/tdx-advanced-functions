import pg from "pg";
import * as mqtt from "mqtt";
const { Client } = pg;

/**
 * ChargingStations
 *
 * Returns a list of charging stations from a given location
 *
 * The exported method is the entry point for your code when the function is invoked.
 *
 * Following parameters are pre-configured and provided to your function on execution:
 * @param event: represents the data associated with the occurrence of an event, and
 *                 supporting metadata about the source of that occurrence.
 * @param context: represents the connection to Functions and your Salesforce org.
 * @param logger: logging handler used to capture application logs and trace specifically
 *                 to a given execution of a function.
 */
export default async function (event, context, logger) {
  logger.info(
    `Invoking ChargingStations with payload ${JSON.stringify(event.data || {})}`
  );

  const { vin, latitude, longitude, distance = 1, results = 10 } = event.data;

  if (!vin) {
    throw new Error(`vin is required`);
  }

  if (!latitude) {
    throw new Error(`latitude is required`);
  }

  if (!longitude) {
    throw new Error(`longitude is required`);
  }

  const pgClient = await pgConnect();
  const mqttClient = await mqttConnect();

  // Get closest charging stations from the given location
  const chargingStationsQuery = `
  SELECT station_name, street_address, city, state, zip, latitude, longitude,
  ST_Distance(location, ref_location) * 0.000621371192 AS distance
  FROM charging_stations CROSS JOIN (SELECT ST_MakePoint($1, $2)::geography AS ref_location) AS ref
  WHERE ST_DWithin(location, ref_location, $3)
  ORDER BY ST_Distance(location, ref_location) LIMIT $4
  `;

  const { rows: stations } = await pgClient.query(chargingStationsQuery, [
    longitude,
    latitude,
    distance * 1609,
    results
  ]);

  const response = {
    vin,
    stations
  };

  // Send Charging Stations to the Car
  await sendChargingStations(mqttClient, response);

  pgClient.end();
  mqttClient.end();
  return response;
}

// Connect to PostgreSQL Database
async function pgConnect() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();
  return client;
}

// Connect to MQTT Message Broker
async function mqttConnect() {
  return new Promise((resolve, reject) => {
    const MQTT_URL = process.env.MQTT_URL;
    if (!MQTT_URL) {
      reject(new Error("MQTT_URL is not set"));
    }

    const mqttClient = mqtt.connect(process.env.MQTT_URL);
    mqttClient.on("connect", () => {
      resolve(mqttClient);
    });

    mqttClient.on("error", (err) => {
      mqttClient.end();
      reject(err);
    });
  });
}

async function sendChargingStations(mqttClient, { vin, stations }) {
  return new Promise((resolve, reject) => {
    mqttClient.subscribe(`/chargingstations/${vin}`, (err) => {
      if (err) return reject(err);

      mqttClient.publish(
        `/chargingstations/${vin}`,
        JSON.stringify(stations),
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  });
}