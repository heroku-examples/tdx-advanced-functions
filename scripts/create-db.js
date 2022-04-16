import "dotenv/config";
import pg from "pg";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import PQueue from "p-queue";

// Keep a list of all the charging stations
const stations = [];

// Parse CSV file into a JSON array
function parseCsv() {
  const mapCsvColumns = {
    station_name: 1,
    street_address: 2,
    city: 4,
    state: 5,
    zip: 6,
    latitude: 24,
    longitude: 25
  };
  const csvParser = parse({ delimiter: "," });
  const chargingStationsReader = createReadStream(
    new URL("../data/alt_fuel_stations.csv", import.meta.url),
    "utf8"
  );
  chargingStationsReader.pipe(csvParser);

  csvParser.on("readable", () => {
    let record;
    while ((record = csvParser.read()) !== null) {
      stations.push({
        station_name: record[mapCsvColumns.station_name],
        street_address: record[mapCsvColumns.street_address],
        city: record[mapCsvColumns.city],
        state: record[mapCsvColumns.state],
        zip: record[mapCsvColumns.zip],
        latitude: record[mapCsvColumns.latitude],
        longitude: record[mapCsvColumns.longitude]
      });
    }
  });

  csvParser.on("end", () => {
    // Drop Header Information
    stations.shift();
    /// Create Database and Populate Data
    createDatabase().catch((err) => {
      console.error(`CVS Parser Failed with error: ${err.message}`);
      process.exit(1);
    });
  });

  csvParser.on("error", (err) => {
    console.error(`Error reading CSV: ${err.message}`);
    process.exit(1);
  });
}

// Create Database and Populate Data
async function createDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const { Pool } = pg;
  const createTableQuery = `
CREATE TABLE IF NOT EXISTS charging_stations (
  id BIGSERIAL PRIMARY KEY,
  station_name CHARACTER VARYING NOT NULL,
  street_address CHARACTER VARYING NOT NULL,
  city CHARACTER VARYING NOT NULL,
  state CHARACTER VARYING NOT NULL,
  zip CHARACTER VARYING NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL
);
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT AddGeometryColumn('charging_stations', 'location', 4326, 'POINT', 2);
`;

  // Create Database Client
  const client = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: {
      rejectUnauthorized: false
    }
  });
  await client.connect();

  // Create Table
  await client.query(createTableQuery);
  console.log(`Created Table: charging_stations`);

  // Create Promise Queue
  const queue = new PQueue({ concurrency: 10000 });

  // Count Active Jobs
  let count = 0;
  queue.on("active", () => {
    console.log(
      `Working on record #${++count}.  Size: ${queue.size}  Pending: ${
        queue.pending
      }`
    );
  });

  // Create an array of Promises to insert charging stations
  const recordTasks = stations.map(
    (station) => async () =>
      client.query(
        `INSERT INTO charging_stations (station_name, street_address, city, state, zip, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          station.station_name,
          station.street_address,
          station.city,
          station.state,
          station.zip,
          station.latitude,
          station.longitude
        ]
      )
  );

  // Add all the jobs to the queue
  await queue.addAll(recordTasks);

  console.log(`All records are inserterd into the database`);

  // Update the location column with GEO data
  const updatePointsQuery = `UPDATE charging_stations SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`;
  await client.query(updatePointsQuery);

  // Create GeoSpatial Index
  const createIndexQuery = `CREATE INDEX idx_charging_stations ON charging_stations USING GIST (location)`;
  await client.query(createIndexQuery);

  // Close the connection
  client.end();
  process.exit(0);
}

parseCsv();
