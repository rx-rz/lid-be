import { Elysia, t } from "elysia";
import { interactionService } from "./interaction.services";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";
import { ErrorResponseSchema } from "../../middleware/error";
import { authMiddleware } from "../../middleware/auth";

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
    isLoveLetter: t.Boolean(),
    images: t.Array(t.String()),
    user: InteractionUserSchema,
  }),
);

export const interactionRoutes = new Elysia({ name: "routes.interaction" })
  .use(authMiddleware)
  .use(routeRateLimit(rateLimitPresets.interactions))
  .post(
    "/likes",
    async ({ body, currentUserId, set }) => {
      const result = await interactionService.likeUser(
        currentUserId,
        body.likedId,
        body.superLike,
        body.isLoveLetter,
      );
      set.status = 201;
      return result as any;
    },
    {
      body: t.Object({
        likerId: t.String(),
        likedId: t.String(),
        superLike: t.Optional(t.Boolean()),
        isLoveLetter: t.Optional(t.Boolean()),
      }),
      response: {
        201: t.Any(),
        400: ErrorResponseSchema,
        402: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        429: ErrorResponseSchema,
      },
      detail: { tags: ["Interactions"], summary: "Like a User" },
    },
  )
  .get(
    "/likes/:userId",
    async ({ currentUserId }) => {
      const likedUsers = await interactionService.getLikedUsers(currentUserId);
      return likedUsers as any;
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: LikesListSchema,
        500: ErrorResponseSchema,
      },
      detail: {
        tags: ["Interactions"],
        summary: "Get Users the Current User Liked",
      },
    },
  )
  .get(
    "/likes/received/:userId",
    async ({ currentUserId }) => {
      const receivedLikes =
        await interactionService.getReceivedLikes(currentUserId);
      return receivedLikes as any;
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: LikesListSchema,
        500: ErrorResponseSchema,
      },
      detail: {
        tags: ["Interactions"],
        summary: "Get Users Who Liked the Current User",
      },
    },
  )

  .post(
    "/dislikes",
    async ({ body, currentUserId, set }) => {
      const dislike = await interactionService.dislikeUser(
        currentUserId,
        body.dislikedId,
      );
      set.status = 201;
      return dislike as any;
    },
    {
      body: t.Object({
        dislikerId: t.String(),
        dislikedId: t.String(),
      }),
      response: {
        201: t.Any(),
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        429: ErrorResponseSchema,
      },
      detail: { tags: ["Interactions"], summary: "Dislike a User" },
    },
  ) 
  .post(
    "/dislikes/rewind",
    async ({ body, currentUserId, set }) => {
      const result = await interactionService.rewindDislike(
        currentUserId,
        body.dislikedId,
      );
      set.status = 200;
      return result;
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
        400: ErrorResponseSchema,
        402: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      detail: { tags: ["Interactions"], summary: "Rewind (Undo) a Dislike" },
    },
  );
