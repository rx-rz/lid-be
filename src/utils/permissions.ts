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
  fullStatus: boolean;
  profileViews: boolean | "unlimited";
  priorityAisle: boolean;
  ads: boolean;
  monthlyCredits: boolean;
  rollover: boolean;
};

export const TIER_PERMISSIONS: Record<SubscriptionTier, AppFeatures> = {
  economy: {
    dailySwipes: 25,
    hasUndo: false,
    canSeeWhoLikedMe: false,
    superLikesPerWeek: 0,
    boostsPerWeek: 0,
    loveLettersPerWeek: 0,
    videoCalls: 2,
    recallsPerWeek: 0,
    hasAdvancedFilters: false,
    myLikesLimit: false,
    fullStatus: false,
    profileViews: false,
    priorityAisle: false,
    ads: true,
    monthlyCredits: false,
    rollover: false,
  },
  premium: {
    dailySwipes: "unlimited",
    hasUndo: true,
    canSeeWhoLikedMe: true,
    superLikesPerWeek: 5,
    boostsPerWeek: 1,
    loveLettersPerWeek: 0,
    videoCalls: 8,
    recallsPerWeek: "unlimited",
    hasAdvancedFilters: true,
    myLikesLimit: 20,
    fullStatus: true,
    profileViews: true,
    priorityAisle: true,
    ads: false,
    monthlyCredits: true,
    rollover: true,
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
    myLikesLimit: false,
    fullStatus: true,
    profileViews: "unlimited",
    priorityAisle: true,
    ads: false,
    monthlyCredits: true,
    rollover: true,
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
    myLikesLimit: false,
    fullStatus: true,
    profileViews: "unlimited",
    priorityAisle: true,
    ads: false,
    monthlyCredits: false,
    rollover: false,
  },
};
