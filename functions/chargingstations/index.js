import pg from "pg";
import * as mqtt from "mqtt";
import { createClient } from "redis";
import { request } from "undici";
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

  const {
    jobId, // Used to track the status of the job
    waypointId, // Used to store Charging Stations back to Salesforce
    distance = 1,
    results = 10
  } = event.data;

  if (!waypointId) {
    throw new Error(`waypointId is required`);
  }

  if (jobId && !(await canRunJob(jobId))) {
    throw new Error(
      `Job ${jobId} already completed or doesn't exist, please schedule a new job`
    );
  }

  // Get the Delivery Plan Id, Location, and Vin From Salesforce
  const { records } = await context.org.dataApi.query(`
    SELECT
       Vehicle_Vin__c,
       Service__r.Location__Latitude__s,
       Service__r.Location__Longitude__s,
       DeliveryRoute__r.DeliveryPlan__r.Id
    FROM DeliveryWaypoint__c WHERE Id = '${waypointId}'
    LIMIT 1
  `);

  if (!records || records.length === 0) {
    throw new Error(`No waypoint found with Id ${waypointId}`);
  }

  // Extract values from Record
  const [waypoint] = records;
  const vin = waypoint?.fields?.vehicle_vin__c;
  const deliveryPlanId =
    waypoint?.fields?.deliveryroute__r?.DeliveryPlan__r?.Id;
  const latitude = waypoint?.fields?.service__r?.Location__Latitude__s;
  const longitude = waypoint?.fields?.service__r?.Location__Longitude__s;

  if (!vin || !deliveryPlanId || !latitude || !longitude) {
    throw new Error(`Missing required fields from Delivery Waypoint`);
  }

  // Connect to PostgreSQL Database
  const pgClient = await pgConnect();
  // Connect to MQTT Message Broker
  const mqttClient = await mqttConnect();

  // Get closest charging stations from the given location
  const chargingStationsQuery = `
  SELECT station_name, street_address, city, state, zip, latitude, longitude,
  ROUND((ST_Distance(location, ref_location) * 0.000621371192)::numeric, 3) AS distance
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

  // Store Charging Stations into Salesforce using UoW Pattern
  const uow = context.org.dataApi.newUnitOfWork();
  for (const station of stations) {
    uow.registerCreate({
      type: "ChargingStation__c",
      fields: {
        Delivery_Waypoint__c: waypointId,
        Name: station.station_name,
        Street_Address__c: station.street_address,
        City__c: station.city,
        State__c: station.state,
        Zip__c: station.zip,
        Location__Latitude__s: station.latitude,
        Location__Longitude__s: station.longitude,
        Distance__c: station.distance
      }
    });
  }
  await context.org.dataApi.commitUnitOfWork(uow);

  // Build Response Object
  const response = {
    deliveryPlanId,
    waypointId,
    stations
  };

  // Send Charging Stations to the Vehicle
  await sendChargingStations(mqttClient, { vin, stations });

  // Disconnect from Database and MQTT
  pgClient.end();
  mqttClient.end();

  // Register Job Progress
  if (jobId) {
    const status = await registerJob(jobId);
    response.job = {
      jobId,
      status
    };

    if (status === "completed") {
      logger.info(`Job ${jobId} completed`);
      // Sends Platform Event to Salesforce to mark the job as completed
      await sendPlatformEvent({ context, logger }, { deliveryPlanId });
    }
  }

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

// Connect to MQTT Message Broker on Heroku
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

// Send Charging Stations to Vehicle using MQTT Message Broker
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

// Connect to Redis Database
async function redisConnect() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    throw new Error(`REDIS_URL is not set`);
  }
  // Connect to Redis
  const redisClient = createClient({
    url: REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false
    }
  });
  await redisClient.connect();
  return redisClient;
}

// Verify if a job can be run
async function canRunJob(jobId) {
  let canRun = false;
  const redisClient = await redisConnect();
  const exists = await redisClient.exists(`job:${jobId}`);
  if (exists) {
    const status = await redisClient.hGet(`job:${jobId}`, "status");
    canRun = status !== "completed";
  }
  await redisClient.quit();
  return canRun;
}

// Register Job Progress
async function registerJob(jobId) {
  const redisClient = await redisConnect();
  let status = "running";
  const jobs = await redisClient.hGet(`job:${jobId}`, "jobs");
  const completed = await redisClient.hIncrBy(`job:${jobId}`, "completed", 1);
  if (+jobs === +completed) {
    await redisClient.hSet(`job:${jobId}`, "status", "completed");
    status = "completed";
  }
  await redisClient.quit();
  return status;
}

// Sends Platform Event to Salesforce
async function sendPlatformEvent({ context, logger }, { deliveryPlanId }) {
  /**
   * The following example demonstrates how to perform a REST API request to Salesforce
   * using an http client library.
   *
   * For that, we need to build the API endpoint by getting the baseUrl and apiVersion from `context.org`
   * and the `accessToken` from `context.org.dataApi`.
   *
   * We can also simplify this specific example by using the `context.org.dataApi` SDK to create an object.
   *
   * await context.org.dataApi.create({
   *   type: "Job_Completed__e",
   *   fields: {
   *     DeliveryPlan_Id__c: deliveryPlanId
   *   }
   * });
   *
   */
  const { baseUrl, apiVersion } = context.org;
  const accessToken = context.org.dataApi.accessToken;
  const url = `${baseUrl}/services/data/v${apiVersion}/sobjects/JobCompleted__e/`;
  const { body, statusCode } = await request(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      DeliveryPlan_Id__c: deliveryPlanId
    })
  });
  logger.info(
    `Platform Event to Salesforce: ${url} - Status Code: ${statusCode} - body: ${JSON.stringify(
      await body.json()
    )}`
  );
}
