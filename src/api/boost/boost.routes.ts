import { Elysia, t } from "elysia";
import { premiumService } from "../premium/premium.services";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";
import { authMiddleware } from "../../middleware/auth";

export const boostRoutes = new Elysia({ prefix: "/boost" })
  .use(authMiddleware)
  .use(routeRateLimit(rateLimitPresets.entitlementConsumption))
  .post(
    "/:userId",
    async ({ currentUserId }) => {
      return await premiumService.boostUser(currentUserId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Premium"], summary: "Apply 24h Visibility Boost" },
    },
  );
