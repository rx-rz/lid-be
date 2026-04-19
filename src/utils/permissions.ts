// types/permissions.ts
import type { SubscriptionTier } from "../db/schema";

export type AppFeatures = {
  dailySwipes: number | "unlimited";
  hasUndo: boolean;
  canSeeWhoLikedMe: boolean; // Priority Aisle
  superLikesPerWeek: number;
  boostsPerWeek: number; // Takeoffs
  loveLettersPerWeek: number;
  videoCalls: number | "unlimited"; // Cruise calls
  hasAdvancedFilters: boolean;
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
    videoCalls: 2, // 2 free Cruise calls
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
    hasAdvancedFilters: true,
    myLikesLimit: 30,
  },
};
