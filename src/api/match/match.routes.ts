import { Elysia, t } from "elysia";
import { matchService } from "./match.services";
import { authMiddleware } from "../../middleware/auth";

export const matchRoutes = new Elysia({ prefix: "/matches" })
  .use(authMiddleware)
  .get(
    "/:userId",
    async ({ currentUserId }) => {
      const matches = await matchService.getMatches(currentUserId);
      return matches;
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Matches"], summary: "Get User Matches" },
    },
  );
