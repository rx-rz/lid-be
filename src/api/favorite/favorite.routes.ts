import { Elysia, t } from "elysia";
import { favoriteService } from "./favorite.services";

export const favoriteRoutes = new Elysia({ prefix: "/favorites" })
  .post(
    "/",
    ({ body }) => favoriteService.add(body.userId, body.favoriteUserId),
    {
      body: t.Object({ userId: t.String(), favoriteUserId: t.String() }),
      detail: { tags: ["Social"], summary: "Add to favorites" },
    },
  )
  .get("/:userId", ({ params: { userId } }) => favoriteService.get(userId), {
    params: t.Object({ userId: t.String() }),
    detail: { tags: ["Social"], summary: "Get user favorites" },
  })
  .delete(
    "/:userId/:favoriteUserId",
    ({ params: { userId, favoriteUserId } }) =>
      favoriteService.remove(userId, favoriteUserId),
    {
      params: t.Object({ userId: t.String(), favoriteUserId: t.String() }),
      detail: { tags: ["Social"], summary: "Remove from favorites" },
    },
  );
