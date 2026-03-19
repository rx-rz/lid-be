import { eq, sql, and, gt, inArray } from "drizzle-orm";
import { db } from "../db/db";
import { premiumFeaturesTable, type InsertPremiumFeature } from "../db/schema";

export const premiumFeatureRepo = {
  getFeaturesByUserId: async (userId: string) => {
    const [features] = await db
      .select()
      .from(premiumFeaturesTable)
      .where(eq(premiumFeaturesTable.userId, userId))
      .limit(1);

    return features;
  },
  getFeaturesByUserIds: async (userIds: string[]) => {
    if (!userIds.length) return [];

    return await db
      .select()
      .from(premiumFeaturesTable)
      .where(inArray(premiumFeaturesTable.userId, userIds));
  },
  upsertFeatures: async (
    userId: string,
    data: Partial<Omit<InsertPremiumFeature, "userId">>,
  ) => {
    const [features] = await db
      .insert(premiumFeaturesTable)
      .values({ userId, ...data } as InsertPremiumFeature)
      .onConflictDoUpdate({
        target: premiumFeaturesTable.userId,
        set: data,
      })
      .returning();

    return features;
  },

  useSuperLike: async (userId: string) => {
    const [updated] = await db
      .update(premiumFeaturesTable)
      .set({
        superlikesRemaining: sql`${premiumFeaturesTable.superlikesRemaining} - 1`,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(premiumFeaturesTable.superlikesRemaining, 0),
        ),
      )
      .returning();
    return updated;
  },

  useLoveLetter: async (userId: string) => {
    const [updated] = await db
      .update(premiumFeaturesTable)
      .set({
        loveLettersRemaining: sql`${premiumFeaturesTable.loveLettersRemaining} - 1`,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(premiumFeaturesTable.loveLettersRemaining, 0),
        ),
      )
      .returning();
    return updated;
  },

  useRecall: async (userId: string) => {
    const [updated] = await db
      .update(premiumFeaturesTable)
      .set({
        recallsRemaining: sql`${premiumFeaturesTable.recallsRemaining} - 1`,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(premiumFeaturesTable.recallsRemaining, 0),
        ),
      )
      .returning();
    return updated;
  },

  useVideoCall: async (userId: string) => {
    const [updated] = await db
      .update(premiumFeaturesTable)
      .set({
        videoCallsRemaining: sql`${premiumFeaturesTable.videoCallsRemaining} - 1`,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(premiumFeaturesTable.videoCallsRemaining, 0),
        ),
      )
      .returning();
    return updated;
  },

  useBoost: async (userId: string, durationMinutes: number = 30) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const [updated] = await db
      .update(premiumFeaturesTable)
      .set({
        boostsRemaining: sql`${premiumFeaturesTable.boostsRemaining} - 1`,
        visibilityBoost: true,
        lastBoostedAt: now,
        expiresAt: expiresAt,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(premiumFeaturesTable.boostsRemaining, 0),
        ),
      )
      .returning();

    return updated;
  },

  deactivateExpiredBoosts: async () => {
    const now = new Date();
    const updated = await db
      .update(premiumFeaturesTable)
      .set({ visibilityBoost: false, expiresAt: null })
      .where(
        and(
          eq(premiumFeaturesTable.visibilityBoost, true),
          sql`${premiumFeaturesTable.expiresAt} <= ${now}`,
        ),
      )
      .returning({ userId: premiumFeaturesTable.userId });

    return updated;
  },
};
