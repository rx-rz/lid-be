import { Elysia, t } from "elysia";
import { favoriteService } from "./favorite.services";
import { authMiddleware } from "../../middleware/auth";

export const favoriteRoutes = new Elysia({ prefix: "/favorites" })
  .use(authMiddleware)
  .post(
    "/",
    ({ body, currentUserId }) =>
      favoriteService.add(currentUserId, body.favoriteUserId),
    {
      body: t.Object({ userId: t.String(), favoriteUserId: t.String() }),
      detail: { tags: ["Social"], summary: "Add to favorites" },
    },
  )
  .get("/:userId", ({ currentUserId }) => favoriteService.get(currentUserId), {
    params: t.Object({ userId: t.String() }),
    detail: { tags: ["Social"], summary: "Get user favorites" },
  })
  .delete(
    "/:userId/:favoriteUserId",
    ({ params: { favoriteUserId }, currentUserId }) =>
      favoriteService.remove(currentUserId, favoriteUserId),
    {
      params: t.Object({ userId: t.String(), favoriteUserId: t.String() }),
      detail: { tags: ["Social"], summary: "Remove from favorites" },
    },
  );
