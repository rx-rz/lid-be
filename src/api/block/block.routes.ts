import { Elysia, t } from "elysia";
import { blockService } from "./block.services";

export const blockRoutes = new Elysia({ prefix: "/block" }).post(
  "/",
  async ({ body, set }) => {
    try {
      return await blockService.blockUser(body.blockerId, body.blockedId);
    } catch (error: any) {
      set.status = 400;
      return { error: error.message };
    }
  },
  {
    body: t.Object({ blockerId: t.String(), blockedId: t.String() }),
    detail: { tags: ["Safety"], summary: "Block a User" },
  },
);
