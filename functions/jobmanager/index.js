import { createClient } from "redis";

/**
 * JobManager
 *
 * It orchestrates the execution of jobs.
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
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    throw new Error(`REDIS_URL environment variable is required`);
  }
  logger.info(
    `Invoking JobManager with payload ${JSON.stringify(event.data || {})}`
  );

  // Get Request ID to keep track of Jobs
  const jobId = event.id;
  // Get the number of jobs to execute
  const jobs = event.data.jobs;
  if (!jobs) {
    throw new Error(`Please specify the number of jobs to execute`);
  }

  // Connect to Redis
  const client = createClient({
    url: REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false
    }
  });
  await client.connect();

  // Setup Job Information
  await client.hSet(`job:${jobId}`, "status", "running");
  await client.hSet(`job:${jobId}`, "jobs", jobs);
  await client.hSet(`job:${jobId}`, "completed", 0);
  await client.quit();

  const response = {
    jobId,
    status: "running"
  };
  return response;
}
