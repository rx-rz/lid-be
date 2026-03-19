
import { premiumFeatureRepo } from "../../repo/premium.repo";
import { cacheUtils } from "../../utils/cache.utils";
import { logger } from "../../utils/logger";

export const premiumService = {
  // NEW: Safely deducts a boost from the wallet
  boostUser: async (userId: string) => {
    // Check wallet and deduct atomically (defaults to 30 mins)
    const updatedWallet = await premiumFeatureRepo.useBoost(userId, 30);
    
    // If the repo returns undefined, it means the `gt(boostsRemaining, 0)` check failed
    if (!updatedWallet) {
      throw new Error("INSUFFICIENT_BOOSTS");
    }

    logger.info(`[Premium] User ${userId} activated Takeoff Boost. ${updatedWallet.boostsRemaining} remaining.`);
    
    // Clear their cache so they show up higher in discovery feeds immediately
    await cacheUtils.invalidateUserDiscoveryCache(userId);
    
    return updatedWallet;
  },

  getBoostMultiplier: async (userId: string): Promise<number> => {
    // Updated to use the new repo method name
    const premium = await premiumFeatureRepo.getFeaturesByUserId(userId);
    
    if (!premium || !premium.visibilityBoost) return 1;
    
    // If the boost expired, return normal multiplier
    if (premium.expiresAt && new Date(premium.expiresAt) < new Date()) {
      return 1;
    }

    let multiplier = 3;
    // Extra boost power if they used it recently (within 24hrs)
    if (
      premium.lastBoostedAt &&
      new Date(premium.lastBoostedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      multiplier = 4;
    }

    return multiplier;
  },

  getBoostMultipliers: async (
    userIds: string[],
  ): Promise<Record<string, number>> => {
    if (!userIds.length) return {};

    // Updated to use the batch repo method
    const statuses = await premiumFeatureRepo.getFeaturesByUserIds(userIds);

    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const multipliersMap: Record<string, number> = {};

    for (const premium of statuses) {
      if (!premium.visibilityBoost) {
        multipliersMap[premium.userId] = 1;
        continue;
      }

      if (premium.expiresAt && new Date(premium.expiresAt) < now) {
        multipliersMap[premium.userId] = 1;
        continue;
      }

      let multiplier = 3;
      if (
        premium.lastBoostedAt &&
        new Date(premium.lastBoostedAt) > oneDayAgo
      ) {
        multiplier = 4;
      }

      multipliersMap[premium.userId] = multiplier;
    }

    // Fill in default 1x for any users who didn't have a record
    for (const id of userIds) {
      if (!(id in multipliersMap)) {
        multipliersMap[id] = 1;
      }
    }

    return multipliersMap;
  },
};