import { premiumRepo } from "../../repo/premium.repo";
import { cacheUtils } from "../../utils/cache.utils";

export const premiumService = {
  boostUser: async (userId: string) => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const boost = await premiumRepo.upsertBoost(userId, expiresAt);
    await cacheUtils.invalidateUserDiscoveryCache(userId);
    return boost;
  },

  getBoostMultiplier: async (userId: string): Promise<number> => {
    const premium = await premiumRepo.getPremiumStatus(userId);
    if (!premium || !premium.visibilityBoost) return 1;

    if (premium.expiresAt && new Date(premium.expiresAt) < new Date()) {
      return 1;
    }

    let multiplier = 3;

    if (
      premium.lastBoostedAt &&
      new Date(premium.lastBoostedAt) >
        new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      multiplier = 4;
    }

    return multiplier;
  },
};
