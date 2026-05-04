import { Elysia, t } from "elysia";
import { premiumService } from "../premium/premium.services";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";

export const boostRoutes = new Elysia({ prefix: "/boost" })
  .use(routeRateLimit(rateLimitPresets.entitlementConsumption))
  .post(
    "/:userId",
    async ({ params: { userId } }) => {
      return await premiumService.boostUser(userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Premium"], summary: "Apply 24h Visibility Boost" },
    },
  );
