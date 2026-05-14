import { Elysia } from "elysia";
import { t } from "elysia";
import { loggers } from "../utils/logger";

export type ErrorStatus = "fail" | "error";

export type ErrorDetail = {
  path?: string;
  message: string;
  expected?: string;
  code?: string;
  resetTime?: string;
  feature?: string;
  reason?: string;
  requiredPlan?: string;
};

type AppErrorOptions = {
  code?: string;
  details?: ErrorDetail[];
  cause?: unknown;
  expose?: boolean;
};

export class AppError extends Error {
  public statusCode: number;
  public status: ErrorStatus;
  public code: string;
  public details?: ErrorDetail[];
  public cause?: unknown;
  public expose: boolean;
  public isOperational = true;

  constructor(message: string, statusCode: number, options: AppErrorOptions = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.code = options.code ?? (this.status === "fail" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR");
    this.details = options.details;
    this.cause = options.cause;
    this.expose = options.expose ?? statusCode < 500;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request.", options: AppErrorOptions = {}) {
    super(message, 400, { code: "BAD_REQUEST", ...options });
  }
}

export class ValidationRequestError extends AppError {
  constructor(details: ErrorDetail[], message = "Request validation failed.") {
    super(message, 400, { code: "VALIDATION_ERROR", details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", options: AppErrorOptions = {}) {
    super(message, 404, { code: "NOT_FOUND", ...options });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized.", options: AppErrorOptions = {}) {
    super(message, 401, { code: "UNAUTHORIZED", ...options });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists.", options: AppErrorOptions = {}) {
    super(message, 409, { code: "CONFLICT", ...options });
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = "Payment required.", options: AppErrorOptions = {}) {
    super(message, 402, { code: "PAYMENT_REQUIRED", ...options });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please slow down.", options: AppErrorOptions = {}) {
    super(message, 429, { code: "TOO_MANY_REQUESTS", ...options });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable.", options: AppErrorOptions = {}) {
    super(message, 503, { code: "SERVICE_UNAVAILABLE", expose: false, ...options });
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Something went wrong.", options: AppErrorOptions = {}) {
    super(message, 500, { code: "INTERNAL_SERVER_ERROR", expose: false, ...options });
  }
}

export const ErrorResponseSchema = t.Object({
  status: t.Union([t.Literal("fail"), t.Literal("error")]),
  message: t.String(),
  code: t.String(),
  details: t.Optional(
    t.Array(
      t.Object({
        path: t.Optional(t.String()),
        message: t.String(),
        expected: t.Optional(t.String()),
        code: t.Optional(t.String()),
        resetTime: t.Optional(t.String()),
        feature: t.Optional(t.String()),
        reason: t.Optional(t.String()),
        requiredPlan: t.Optional(t.String()),
      }),
    ),
  ),
  requestId: t.Optional(t.String()),
});

const isDev = process.env.NODE_ENV !== "production";

const getRequestId = (request?: Request, set?: any) =>
  request?.headers.get("x-request-id") ||
  set?.headers?.["x-request-id"] ||
  set?.headers?.["X-Request-Id"];

const toReadablePath = (path: unknown) => {
  if (typeof path !== "string" || path.length === 0) return undefined;
  const cleaned = path.replace(/^\//, "").replace(/\//g, ".");
  return cleaned || undefined;
};

const formatValidationError = (err: any) => {
  const rawIssues = Array.isArray(err?.all) ? err.all : Array.isArray(err?.errors) ? err.errors : [];

  const details = rawIssues.map((issue: any) => ({
    path: toReadablePath(issue.path),
    message: issue.message || "Invalid value.",
    ...(issue.schema?.type && { expected: String(issue.schema.type) }),
  }));

  return new ValidationRequestError(
    details.length ? details : [{ message: err?.message || "Invalid request." }],
  );
};

const pgConstraintMessages: Record<string, { message: string; code: string }> = {
  users_email_unique: { message: "Email is already in use.", code: "USER_ALREADY_EXISTS" },
  users_clerk_id_unique: { message: "User already exists.", code: "USER_ALREADY_EXISTS" },
};

const normalizeDatabaseError = (error: any): AppError | null => {
  const err = error?.cause ?? error;
  const pgCode = err?.code;

  if (!pgCode) {
    const message = String(err?.message || "");
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection terminated|Connection terminated/i.test(message)) {
      return new ServiceUnavailableError("Database is temporarily unavailable.", {
        code: "DATABASE_UNAVAILABLE",
        cause: error,
      });
    }
    return null;
  }

  const constraint = err.constraint || err.constraint_name;
  const mapped = constraint ? pgConstraintMessages[constraint] : undefined;

  if (pgCode === "23505") {
    return new ConflictError(mapped?.message || "A record with this value already exists.", {
      code: mapped?.code || "DATABASE_UNIQUE_VIOLATION",
      cause: error,
    });
  }

  if (pgCode === "23503") {
    return new BadRequestError("Referenced record does not exist.", {
      code: "DATABASE_FOREIGN_KEY_VIOLATION",
      cause: error,
    });
  }

  if (pgCode === "23502") {
    return new BadRequestError("A required field is missing.", {
      code: "DATABASE_NOT_NULL_VIOLATION",
      details: err.column ? [{ path: String(err.column), message: "This field is required." }] : undefined,
      cause: error,
    });
  }

  if (pgCode === "23514") {
    return new BadRequestError("A field failed validation rules.", {
      code: "DATABASE_CHECK_VIOLATION",
      cause: error,
    });
  }

  if (["08000", "08003", "08006", "57P01", "57P02", "57P03"].includes(pgCode)) {
    return new ServiceUnavailableError("Database is temporarily unavailable.", {
      code: "DATABASE_UNAVAILABLE",
      cause: error,
    });
  }

  return null;
};

const normalizeKnownPlainError = (error: any): AppError | null => {
  const message = String(error?.message || "");

  if (message.startsWith("SWIPE_LIMIT_REACHED:")) {
    const resetTime = message.split(":").slice(1).join(":");
    return new TooManyRequestsError("Swipe limit reached.", {
      code: "SWIPE_LIMIT_REACHED",
      details: [{ message: "Daily swipe allowance has been reached.", resetTime }],
      cause: error,
    });
  }

  const exact: Record<string, AppError> = {
    INSUFFICIENT_SUPERLIKES: new PaymentRequiredError(
      "You are out of Super Likes. Please upgrade or buy more.",
      { code: "INSUFFICIENT_SUPERLIKES", cause: error },
    ),
    INSUFFICIENT_RECALLS: new PaymentRequiredError(
      "You are out of Recalls. Please upgrade or buy more.",
      { code: "INSUFFICIENT_RECALLS", cause: error },
    ),
    INSUFFICIENT_BOOSTS: new PaymentRequiredError(
      "You are out of Takeoff boosts. Please upgrade or buy more.",
      { code: "INSUFFICIENT_BOOSTS", cause: error },
    ),
    USER_NO_CUSTOMER_ID: new BadRequestError("User has no Stripe customer ID.", {
      code: "USER_NO_CUSTOMER_ID",
      cause: error,
    }),
    PAYMENT_RECORD_NOT_FOUND: new NotFoundError("Payment record not found.", {
      code: "PAYMENT_RECORD_NOT_FOUND",
      cause: error,
    }),
    CUSTOMER_NOT_FOUND: new NotFoundError("Customer not found.", {
      code: "CUSTOMER_NOT_FOUND",
      cause: error,
    }),
    ADDON_PACK_NOT_FOUND: new NotFoundError("Add-on pack not found.", {
      code: "ADDON_PACK_NOT_FOUND",
      cause: error,
    }),
  };

  return exact[message] ?? null;
};

const normalizeError = (code: string | number, error: any): AppError => {
  if (code === "VALIDATION") return formatValidationError(error);
  if (error instanceof AppError) return error;

  const knownPlainError = normalizeKnownPlainError(error);
  if (knownPlainError) return knownPlainError;

  const databaseError = normalizeDatabaseError(error);
  if (databaseError) return databaseError;

  if (typeof error?.status === "number" && error.status >= 400 && error.status < 500) {
    return new AppError(error.message || "Request failed.", error.status, {
      code: error.code || "REQUEST_ERROR",
      cause: error,
    });
  }

  return new InternalServerError(isDev ? error?.message || "Something went wrong." : "Something went wrong.", {
    cause: error,
  });
};

const buildResponse = (appError: AppError, requestId?: string) => ({
  status: appError.status,
  message: appError.expose || isDev ? appError.message : "Something went wrong.",
  code: appError.code,
  ...(appError.details?.length && { details: appError.details }),
  ...(requestId && { requestId }),
  ...(isDev && {
    debug: {
      name: appError.name,
      cause:
        appError.cause instanceof Error
          ? { name: appError.cause.name, message: appError.cause.message }
          : appError.cause,
    },
    stack: appError.stack,
  }),
});

export const errorMiddleware = new Elysia({ name: "ErrorMiddleware" })
  .error({
    APP_ERROR: AppError,
  })
  .onError(({ code, error, set, request }) => {
    const appError = normalizeError(code, error);
    const requestId = getRequestId(request, set);

    set.status = appError.statusCode;

    const logPayload = {
      requestId,
      code: appError.code,
      statusCode: appError.statusCode,
      err: appError,
      cause: appError.cause,
    };

    if (appError.statusCode >= 500) {
      loggers.http.error(logPayload, "request error");
    } else {
      loggers.http.warn(logPayload, "request failed");
    }

    return buildResponse(appError, requestId);
  })
  .as("global");
