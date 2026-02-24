import IORedis from "ioredis";

// We parse using the native URL parser, which is vastly safer
// than splitting strings with `@` and `:`
const parsedUrl = new URL(process.env.REDIS_URL!);

export const queueRedisConnection = new IORedis({
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port),
  password: parsedUrl.password,
  tls: {}, // Required for Upstash
  maxRetriesPerRequest: null,
});
