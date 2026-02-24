import { Elysia, t } from "elysia";
import { premiumService } from "../premium/premium.services";

export const boostRoutes = new Elysia({ prefix: "/boost" }).post(
  "/:userId",
  async ({ params: { userId }, set }) => {
    try {
      return await premiumService.boostUser(userId);
    } catch (error: any) {
      set.status = 400;
      return { error: "Failed to apply boost" };
    }
  },
  {
    params: t.Object({ userId: t.String() }),
    detail: { tags: ["Premium"], summary: "Apply 24h Visibility Boost" },
  },
);
