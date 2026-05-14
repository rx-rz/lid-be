import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";

import { UnauthorizedError } from "./error";

export const authMiddleware = new Elysia({ name: "middleware.auth" })
  .use(clerkPlugin())
  .resolve(({ auth }) => {
    const { userId } = auth();

    if (!userId) {
      throw new UnauthorizedError("Authentication required.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    return {
      currentUserId: userId,
    };
  })
  .as("scoped");
