import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { premiumFeaturesTable } from "../db/schema";

export const premiumRepo = {
  upsertBoost: async (userId: string, expiresAt: Date) => {
    const [boost] = await db
      .insert(premiumFeaturesTable)
      .values({
        userId,
        visibilityBoost: true,
        expiresAt,
        lastBoostedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: premiumFeaturesTable.userId,
        set: {
          visibilityBoost: true,
          expiresAt,
          lastBoostedAt: new Date(),
        },
      })
      .returning();
    return boost;
  },

  getPremiumStatus: async (userId: string) => {
    const [status] = await db
      .select()
      .from(premiumFeaturesTable)
      .where(eq(premiumFeaturesTable.userId, userId))
      .limit(1);
    return status;
  },
};
