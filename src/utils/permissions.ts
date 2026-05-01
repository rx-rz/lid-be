import type { SubscriptionTier } from "../db/schema";

export type AppFeatures = {
  dailySwipes: number | "unlimited";
  hasUndo: boolean;
  canSeeWhoLikedMe: boolean;
  superLikesPerWeek: number;
  boostsPerWeek: number;
  loveLettersPerWeek: number;
  videoCalls: number | "unlimited";
  hasAdvancedFilters: boolean;
  recallsPerWeek: number | "unlimited";
  myLikesLimit: number | false;
};

export const TIER_PERMISSIONS: Record<SubscriptionTier, AppFeatures> = {
  economy: {
    dailySwipes: 30,
    hasUndo: false,
    canSeeWhoLikedMe: false,
    superLikesPerWeek: 0,
    boostsPerWeek: 0,
    loveLettersPerWeek: 0,
    videoCalls: 2,
    recallsPerWeek: 0,
    hasAdvancedFilters: false,
    myLikesLimit: false,
  },
  premium: {
    dailySwipes: "unlimited",
    hasUndo: true,
    canSeeWhoLikedMe: true,
    superLikesPerWeek: 5,
    boostsPerWeek: 1,
    loveLettersPerWeek: 1,
    videoCalls: "unlimited",
    recallsPerWeek: "unlimited",
    hasAdvancedFilters: false,
    myLikesLimit: 20,
  },
  "first-class": {
    dailySwipes: "unlimited",
    hasUndo: true,
    canSeeWhoLikedMe: true,
    superLikesPerWeek: 10,
    boostsPerWeek: 3,
    loveLettersPerWeek: 3,
    videoCalls: "unlimited",
    recallsPerWeek: "unlimited",
    hasAdvancedFilters: true,
    myLikesLimit: 30,
  },
  weekender: {
    dailySwipes: "unlimited",
    hasUndo: true,
    canSeeWhoLikedMe: true,
    superLikesPerWeek: 10,
    boostsPerWeek: 3,
    loveLettersPerWeek: 3,
    videoCalls: "unlimited",
    recallsPerWeek: "unlimited",
    hasAdvancedFilters: true,
    myLikesLimit: 30,
  },
};
