import { Elysia, t } from "elysia";
import { rouletteService } from "./roulette.services";
import { clerkPlugin } from "elysia-clerk";
import { loggers } from "../../utils/logger";

export const rouletteRoutes = new Elysia({ prefix: "/roulette" })
  .use(clerkPlugin())
  .post(
    "/start",
    async ({ body, set }) => {
      try {
        const result = await rouletteService.findMatch(body.userId);

        if ("alreadyMatched" in result || "alreadyWaiting" in result) {
          set.status = 409;
        }

        return { success: true, ...result };
      } catch (error) {
        loggers.roulette.error({ err: error }, "failed to start roulette");
        set.status = 500;
        return {
          success: false,
          error: "Failed to start roulette",
          message: "An unexpected error occurred. Please try again later.",
        };
      }
    },
    {
      body: t.Object({
        userId: t.String(),
        genderPreference: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Roulette"],
        summary: "Start or find video roulette match",
      },
    },
  )
  .get(
    "/details/:userId",
    async ({ params: { userId }, set }) => {
      try {
        return await rouletteService.getDetails(userId);
      } catch (error) {
        loggers.roulette.error({ err: error, userId }, "failed to get roulette details");
        set.status = 500;
        return {
          success: false,
          error: "Failed to get roulette details",
          message: "An unexpected error occurred while fetching details.",
        };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        tags: ["Roulette"],
        summary: "Get roulette details for a user",
      },
    },
  )
  .post(
    "/end",
    async ({ body, set }) => {
      if (!body.matchId && !body.userId) {
        set.status = 400;
        return {
          success: false,
          error: "Either matchId or userId is required",
        };
      }

      try {
        const result = await rouletteService.endSession(
          body.matchId,
          body.userId,
        );

        if (!result.success && result.error === "no_active_match") {
          set.status = 404;
        }

        return result;
      } catch (error) {
        loggers.roulette.error({ err: error }, "failed to end roulette session");
        set.status = 500;
        return {
          success: false,
          error: "Failed to end session",
          message: "An unexpected error occurred while ending the session.",
        };
      }
    },
    {
      body: t.Object({
        matchId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: { tags: ["Roulette"], summary: "End roulette match manually" },
    },
  )
  .get(
    "/status/:userId",
    async ({ params: { userId }, set }) => {
      try {
        return await rouletteService.getStatus(userId);
      } catch (error) {
        loggers.roulette.error({ err: error, userId }, "failed to get roulette status");
        set.status = 500;
        return {
          success: false,
          error: "Failed to get status",
          message: "An unexpected error occurred while checking status.",
        };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        tags: ["Roulette"],
        summary: "Get session status with enhanced details",
      },
    },
  )
  .post(
    "/cancel",
    async ({ body, set }) => {
      try {
        return await rouletteService.cancelSearch(body.userId);
      } catch (error) {
        loggers.roulette.error({ err: error }, "failed to cancel roulette");
        set.status = 500;
        return {
          success: false,
          error: "Failed to cancel search or match",
          message: "An unexpected error occurred.",
        };
      }
    },
    {
      body: t.Object({ userId: t.String() }),
      detail: {
        tags: ["Roulette"],
        summary: "Cancel roulette search or current match",
      },
    },
  )
  .get(
    "/history/:userId",
    async ({ params: { userId }, query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 20;
        return await rouletteService.getHistory(userId, limit);
      } catch (error) {
        loggers.roulette.error({ err: error, userId }, "failed to get roulette history");
        set.status = 500;
        return {
          success: false,
          error: "Failed to get history",
          message: "An unexpected error occurred while fetching match history.",
        };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({ limit: t.Optional(t.String()) }),
      detail: { tags: ["Roulette"], summary: "Get match history" },
    },
  )
  .post(
    "/cleanup",
    async ({ set }) => {
      try {
        return await rouletteService.cleanupExpired();
      } catch (error) {
        loggers.roulette.error({ err: error }, "failed to clean up roulette matches");
        set.status = 500;
        return {
          success: false,
          error: "Failed to clean up expired matches",
          message: "An unexpected error occurred during cleanup.",
        };
      }
    },
    {
      detail: { tags: ["Roulette"], summary: "Cleanup expired matches" },
    },
  )
  .get(
    "/stats",
    async ({ set }) => {
      try {
        return await rouletteService.getStats();
      } catch (error) {
        loggers.roulette.error({ err: error }, "failed to get roulette stats");
        set.status = 500;
        return {
          success: false,
          error: "Failed to get statistics",
          message: "An unexpected error occurred while fetching statistics.",
        };
      }
    },
    {
      detail: {
        tags: ["Roulette"],
        summary: "Get analytics and statistics for roulette system",
      },
    },
  );
