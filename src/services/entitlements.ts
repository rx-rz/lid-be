import type { SelectPremiumFeature, SubscriptionTier } from "../db/schema";
import { userRepo } from "../repo/user.repo";
import { TIER_PERMISSIONS, type AppFeatures } from "../utils/permissions";

export type EntitlementFeature =
  | "superlikes"
  | "boosts"
  | "loveLetters"
  | "recalls"
  | "videoCalls";

export type WalletBalances = Pick<
  SelectPremiumFeature,
  | "superlikesRemaining"
  | "boostsRemaining"
  | "loveLettersRemaining"
  | "recallsRemaining"
  | "videoCallsRemaining"
>;

export const resolveTier = (
  subscriptionType: SubscriptionTier | string | null | undefined,
): SubscriptionTier => {
  if (
    subscriptionType === "premium" ||
    subscriptionType === "first-class" ||
    subscriptionType === "weekender"
  ) {
    return subscriptionType;
  }

  return "economy";
};

export const entitlementService = {
  getEntitlementsForTier: (
    subscriptionType: SubscriptionTier | string | null | undefined,
  ): AppFeatures => TIER_PERMISSIONS[resolveTier(subscriptionType)],

  getEntitlementsForUser: async (userId: string): Promise<AppFeatures> => {
    const user = await userRepo.getUserById(userId);
    return TIER_PERMISSIONS[resolveTier(user?.subscriptionType)];
  },

  getDailySwipeLimit: (
    subscriptionType: SubscriptionTier | string | null | undefined,
  ) => entitlementService.getEntitlementsForTier(subscriptionType).dailySwipes,

  getMyLikesLimit: (
    subscriptionType: SubscriptionTier | string | null | undefined,
  ) => entitlementService.getEntitlementsForTier(subscriptionType).myLikesLimit,

  hasAdvancedFilters: (
    subscriptionType: SubscriptionTier | string | null | undefined,
  ) =>
    entitlementService.getEntitlementsForTier(subscriptionType)
      .hasAdvancedFilters,

  getSubscriptionAllowance: (
    subscriptionType: SubscriptionTier | string | null | undefined,
    feature: EntitlementFeature,
  ) => {
    const entitlement = entitlementService.getEntitlementsForTier(
      subscriptionType,
    );

    switch (feature) {
      case "superlikes":
        return entitlement.superLikesPerWeek;
      case "boosts":
        return entitlement.boostsPerWeek;
      case "loveLetters":
        return entitlement.loveLettersPerWeek;
      case "recalls":
        return entitlement.recallsPerWeek;
      case "videoCalls":
        return entitlement.videoCalls;
    }
  },

  getComputedWalletBalances: (
    subscriptionType: SubscriptionTier | string | null | undefined,
    wallet?: Partial<WalletBalances> | null,
  ): WalletBalances => {
    const entitlement = entitlementService.getEntitlementsForTier(
      subscriptionType,
    );
    const bounded = (value: number | undefined, allowance: number) =>
      Math.max(value ?? 0, allowance);

    return {
      superlikesRemaining: bounded(
        wallet?.superlikesRemaining,
        entitlement.superLikesPerWeek,
      ),
      boostsRemaining: bounded(wallet?.boostsRemaining, entitlement.boostsPerWeek),
      loveLettersRemaining: bounded(
        wallet?.loveLettersRemaining,
        entitlement.loveLettersPerWeek,
      ),
      recallsRemaining:
        entitlement.recallsPerWeek === "unlimited"
          ? wallet?.recallsRemaining ?? 0
          : bounded(wallet?.recallsRemaining, entitlement.recallsPerWeek),
      videoCallsRemaining:
        entitlement.videoCalls === "unlimited"
          ? wallet?.videoCallsRemaining ?? 0
          : bounded(wallet?.videoCallsRemaining, entitlement.videoCalls),
    };
  },
};

