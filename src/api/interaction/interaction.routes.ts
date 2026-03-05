import { Elysia, t } from "elysia";
import { interactionService } from "./interaction.services";

export const interactionRoutes = new Elysia()
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
        return result;
      } catch (error: any) {
        if (error.message?.startsWith("SWIPE_LIMIT_REACHED:")) {
          const resetTime = error.message.split(":").slice(1).join(":");
          set.status = 429;
          return { error: "Swipe limit reached", resetTime };
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
      detail: { tags: ["Interactions"], summary: "Like a User" },
    },
  )
  .get(
    "/likes/:userId",
    async ({ params: { userId }, set }) => {
      try {
        const likedUsers = await interactionService.getLikedUsers(userId);
        return likedUsers;
      } catch (error: any) {
        set.status = 500;
        return { error: "Failed to fetch liked users" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
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
        return receivedLikes;
      } catch (error: any) {
        set.status = 500;
        return { error: "Failed to fetch received likes" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
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
        return dislike;
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
      detail: { tags: ["Interactions"], summary: "Dislike a User" },
    },
  );
