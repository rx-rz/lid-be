import { rateLimit, type Generator } from "elysia-rate-limit";
import { RedisRateLimitContext } from "../utils/rate-limit";

const TOO_MANY_REQUESTS = "Too many requests. Please slow down.";

type RateLimitPreset = {
  duration: number;
  max: number;
  prefix: string;
};

export const rateLimitPresets = {
  generalAuthenticated: {
    duration: 60_000,
    max: 60,
    prefix: "rl:auth:",
  },
  discovery: {
    duration: 60_000,
    max: 30,
    prefix: "rl:discovery:",
  },
  interactions: {
    duration: 60_000,
    max: 20,
    prefix: "rl:interactions:",
  },
  entitlementConsumption: {
    duration: 60_000,
    max: 10,
    prefix: "rl:entitlements:",
  },
  payments: {
    duration: 60_000,
    max: 20,
    prefix: "rl:payments:",
  },
  webhook: {
    duration: 60_000,
    max: 120,
    prefix: "rl:webhook:",
  },
  public: {
    duration: 60_000,
    max: 30,
    prefix: "rl:public:",
  },
} satisfies Record<string, RateLimitPreset>;

const getForwardedIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim();

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    undefined
  );
};

export const stableRateLimitKey: Generator<any> = (
  request,
  server,
  derived = {},
) => {
  const authUserId =
    derived.user?.id ||
    derived.userId ||
    derived.auth?.userId ||
    derived.auth?.sessionClaims?.sub ||
    derived.clerk?.userId;

  if (authUserId) return `user:${authUserId}`;

  const forwardedIp = getForwardedIp(request);
  if (forwardedIp) return `ip:${forwardedIp}`;

  const bunIp = server?.requestIP(request)?.address;
  return `ip:${bunIp || "unknown"}`;
};

export const routeRateLimit = (preset: RateLimitPreset) =>
  rateLimit({
    duration: preset.duration,
    max: preset.max,
    scoping: "scoped",
    generator: stableRateLimitKey,
    context: new RedisRateLimitContext(preset.duration, preset.prefix),
    errorResponse: TOO_MANY_REQUESTS,
  });

