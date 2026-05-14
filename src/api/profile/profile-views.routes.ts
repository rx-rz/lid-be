import { Elysia, t } from "elysia";
import { profileViewsService } from "./profile-views.services";
import { authMiddleware } from "../../middleware/auth";

export const profileViewsRoutes = new Elysia({ prefix: "/profile-views" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, currentUserId, set }) => {
      const view = await profileViewsService.recordView(
        currentUserId,
        body.viewedId,
      );
      set.status = 201;
      return view;
    },
    {
      body: t.Object({
        viewerId: t.String(),
        viewedId: t.String(),
      }),
      detail: {
        tags: ["Profile Views"],
        summary: "Record Profile View",
        description:
          "Records a profile view from one user to another and triggers real-time notifications.",
      },
    },
  )
  .get(
    "/:userId",
    async ({ currentUserId, query }) => {
      const limit = query.limit ? Number(query.limit) : 20;
      const offset = query.offset ? Number(query.offset) : 0;
      const markAsSeen = query.markAsSeen === "true";

      const views = await profileViewsService.getViews(
        currentUserId,
        limit,
        offset,
        markAsSeen,
      );
      return views;
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        markAsSeen: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Profile Views"],
        summary: "Get Profile Views",
        description:
          "Retrieves deduplicated list of users who viewed the specified user's profile.",
      },
    },
  )
  .delete(
    "/",
    async () => {
      const result = await profileViewsService.clearOldViews();
      return { deletedCount: result?.rowCount || 0, success: true };
    },
    {
      detail: {
        tags: ["Profile Views"],
        summary: "Cleanup Old Profile Views",
        description: "Deletes profile views older than 7 days.",
      },
    },
  );
