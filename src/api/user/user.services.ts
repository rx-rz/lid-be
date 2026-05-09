import { clerkClient } from "elysia-clerk";
import { Expo } from "expo-server-sdk";
import { DevicePlatform, InsertUser, PushProvider, userPushTokensTable } from "../../db/schema";
import { db } from "../../db/db";
import { userRepo, FilteredUser } from "../../repo/user.repo";
import { locationRepo } from "../../repo/location.repo";
import { preferenceRepo } from "../../repo/preference.repo";
import { blockService } from "../block/block.services";
import { premiumService } from "../premium/premium.services";
import { profileRepo } from "../../repo/profile.repo";
import { entitlementService } from "../../services/entitlements";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../middleware/error";

import {
  getCountryDetailsFromAbbr,
  getCountryFromCoordinates,
  getTravelTime,
} from "../../utils/location";
import { and, eq } from "drizzle-orm";

export type GetUsersFilters = {
  currentUserId: string;
  blockedUserIds?: string[];
  cursor?: string | null;
  limit?: number;
  gender?: string[];
  activity?: "justJoined";
  country?: string;
  smoking?: boolean;
  drinking?: boolean;
  ethnicity?: string[];
  educationLevel?: string[];
  lookingFor?: string[];
  height?: string[];
  zodiac?: string[];
  familyPlans?: string[];
  hasBio?: boolean;
  workoutFrequency?: string[];
  personality?: string[];
  language?: string[];
  bodyType?: string[];
  loveLanguage?: string[];
  opennessToLongDistance?: boolean;
  willingToRelocate?: boolean;
  religion?: string[];
  pets?: string[];
  sexuality?: string[];
  dietaryPreference?: string[];
  sleepingHabits?: string[];
  travelPlans?: string[];
  relationshipStatus?: string[];
};

/**
 * IMPORTANT CHANGE:
 * Distance is no longer string | number.
 * We now use a structured type to avoid downstream confusion.
 */
type DistanceInfo =
  | {
    type: "local";
    km: number;
    travelTimeMinutes: number;
  }
  | {
    type: "international";
    label: string;
    travelTimeMinutes: 0;
  };

export type ProcessedUser = FilteredUser & {
  distance: DistanceInfo;
  country: { name: string; abrv: string; flag: string } | null;
  baseVisibilityScore: number;
  advancedScore: number;
  totalScore: number;
};

export type PublicProcessedUser = Omit<ProcessedUser, "preferences">;

export type FilteredUsersResult = {
  users: PublicProcessedUser[];
  nextCursor: string | null;
};

/**
 * -----------------------------
 * HELPERS (PURE FUNCTIONS)
 * -----------------------------
 */

/**
 * Safer age calculation
 */
export const getAge = (birthday: string | null | Date): number | null => {
  if (!birthday) return null;

  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

/**
 * Resolve country consistently
 * (keeps logic out of main pipeline)
 */
const resolveCountry = (lat: number, lng: number, abbr?: string | null) => {
  if (abbr) return getCountryDetailsFromAbbr(abbr);
  return getCountryFromCoordinates(lat, lng);
};

/**
 * Compute distance in a consistent structured format
 */
const computeDistance = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  originCountry: any,
  userCountry: any,
): DistanceInfo => {
  const sameCountry = originCountry?.abrv === userCountry?.abrv;

  if (sameCountry) {
    const result = getTravelTime(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
    );

    return {
      type: "local",
      km: result.distanceKm,
      travelTimeMinutes: result.travelTimeMinutes,
    };
  }

  return {
    type: "international",
    label: `Currently in ${userCountry?.name?.includes("United") ? "The " : ""
      }${userCountry?.name} ${userCountry?.flag}`,
    travelTimeMinutes: 0,
  };
};

/**
 * Eligibility filtering (NO scoring here)
 */
const isUserEligible = (
  user: FilteredUser,
  ageRange: number[],
  minPhotos?: number,
): boolean => {
  if (!user.latitude || !user.longitude || !user.birthday) return false;

  const age = getAge(user.birthday);
  if (age === null || age < ageRange[0] || age > ageRange[1]) {
    return false;
  }

  if (minPhotos && (!user.images || user.images.length < minPhotos)) {
    return false;
  }

  return true;
};

/**
 * Visibility score (platform-driven)
 */
export const calculateVisibilityScore = (user: FilteredUser): number => {
  let score = 20;

  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (
    user.createdAt &&
    new Date(user.createdAt).getTime() > twentyFourHoursAgo
  ) {
    score += 14;
  }

  if (user.verified) score += 10;

  if (user.onlineStatus) {
    score += 24;
  } else if (user.lastLogin && new Date(user.lastLogin).getTime() > sevenDaysAgo) {
    score += 8;
  }

  if (Array.isArray(user.images) && user.images.length > 0) {
    score += 14;
    score += Math.min((user.images.length - 1) * 3, 12);
  }

  if (typeof user.profile?.bio === "string" && user.profile.bio.length > 20) {
    score += 8;
  }

  return score;
};

/**
 * Advanced matching score (user preference-driven)
 */
export const calculateAdvancedFilterScore = (
  user: FilteredUser,
  filters: GetUsersFilters,
): number => {
  let score = 0;
  const p = user.preferences;
  if (!p) return score;

  const matchExact = (arr?: string[], val?: string | null) =>
    arr?.length && val && arr.includes(val) ? 3 : 0;

  const matchArray = (arr?: string[], vals?: string[] | null) =>
    arr?.length && vals?.length && arr.some((f) => vals.includes(f)) ? 3 : 0;

  const matchBool = (f?: boolean, v?: boolean | null) =>
    f !== undefined && f === v ? 3 : 0;

  score += matchArray(filters.ethnicity, p.ethnicity ?? undefined);
  score += matchArray(filters.language, p.language ?? undefined);

  score += matchExact(filters.zodiac, p.zodiac);
  score += matchExact(filters.familyPlans, p.familyPlans);
  score += matchExact(filters.personality, p.personality);
  score += matchExact(filters.religion, p.religion);

  score += matchBool(filters.smoking, p.smoking);
  score += matchBool(filters.drinking, p.drinking);
  score += matchBool(filters.opennessToLongDistance, p.opennessToLongDistance);
  score += matchBool(filters.willingToRelocate, p.willingToRelocate);
  score += matchBool(filters.hasBio, Boolean(user.profile?.bio));
  score += matchExact(filters.workoutFrequency, p.workoutFrequency);
  score += matchExact(filters.dietaryPreference, p.dietaryPreference);
  score += matchExact(filters.sleepingHabits, p.sleepingHabits);
  score += matchExact(filters.travelPlans, p.travelPlans);
  score += matchExact(filters.relationshipStatus, p.relationshipStatus);

  if (filters.hasBio && (user.profile?.bio?.length ?? 0) > 20) {
    score += 4;
  }

  return score;
};

const INCOMING_LIKE_SCORE_BONUS = 40;

/**
 * Ranking logic isolated
 */
export const rankUsers = (users: ProcessedUser[]): ProcessedUser[] => {
  return users.sort((a, b) => {
    if (a.superLike && !b.superLike) return -1;
    if (!a.superLike && b.superLike) return 1;

    if (a.superLike && b.superLike) {
      const tA = a.likedAt ? new Date(a.likedAt).getTime() : 0;
      const tB = b.likedAt ? new Date(b.likedAt).getTime() : 0;
      return tB - tA;
    }

    return (b.totalScore ?? 0) - (a.totalScore ?? 0);
  });
};

export const sanitizeFilteredUsersResult = (result: {
  users: ProcessedUser[];
  nextCursor: string | null;
}): FilteredUsersResult => ({
  users: result.users.map(({ preferences, ...user }) => user),
  nextCursor: result.nextCursor,
});

const BASIC_DISCOVERY_FILTERS = new Set<keyof GetUsersFilters>([
  "currentUserId",
  "blockedUserIds",
  "cursor",
  "limit",
  "gender",
  "country",
]);

const downgradeAdvancedFilters = (
  filters: GetUsersFilters,
): GetUsersFilters => {
  const downgraded: GetUsersFilters = {
    currentUserId: filters.currentUserId,
  };

  for (const key of BASIC_DISCOVERY_FILTERS) {
    if (filters[key] !== undefined) {
      (downgraded as any)[key] = filters[key];
    }
  }

  return downgraded;
};

/**
 * -----------------------------
 * SERVICE
 * -----------------------------
 */


const expo = new Expo();
export const userService = {
  createUserProfile: async (clerkId: string, phone?: string) => {
    const exists = await userRepo.getUserByClerkId(clerkId);
    if (exists) {
      throw new ConflictError("User already exists.", {
        code: "USER_ALREADY_EXISTS",
      });
    }

    return db.transaction(async (tx) => {
      const user = await userRepo.createUser({ id: clerkId, phone }, tx);
      if (!user) throw new InternalServerError("Unable to create user");
      const profile = await profileRepo.createProfile(clerkId, tx);
      if (!profile) throw new InternalServerError("Unable to create profile");
      return user;
    });
  },

  updateUser: async (id: string, data: Partial<InsertUser>) => {
    const user = await userRepo.updateUser(id, data);
    if (!user) throw new NotFoundError("Unable to update user");
    return user;
  },

  deleteUserAccount: async (id: string) => {
    try {
      await clerkClient.users.deleteUser(id);
      return await userRepo.deleteUser(id);
    } catch {
      throw new InternalServerError("Unable to delete user account.");
    }
  },

  getUserDetails: async (id: string) => {
    const user = await userRepo.getUserDetailsById(id);
    if (!user) throw new NotFoundError("User not found.");

    const [loc, pref] = await Promise.all([
      locationRepo.getLocationByUserId(id),
      preferenceRepo.getPreferenceByUserId(id),
    ]);

    const location =
      loc?.latitude && loc?.longitude
        ? getCountryFromCoordinates(
          parseFloat(loc.latitude),
          parseFloat(loc.longitude),
        )
        : null;

    return { ...user, location, whyHere: pref?.whyHere };
  },


  getFilteredUsersList: async (
    currentUserId: string,
    filters: GetUsersFilters,
    radius: number[],
    ageRange: number[],
    minPhotos?: number,
  ): Promise<FilteredUsersResult> => {
    const currentUser = await userRepo.getUserById(currentUserId);
    const canUseAdvancedFilters = entitlementService.hasAdvancedFilters(
      currentUser?.subscriptionType,
    );
    const effectiveFilters = canUseAdvancedFilters
      ? filters
      : downgradeAdvancedFilters(filters);
    const effectiveMinPhotos = canUseAdvancedFilters ? minPhotos : undefined;

    // STEP 1: origin
    const currentLocation = await userRepo.getUserLocation(currentUserId);
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      throw new BadRequestError("Current user location not found.", {
        code: "CURRENT_USER_LOCATION_NOT_FOUND",
      });
    }

    const origin = {
      lat: parseFloat(currentLocation.latitude),
      lng: parseFloat(currentLocation.longitude),
    };

    const originCountry = resolveCountry(
      origin.lat,
      origin.lng,
      currentLocation.countryAbbreviation,
    );

    // STEP 2: dependencies
    const blockedUserIds = await blockService.getBlockedIds(currentUserId);

    const fetched = await userRepo.findUsersWithFilters({
      ...effectiveFilters,
      currentUserId,
      blockedUserIds,
    });

    const rawUsers = Array.isArray(fetched) ? fetched : fetched.users;
    const nextCursor = Array.isArray(fetched) ? null : fetched.nextCursor;

    const boostMap = await premiumService.getBoostMultipliers(
      rawUsers.map((u) => u.id),
    );

    const processed: ProcessedUser[] = [];

    for (const user of rawUsers) {
      if (!isUserEligible(user, ageRange, effectiveMinPhotos)) continue;

      const lat = parseFloat(user.latitude!);
      const lng = parseFloat(user.longitude!);

      const country = resolveCountry(lat, lng, user.countryAbbreviation);

      const distance = computeDistance(
        origin,
        { lat, lng },
        originCountry,
        country,
      );

      // radius filtering ONLY applies to local users
      if (distance.type === "local") {
        if (distance.km < radius[0] || distance.km > radius[1]) {
          continue;
        }
      }

      const boost = boostMap[user.id] ?? 1;

      const baseVisibilityScore = calculateVisibilityScore(user) * boost;

      const advancedScore = calculateAdvancedFilterScore(
        user,
        effectiveFilters,
      );

      processed.push({
        ...user,
        distance,
        country,
        baseVisibilityScore,
        advancedScore,
        totalScore:
          baseVisibilityScore +
          advancedScore +
          (user.hasLikedLoggedInUser ? INCOMING_LIKE_SCORE_BONUS : 0),
      });
    }

    // STEP 4: ranking
    const ranked = rankUsers(processed);

    return sanitizeFilteredUsersResult({
      users: ranked,
      nextCursor,
    });
  },
  testExpoPushNotification: async (expoPushToken: string) => {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      throw new BadRequestError("Invalid Expo push token.", {
        code: "INVALID_EXPO_PUSH_TOKEN",
      });
    }

    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: expoPushToken,
        sound: "default",
        title: "Push test worked 🚀",
        body: "Your backend successfully triggered an Expo push notification.",
        data: {
          type: "PUSH_TEST",
        },
      },
    ]);

    return { tickets };
  },
  registerPushToken: async (input: {
    userId: string;
    token: string;
    provider?: PushProvider;
    platform?: DevicePlatform;
    deviceId?: string;
  }) => {
    const provider = input.provider ?? "expo";
    const platform = input.platform ?? "unknown";

    const [saved] = await db
      .insert(userPushTokensTable)
      .values({
        userId: input.userId,
        token: input.token,
        provider,
        platform,
        deviceId: input.deviceId,
        enabled: true,
        lastUsedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userPushTokensTable.userId, userPushTokensTable.token],
        set: {
          provider,
          platform,
          deviceId: input.deviceId,
          enabled: true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (provider === "fcm") {
      await userRepo.updateUser(input.userId, {
        fcmToken: input.token,
      });
    }

    return saved;
  },

  unregisterPushToken: async (input: {
    userId: string;
    token: string;
  }) => {
    const [disabled] = await db
      .update(userPushTokensTable)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPushTokensTable.userId, input.userId),
          eq(userPushTokensTable.token, input.token),
        ),
      )
      .returning();

    return disabled;
  },
};
