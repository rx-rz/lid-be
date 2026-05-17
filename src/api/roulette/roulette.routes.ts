import { Elysia, t } from "elysia";
import { rouletteService } from "./roulette.services";
import { authMiddleware } from "../../middleware/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../middleware/error";

export const rouletteRoutes = new Elysia({ prefix: "/roulette" })
  .use(authMiddleware)
  .post(
    "/start",
    async ({ currentUserId }) => {
      const result = await rouletteService.findMatch(currentUserId);

      if ("alreadyMatched" in result || "alreadyWaiting" in result) {
        throw new ConflictError(result.message, {
          code: "ROULETTE_SESSION_ALREADY_ACTIVE",
        });
      }

      return { success: true, ...result };
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
    async ({ currentUserId }) => {
      return await rouletteService.getDetails(currentUserId);
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
    async ({ body, currentUserId }) => {
      if (!body.matchId && !currentUserId) {
        throw new BadRequestError("Either matchId or userId is required.", {
          code: "ROULETTE_END_TARGET_REQUIRED",
        });
      }

      const result = await rouletteService.endSession(
        body.matchId,
        currentUserId,
      );

      if (!result.success && result.error === "no_active_match") {
        throw new NotFoundError(result.message, {
          code: "ROULETTE_ACTIVE_MATCH_NOT_FOUND",
        });
      }

      return result;
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
    async ({ currentUserId }) => {
      return await rouletteService.getStatus(currentUserId);
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
    async ({ currentUserId }) => {
      return await rouletteService.cancelSearch(currentUserId);
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
    async ({ currentUserId, query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      return await rouletteService.getHistory(currentUserId, limit);
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({ limit: t.Optional(t.String()) }),
      detail: { tags: ["Roulette"], summary: "Get match history" },
    },
  )
  .post(
    "/cleanup",
    async () => {
      return await rouletteService.cleanupExpired();
    },
    {
      detail: { tags: ["Roulette"], summary: "Cleanup expired matches" },
    },
  )
  .get(
    "/stats",
    async () => {
      return await rouletteService.getStats();
    },
    {
      detail: {
        tags: ["Roulette"],
        summary: "Get analytics and statistics for roulette system",
      },
    },
  );
