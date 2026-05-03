import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { usersTable } from "../db/schema";
import type { SubscriptionTier } from "../db/schema";
import { logger } from "../utils/logger";
import { premiumFeatureRepo } from "../repo/premium.repo";

export const runMonthlyAllowanceReset = async () => {
  logger.info("starting monthly premium allowance reset");

  const monthlyTiers: SubscriptionTier[] = ["premium"];

  for (const tier of monthlyTiers) {
    try {
      const usersInTier = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.subscriptionType, tier));

      const userIds = usersInTier.map((u) => u.id);

      if (userIds.length === 0) {
        logger.info({ tier }, "no users found for monthly reset; skipping");
        continue;
      }

      await premiumFeatureRepo.resetSubscriptionAllowances(
        userIds,
        tier,
        "monthly",
      );

      logger.info(
        { tier, userCount: userIds.length },
        "monthly allowances reset",
      );
    } catch (error) {
      logger.error({ err: error, tier }, "error resetting monthly allowances");
    }
  }

  logger.info("monthly allowance reset complete");
};

if (require.main === module) {
  runMonthlyAllowanceReset().then(() => process.exit(0));
}
