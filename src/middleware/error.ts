import { Elysia } from "elysia";
import { loggers } from "../utils/logger";

export class AppError extends Error {
  public statusCode: number;
  public status: "fail" | "error";
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const isDev = process.env.NODE_ENV === "development";

export const errorMiddleware = new Elysia({ name: "ErrorMiddleware" })
  .error({
    APP_ERROR: AppError,
  })
  .onError(({ code, error, set }) => {
    const err = error as any;

    if (code === "VALIDATION") {
      const issues = err.all.map((issue: any) => ({
        path: issue.path.slice(1).replace(/\//g, "."),
        message: issue.message,
      }));

      const message = `Validation error: ${issues
        .map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
        .join(", ")}`;

      loggers.http.warn({ code, issues }, "validation error");

      set.status = 400;
      return {
        status: "fail",
        message: message + " " + "Benneth",
        ...(isDev && {
          error: err,
          stack: err.stack,
        }),
      };
    }

    if (code === "APP_ERROR") {
      const appErr = error as AppError;
      set.status = appErr.statusCode;

      loggers.http.warn(
        { code, statusCode: appErr.statusCode, err: appErr },
        "application error",
      );

      return {
        status: appErr.status,
        message: appErr.message + " " + "Benneth",
        ...(isDev && {
          error: appErr,
          stack: appErr.stack,
        }),
      };
    }

    loggers.http.error({ code, err }, "unhandled error");

    set.status = 500;
    return {
      status: "error",
      message: (isDev ? err.message : "Something went wrong") + " " + "Benneth",
      ...(isDev && {
        error: err,
        stack: err.stack,
      }),
    };
  });
