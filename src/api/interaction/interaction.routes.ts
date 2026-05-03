import { Elysia, t } from "elysia";
import { interactionService } from "./interaction.services";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";

const InteractionUserSchema = t.Nullable(
  t.Object({
    id: t.String(),
    name: t.Nullable(t.String()),
    email: t.Nullable(t.String()),
    age: t.Nullable(t.Number()),
  }),
);

const LikesListSchema = t.Array(
  t.Object({
    likedId: t.Optional(t.String()),
    userId: t.Optional(t.String()),
    likedAt: t.Union([t.Date(), t.String()]),
    superLike: t.Boolean(),
    images: t.Array(t.String()),
    user: InteractionUserSchema,
  }),
);

const ErrorSchema = t.Object({ error: t.String() });

export const interactionRoutes = new Elysia({ name: "routes.interaction" })
  .use(routeRateLimit(rateLimitPresets.interactions))
  .post(
    "/likes",
    async ({ body, set }) => {
      try {
        const result = await interactionService.likeUser(
          body.likerId,
          body.likedId,
          body.superLike,
        );
        set.status = 201;
        return result as any;
      } catch (error: any) {
        if (error.message?.startsWith("SWIPE_LIMIT_REACHED:")) {
          const resetTime = error.message.split(":").slice(1).join(":");
          set.status = 429;
          return { error: "Swipe limit reached", resetTime };
        }

        if (error.message === "INSUFFICIENT_SUPERLIKES") {
          set.status = 402;
          return {
            error: "You are out of Super Likes. Please upgrade or buy more.",
          };
        }

        set.status = error.message.includes("exist") ? 404 : 400;
        return { error: error.message || "Failed to process like" };
      }
    },
    {
      body: t.Object({
        likerId: t.String(),
        likedId: t.String(),
        superLike: t.Optional(t.Boolean()),
      }),
      response: {
        201: t.Any(),
        400: ErrorSchema,
        402: ErrorSchema,
        404: ErrorSchema,
        429: t.Object({ error: t.String(), resetTime: t.String() }),
      },
      detail: { tags: ["Interactions"], summary: "Like a User" },
    },
  )
  .get(
    "/likes/:userId",
    async ({ params: { userId }, set }) => {
      try {
        const likedUsers = await interactionService.getLikedUsers(userId);
        return likedUsers as any;
      } catch (error: any) {
        set.status = 500;
        return { error: "Failed to fetch liked users" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: LikesListSchema,
        500: ErrorSchema,
      },
      detail: {
        tags: ["Interactions"],
        summary: "Get Users the Current User Liked",
      },
    },
  )
  .get(
    "/likes/received/:userId",
    async ({ params: { userId }, set }) => {
      try {
        const receivedLikes = await interactionService.getReceivedLikes(userId);
        return receivedLikes as any;
      } catch (error: any) {
        set.status = 500;
        return { error: "Failed to fetch received likes" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: LikesListSchema,
        500: ErrorSchema,
      },
      detail: {
        tags: ["Interactions"],
        summary: "Get Users Who Liked the Current User",
      },
    },
  )

  .post(
    "/dislikes",
    async ({ body, set }) => {
      try {
        const dislike = await interactionService.dislikeUser(
          body.dislikerId,
          body.dislikedId,
        );
        set.status = 201;
        return dislike as any;
      } catch (error: any) {
        if (error.message?.startsWith("SWIPE_LIMIT_REACHED:")) {
          const resetTime = error.message.split(":").slice(1).join(":");
          set.status = 429;
          return { error: "Swipe limit reached", resetTime };
        }
        set.status = error.message.includes("exist") ? 404 : 400;
        return { error: error.message || "Failed to process dislike" };
      }
    },
    {
      body: t.Object({
        dislikerId: t.String(),
        dislikedId: t.String(),
      }),
      response: {
        201: t.Any(),
        400: ErrorSchema,
        404: ErrorSchema,
        429: t.Object({ error: t.String(), resetTime: t.String() }),
      },
      detail: { tags: ["Interactions"], summary: "Dislike a User" },
    },
  ) 
  .post(
    "/dislikes/rewind",
    async ({ body, set }) => {
      try {
        const result = await interactionService.rewindDislike(
          body.userId,
          body.dislikedId,
        );
        set.status = 200;
        return result;
      } catch (error: any) {
        // Handle the empty wallet error
        if (error.message === "INSUFFICIENT_RECALLS") {
          set.status = 402;
          return {
            error: "You are out of Recalls. Please upgrade or buy more.",
          };
        }

        set.status = error.message.includes("found") ? 404 : 400;
        return { error: error.message || "Failed to rewind dislike" };
      }
    },
    {
      body: t.Object({
        userId: t.String(),
        dislikedId: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          recallsRemaining: t.Number(),
        }),
        400: ErrorSchema,
        402: ErrorSchema,
        404: ErrorSchema,
      },
      detail: { tags: ["Interactions"], summary: "Rewind (Undo) a Dislike" },
    },
  );
