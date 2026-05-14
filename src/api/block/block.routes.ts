import { Elysia, t } from "elysia";
import { blockService } from "./block.services";
import { authMiddleware } from "../../middleware/auth";

export const blockRoutes = new Elysia({ prefix: "/block" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, currentUserId }) => {
      return await blockService.blockUser(currentUserId, body.blockedId);
    },
    {
      body: t.Object({ blockerId: t.String(), blockedId: t.String() }),
      detail: { tags: ["Safety"], summary: "Block a User" },
    },
  );
