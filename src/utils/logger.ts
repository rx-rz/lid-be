import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.stripe-signature",
      'req.headers["stripe-signature"]',
      "headers.authorization",
      "headers.cookie",
      "headers.stripe-signature",
      'headers["stripe-signature"]',
      "authorization",
      "cookie",
      "stripeSignature",
      "stripe-signature",
      "stripe_signature",
      "token",
      "fcmToken",
      "fcm_token",
      "streamToken",
      "stream_token",
      "privateKey",
      "clientSecret",
      "client_secret",
      "rawBody",
      "*.token",
      "*.fcmToken",
      "*.fcm_token",
      "*.streamToken",
      "*.stream_token",
      "*.clientSecret",
      "*.client_secret",
    ],
    censor: "[Redacted]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    },
  }),
});

export const loggers = {
  http: logger.child({ domain: "http" }),
  payment: logger.child({ domain: "payment" }),
  stripe: logger.child({ domain: "stripe" }),
  interaction: logger.child({ domain: "interaction" }),
  premium: logger.child({ domain: "premium" }),
  roulette: logger.child({ domain: "roulette" }),
  stream: logger.child({ domain: "stream" }),
  cron: logger.child({ domain: "cron" }),
  redis: logger.child({ domain: "redis" }),
  cache: logger.child({ domain: "cache" }),
  preference: logger.child({ domain: "preference" }),
  queue: logger.child({ domain: "queue" }),
  websocket: logger.child({ domain: "websocket" }),
};
