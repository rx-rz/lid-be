import { Elysia, t } from "elysia";
import { matchService } from "./match.services";

export const matchRoutes = new Elysia({ prefix: "/matches" }).get(
  "/:userId",
  async ({ params: { userId } }) => {
    const matches = await matchService.getMatches(userId);
    return matches;
  },
  {
    params: t.Object({ userId: t.String() }),
    detail: { tags: ["Matches"], summary: "Get User Matches" },
  },
);
