import IORedis from "ioredis";

const parsedUrl = new URL(process.env.REDIS_URL!);

export const queueRedisConnection = new IORedis({
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port),
  password: parsedUrl.password,
  tls: {}, 
  maxRetriesPerRequest: null,
});
