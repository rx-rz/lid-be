import { Elysia, t } from "elysia";
import { rouletteService } from "./roulette.services";

export const rouletteRoutes = new Elysia({ prefix: "/roulette" }).post(
  "/start",
  async ({ body, set }) => {
    const result = await rouletteService.findMatch(
      body.userId,
      body.genderFilter,
    );
    if (result.alreadyMatched || result.alreadyWaiting) set.status = 409;
    return result;
  },
  {
    body: t.Object({
      userId: t.String(),
      genderFilter: t.Optional(t.String()),
    }),
    detail: { tags: ["Social"], summary: "Start or find video roulette match" },
  },
);
