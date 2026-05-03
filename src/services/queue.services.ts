import { Queue, Worker, QueueEvents } from "bullmq";

import { logger } from "../utils/logger";
import { queueRedisConnection } from "./redis-queue";

const QUEUE_NAME = "email";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: queueRedisConnection,
});

export const emailWorker = new Worker(
  QUEUE_NAME,
  async ({ name, data }) => {
    if (name === "send-mail") {
      // Send the email to sendgrid
      // await sgMail.send(data);
      logger.info({ data, queue: QUEUE_NAME }, "email job processed");
    }
  },
  {
    connection: queueRedisConnection,
    limiter: {
      max: 10, // Max 10 jobs per second
      duration: 1000,
    },
  },
);

// Queue event listeners
const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: queueRedisConnection,
});

queueEvents.on("completed", ({ jobId }) => {
  logger.info({ jobId, queue: QUEUE_NAME }, "queue job completed");
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error(
    { jobId, queue: QUEUE_NAME, failedReason },
    "queue job failed",
  );
});
