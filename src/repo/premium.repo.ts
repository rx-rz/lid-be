import { eq, sql, and, gt, inArray } from "drizzle-orm";
import { db, DrizzleDB, withDb } from "../db/db";
import {
  premiumFeaturesTable,
  type InsertPremiumFeature,
  type SubscriptionTier,
} from "../db/schema";
import type { AddOnType } from "../constants/addons";
import { entitlementService, type EntitlementFeature } from "../services/entitlements";

const featureColumns = {
  superlikes: {
    subscriptionKey: "superlikesRemaining",
    subscription: premiumFeaturesTable.superlikesRemaining,
    addOnKey: "addOnSuperlikesRemaining",
    addOn: premiumFeaturesTable.addOnSuperlikesRemaining,
  },
  boosts: {
    subscriptionKey: "boostsRemaining",
    subscription: premiumFeaturesTable.boostsRemaining,
    addOnKey: "addOnBoostsRemaining",
    addOn: premiumFeaturesTable.addOnBoostsRemaining,
  },
  loveLetters: {
    subscriptionKey: "loveLettersRemaining",
    subscription: premiumFeaturesTable.loveLettersRemaining,
    addOnKey: "addOnLoveLettersRemaining",
    addOn: premiumFeaturesTable.addOnLoveLettersRemaining,
  },
  recalls: {
    subscriptionKey: "recallsRemaining",
    subscription: premiumFeaturesTable.recallsRemaining,
    addOnKey: "addOnRecallsRemaining",
    addOn: premiumFeaturesTable.addOnRecallsRemaining,
  },
  videoCalls: {
    subscriptionKey: "videoCallsRemaining",
    subscription: premiumFeaturesTable.videoCallsRemaining,
    addOnKey: "addOnVideoCallsRemaining",
    addOn: premiumFeaturesTable.addOnVideoCallsRemaining,
  },
} as const;

const addOnTypeToFeature = (type: AddOnType): EntitlementFeature | null => {
  switch (type) {
    case "super_likes":
      return "superlikes";
    case "takeoff":
      return "boosts";
    case "love_letters":
      return "loveLetters";
    case "recalls":
      return "recalls";
    case "cruise_calls":
      return "videoCalls";
    case "cruise_pass":
      return null;
  }
};

const nextWeeklyReset = (from: Date) =>
  new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

const nextMonthlyReset = (from: Date) =>
  new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate(), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));

const subscriptionAllowanceFields = (
  tier: SubscriptionTier,
  resetAt = new Date(),
) => {
  const limits = entitlementService.getEntitlementsForTier(tier);

  return {
    superlikesRemaining: limits.superLikesPerWeek,
    boostsRemaining: limits.boostsPerWeek,
    loveLettersRemaining: limits.loveLettersPerWeek,
    recallsRemaining:
      limits.recallsPerWeek === "unlimited" ? 0 : limits.recallsPerWeek,
    videoCallsRemaining:
      limits.videoCalls === "unlimited" ? 0 : limits.videoCalls,
    subscriptionLastWeeklyResetAt: tier === "economy" ? null : resetAt,
    subscriptionNextWeeklyResetAt:
      tier === "economy" ? null : nextWeeklyReset(resetAt),
    subscriptionLastMonthlyResetAt:
      tier === "premium" ? resetAt : null,
    subscriptionNextMonthlyResetAt:
      tier === "premium" ? nextMonthlyReset(resetAt) : null,
  };
};

export const premiumFeatureRepo = {
  getFeaturesByUserId: async (userId: string, tx?: DrizzleDB) => {
    const dbInstance = withDb(tx);
    const [features] = await dbInstance
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
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const [features] = await dbInstance
      .insert(premiumFeaturesTable)
      .values({ userId, ...data } as InsertPremiumFeature)
      .onConflictDoUpdate({
        target: premiumFeaturesTable.userId,
        set: data,
      })
      .returning();

    return features;
  },

  ensureSubscriptionAllowances: async (
    userId: string,
    tier: SubscriptionTier,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const existing = await premiumFeatureRepo.getFeaturesByUserId(userId, tx);
    if (existing) return existing;

    const [features] = await dbInstance
      .insert(premiumFeaturesTable)
      .values({
        userId,
        ...subscriptionAllowanceFields(tier),
      } as InsertPremiumFeature)
      .onConflictDoNothing({ target: premiumFeaturesTable.userId })
      .returning();

    return features || (await premiumFeatureRepo.getFeaturesByUserId(userId, tx));
  },

  consumeFeature: async (
    userId: string,
    feature: EntitlementFeature,
    options: { unlimited?: boolean; activateBoost?: boolean; tx?: DrizzleDB } = {},
  ) => {
    const dbInstance = withDb(options.tx);
    if (options.unlimited) {
      const features =
        (await premiumFeatureRepo.getFeaturesByUserId(userId, options.tx)) ||
        (await premiumFeatureRepo.upsertFeatures(userId, {}, options.tx));

      return { source: "unlimited" as const, features };
    }

    if (
      feature === "videoCalls" &&
      (await premiumFeatureRepo.hasActiveCruisePass(userId))
    ) {
      const features =
        (await premiumFeatureRepo.getFeaturesByUserId(userId, options.tx)) ||
        (await premiumFeatureRepo.upsertFeatures(userId, {}, options.tx));

      return { source: "unlimited" as const, features };
    }

    const columns = featureColumns[feature];
    const now = new Date();
    const boostFields = options.activateBoost
      ? {
          visibilityBoost: true,
          lastBoostedAt: now,
          expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        }
      : {};

    const [subscriptionUpdate] = await dbInstance
      .update(premiumFeaturesTable)
      .set({
        [columns.subscriptionKey]: sql`${columns.subscription} - 1`,
        ...boostFields,
      })
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          gt(columns.subscription, 0),
        ),
      )
      .returning();

    if (subscriptionUpdate) {
      return { source: "subscription" as const, features: subscriptionUpdate };
    }

    const [addOnUpdate] = await dbInstance
      .update(premiumFeaturesTable)
      .set({
        [columns.addOnKey]: sql`${columns.addOn} - 1`,
        ...boostFields,
      })
      .where(
        and(eq(premiumFeaturesTable.userId, userId), gt(columns.addOn, 0)),
      )
      .returning();

    if (addOnUpdate) {
      return { source: "add-on" as const, features: addOnUpdate };
    }

    return null;
  },

  addAddonCredits: async (
    userId: string,
    type: AddOnType,
    quantity: number | "unlimited",
  ) => {
    if (type === "cruise_pass") {
      return await premiumFeatureRepo.upsertFeatures(userId, {
        hasActiveCruisePass: true,
        cruisePassExpiresAt: nextMonthlyReset(new Date()),
      });
    }

    if (quantity === "unlimited") {
      return await premiumFeatureRepo.getFeaturesByUserId(userId);
    }

    const feature = addOnTypeToFeature(type);
    if (!feature) return await premiumFeatureRepo.getFeaturesByUserId(userId);

    const column = featureColumns[feature].addOn;
    const columnKey = featureColumns[feature].addOnKey;
    const [features] = await db
      .insert(premiumFeaturesTable)
      .values({
        userId,
        [columnKey]: quantity,
      } as InsertPremiumFeature)
      .onConflictDoUpdate({
        target: premiumFeaturesTable.userId,
        set: {
          [columnKey]: sql`${column} + ${quantity}`,
        },
      })
      .returning();

    return features;
  },

  hasActiveCruisePass: async (userId: string) => {
    const now = new Date();
    const [features] = await db
      .select()
      .from(premiumFeaturesTable)
      .where(
        and(
          eq(premiumFeaturesTable.userId, userId),
          eq(premiumFeaturesTable.hasActiveCruisePass, true),
          sql`(${premiumFeaturesTable.cruisePassExpiresAt} IS NULL OR ${premiumFeaturesTable.cruisePassExpiresAt} > ${now})`,
        ),
      )
      .limit(1);

    return Boolean(features);
  },

  resetSubscriptionAllowances: async (
    userIds: string[],
    tier: SubscriptionTier,
    cadence: "weekly" | "monthly",
    resetAt = new Date(),
  ) => {
    if (!userIds.length) return [];

    const limits = entitlementService.getEntitlementsForTier(tier);
    const weeklyFields =
      cadence === "weekly"
        ? {
            superlikesRemaining: limits.superLikesPerWeek,
            boostsRemaining: limits.boostsPerWeek,
            loveLettersRemaining: limits.loveLettersPerWeek,
            recallsRemaining:
              limits.recallsPerWeek === "unlimited" ? 0 : limits.recallsPerWeek,
            subscriptionLastWeeklyResetAt: resetAt,
            subscriptionNextWeeklyResetAt: nextWeeklyReset(resetAt),
          }
        : {};
    const monthlyFields =
      cadence === "monthly" && limits.videoCalls !== "unlimited"
        ? {
            videoCallsRemaining: limits.videoCalls,
            subscriptionLastMonthlyResetAt: resetAt,
            subscriptionNextMonthlyResetAt: nextMonthlyReset(resetAt),
          }
        : cadence === "monthly"
          ? {
              subscriptionLastMonthlyResetAt: resetAt,
              subscriptionNextMonthlyResetAt: nextMonthlyReset(resetAt),
            }
          : {};

    return await db
      .update(premiumFeaturesTable)
      .set({ ...weeklyFields, ...monthlyFields })
      .where(inArray(premiumFeaturesTable.userId, userIds))
      .returning();
  },

  clearSubscriptionAllowances: async (userId: string) => {
    return await premiumFeatureRepo.upsertFeatures(userId, {
      superlikesRemaining: 0,
      boostsRemaining: 0,
      loveLettersRemaining: 0,
      recallsRemaining: 0,
      videoCallsRemaining: 0,
      subscriptionNextWeeklyResetAt: null,
      subscriptionNextMonthlyResetAt: null,
    });
  },

  clearCruisePass: async (userId: string) => {
    return await premiumFeatureRepo.upsertFeatures(userId, {
      hasActiveCruisePass: false,
      cruisePassExpiresAt: null,
    });
  },

  useSuperLike: async (userId: string, tx?: DrizzleDB) => {
    const consumed = await premiumFeatureRepo.consumeFeature(userId, "superlikes", {
      tx,
    });
    return consumed?.features;
  },

  useLoveLetter: async (userId: string, tx?: DrizzleDB) => {
    const consumed = await premiumFeatureRepo.consumeFeature(
      userId,
      "loveLetters",
      { tx },
    );
    return consumed?.features;
  },

  useRecall: async (userId: string, tx?: DrizzleDB) => {
    const consumed = await premiumFeatureRepo.consumeFeature(userId, "recalls", {
      tx,
    });
    return consumed?.features;
  },

  useVideoCall: async (userId: string, tx?: DrizzleDB) => {
    const consumed = await premiumFeatureRepo.consumeFeature(
      userId,
      "videoCalls",
      { tx },
    );
    return consumed?.features;
  },

  useBoost: async (
    userId: string,
    durationMinutes: number = 30,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const now = new Date();
    const consumed = await premiumFeatureRepo.consumeFeature(userId, "boosts", {
      tx,
    });

    if (!consumed) return undefined;

    const [updated] = await dbInstance
      .update(premiumFeaturesTable)
      .set({
        visibilityBoost: true,
        lastBoostedAt: now,
        expiresAt: new Date(now.getTime() + durationMinutes * 60 * 1000),
      })
      .where(eq(premiumFeaturesTable.userId, userId))
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
