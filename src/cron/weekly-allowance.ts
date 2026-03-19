// cron/weekly-allowance.ts
import { db } from "../db/db";
import { premiumFeaturesTable, usersTable } from "../db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { logger } from "../utils/logger";
import type { SubscriptionTier } from "../db/schema";
import { TIER_PERMISSIONS } from "../utils/permissions";

export const runWeeklyAllowanceTopUp = async () => {
  logger.info("🚀 Starting weekly premium features top-up...");

  // We only need to top up paid tiers. Economy doesn't get weekly drops.
  const paidTiers: SubscriptionTier[] = [
    "premium-economy",
    "first-class",
    "weekender",
  ];

  for (const tier of paidTiers) {
    const limits = TIER_PERMISSIONS[tier];

    try {
      // 1. Find all users currently on this tier
      const usersInTier = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.subscriptionType, tier));

      const userIds = usersInTier.map((u) => u.id);

      if (userIds.length === 0) {
        logger.info(`No users found for ${tier} tier. Skipping.`);
        continue;
      }

      // 2. Safely top up their wallets using GREATEST
      await db
        .update(premiumFeaturesTable)
        .set({
          // If they have 0, they get the weekly limit.
          // If they have 20 (from buying an add-on), they keep 20.
          superlikesRemaining: sql`GREATEST(${premiumFeaturesTable.superlikesRemaining}, ${limits.superLikesPerWeek})`,
          boostsRemaining: sql`GREATEST(${premiumFeaturesTable.boostsRemaining}, ${limits.boostsPerWeek})`,
          loveLettersRemaining: sql`GREATEST(${premiumFeaturesTable.loveLettersRemaining}, ${limits.loveLettersPerWeek})`,

          // Only top up video calls if they aren't unlimited for this tier (mostly a failsafe, as paid tiers are unlimited)
          videoCallsRemaining:
            limits.videoCalls === "unlimited"
              ? premiumFeaturesTable.videoCallsRemaining
              : sql`GREATEST(${premiumFeaturesTable.videoCallsRemaining}, ${limits.videoCalls})`,
        })
        .where(inArray(premiumFeaturesTable.userId, userIds));

      logger.info(
        `✅ Successfully topped up ${userIds.length} users on ${tier}`,
      );
    } catch (error) {
      logger.error(`❌ Error topping up ${tier}: ${error}`,);
    }
  }

  logger.info("✨ Weekly top-up complete.");
};

// If running this file directly via a cron scheduler (like Heroku Scheduler or node-cron)
if (require.main === module) {
  runWeeklyAllowanceTopUp().then(() => process.exit(0));
}
