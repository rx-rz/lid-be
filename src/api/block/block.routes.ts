import { Elysia, t } from "elysia";
import { blockService } from "./block.services";

export const blockRoutes = new Elysia({ prefix: "/block" }).post(
  "/",
  async ({ body }) => {
    return await blockService.blockUser(body.blockerId, body.blockedId);
  },
  {
    body: t.Object({ blockerId: t.String(), blockedId: t.String() }),
    detail: { tags: ["Safety"], summary: "Block a User" },
  },
);
