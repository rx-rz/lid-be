import { Elysia, t } from "elysia";
import { matchService } from "./match.services";

export const matchRoutes = new Elysia({ prefix: "/matches" }).get(
  "/:userId",
  async ({ params: { userId }, set }) => {
    try {
      const matches = await matchService.getMatches(userId);
      return matches;
    } catch (error: any) {
      set.status = error.message.includes("not found") ? 404 : 500;
      return { error: error.message || "Failed to fetch matches" };
    }
  },
  {
    params: t.Object({ userId: t.String() }),
    detail: { tags: ["Matches"], summary: "Get User Matches" },
  },
);
