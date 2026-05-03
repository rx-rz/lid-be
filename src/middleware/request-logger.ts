import { Elysia } from "elysia";
import { loggers } from "../utils/logger";

type RequestMeta = {
  requestId: string;
  startedAt: number;
};

const requestMeta = new WeakMap<Request, RequestMeta>();

const getRequestId = (request: Request) =>
  request.headers.get("x-request-id") || crypto.randomUUID();

const getIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";

const getUserId = (context: any) =>
  context.user?.id ||
  context.auth?.userId ||
  context.store?.userId ||
  context.request.headers.get("x-user-id") ||
  undefined;

export const requestLoggerMiddleware = new Elysia({
  name: "RequestLoggerMiddleware",
})
  .onRequest((context: any) => {
    const requestId = getRequestId(context.request);
    requestMeta.set(context.request, {
      requestId,
      startedAt: performance.now(),
    });

    context.set.headers = {
      ...(context.set.headers || {}),
      "x-request-id": requestId,
    };

    loggers.http.info(
      {
        requestId,
        method: context.request.method,
        path: new URL(context.request.url).pathname,
        ip: getIp(context.request),
        userId: getUserId(context),
      },
      "request started",
    );
  })
  .onAfterHandle((context: any) => {
    const meta = requestMeta.get(context.request);
    const requestId = meta?.requestId || getRequestId(context.request);
    const startedAt = meta?.startedAt || performance.now();

    loggers.http.info(
      {
        requestId,
        method: context.request.method,
        path: new URL(context.request.url).pathname,
        status: context.set.status || 200,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        ip: getIp(context.request),
        userId: getUserId(context),
      },
      "request completed",
    );
  })
  .onError((context: any) => {
    const meta = requestMeta.get(context.request);
    const requestId = meta?.requestId || getRequestId(context.request);
    const startedAt = meta?.startedAt || performance.now();

    loggers.http.error(
      {
        requestId,
        err: context.error,
        method: context.request.method,
        path: new URL(context.request.url).pathname,
        status: context.set.status || 500,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        ip: getIp(context.request),
        userId: getUserId(context),
      },
      "request failed",
    );
  });
