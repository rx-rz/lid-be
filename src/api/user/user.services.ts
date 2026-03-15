import { clerkClient } from "elysia-clerk";
import { InsertUser } from "../../db/schema";
import { locationRepo } from "../../repo/location.repo";
import {
  cacheResults,
  createQueryHash,
  getCachedResults,
  getCountryFromCoordinates,
  getTravelTime,
} from "../../utils/location";
import { blockService } from "../block/block.services";
import { premiumService } from "../premium/premium.services";
import { preferenceRepo } from "../../repo/preference.repo";
import { db } from "../../db/db";
import { InternalServerError, NotFoundError } from "elysia";
import { userRepo } from "../../repo/user.repo";

export type GetUsersFilters = {
  currentUserId: string;
  blockedUserIds?: string[];
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

export const getAge = (birthdayString: string | null | Date): number | null => {
  if (!birthdayString) return null;
  const today = new Date();
  const birthDate = new Date(birthdayString);

  if (isNaN(birthDate.getTime())) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const calculateAdvancedFilterScore = (
  user: Record<string, any>,
  filters: GetUsersFilters,
): number => {
  let score = 0;
  const p = user.preferences;

  if (!p) return score;

  const matchExact = (filterArr?: string[], prefVal?: string | null) =>
    filterArr?.length && prefVal && filterArr.includes(prefVal) ? 1 : 0;

  const matchPartial = (filterArr?: string[], prefVal?: string | null) =>
    filterArr?.length &&
    prefVal &&
    filterArr.some((f) => prefVal.toLowerCase().includes(f.toLowerCase()))
      ? 1
      : 0;

  const matchBool = (filterVal?: boolean, prefVal?: boolean | null) =>
    filterVal !== undefined && filterVal === prefVal ? 1 : 0;

  score += matchExact(filters.ethnicity, p.ethnicity);
  score += matchExact(filters.zodiac, p.zodiac);
  score += matchExact(filters.familyPlans, p.familyPlans);
  score += matchExact(filters.workoutFrequency, p.workoutFrequency);
  score += matchExact(filters.personality, p.personality);
  score += matchExact(filters.language, p.language);
  score += matchExact(filters.bodyType, p.bodyType);
  score += matchExact(filters.loveLanguage, p.loveLanguage);
  score += matchExact(filters.religion, p.religion);
  score += matchExact(filters.pets, p.pets);
  score += matchExact(filters.sexuality, p.sexuality);
  score += matchExact(filters.dietaryPreference, p.dietaryPreference);
  score += matchExact(filters.sleepingHabits, p.sleepingHabits);
  score += matchExact(filters.travelPlans, p.travelPlans);
  score += matchExact(filters.relationshipStatus, p.relationshipStatus);

  score += matchPartial(filters.educationLevel, p.education);
  score += matchPartial(filters.height, p.height);

  score += matchBool(filters.smoking, p.smoking);
  score += matchBool(filters.drinking, p.drinking);
  score += matchBool(filters.opennessToLongDistance, p.opennessToLongDistance);
  score += matchBool(filters.willingToRelocate, p.willingToRelocate);

  if (filters.hasBio && (p.hasBio || (user.profile?.bio?.length ?? 0) > 20)) {
    score += 1;
  }

  return score;
};

const calculateVisibilityScore = (user: Record<string, any>): number => {
  let score = 1;
  if (user.onlineStatus === "online") score += 2;
  if (Array.isArray(user.images) && user.images.length > 0) score += 1;
  if (typeof user.profile?.bio === "string" && user.profile.bio.length > 20) {
    score += 0.5;
  }
  return score;
};

export const userService = {
  createUserProfile: async (clerkId: string, phone?: string) => {
    const userExists = await userRepo.checkUserExists(clerkId);
    if (userExists) throw new Error("User already exists");

    return await db.transaction(async (tx) => {
      const user = await userRepo.createUser({ id: clerkId, phone }, tx);
      if (!user) throw new InternalServerError("Unable to create user");

      const profile = await userRepo.createProfile(clerkId, tx);
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
    } catch (err) {
      throw new InternalServerError("Unable to delete user account.");
    }
  },

  getUserDetails: async (id: string) => {
    const user = await userRepo.getUserById(id);
    if (!user) throw new NotFoundError("User not found.");

    const [l, p] = await Promise.all([
      locationRepo.getLocationByUserId(id),
      preferenceRepo.getPreferenceByUserId(id),
    ]);

    const location =
      l?.latitude && l?.longitude
        ? getCountryFromCoordinates(
            parseFloat(l.latitude),
            parseFloat(l.longitude),
          )
        : null;

    return { ...user, location: location ?? null, whyHere: p?.whyHere };
  },

  getFilteredUsersList: async (
    currentUserId: string,
    filters: GetUsersFilters,
    radius: number[],
    ageRange: number[],
    minPhotos?: number,
  ) => {
    const queryHash = createQueryHash({
      ...filters,
      radius,
      ageRange,
      minPhotos,
    });

    const cachedResults = await getCachedResults(currentUserId, queryHash);
    if (cachedResults) return cachedResults;

    const currentLocation = await userRepo.getUserLocation(currentUserId);
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      throw new Error("Current user location not found");
    }

    const origin = {
      lat: parseFloat(currentLocation.latitude as string),
      lng: parseFloat(currentLocation.longitude as string),
    };

    const blockedUserIds = await blockService.getBlockedIds(currentUserId);
    const originCountry = getCountryFromCoordinates(origin.lat, origin.lng);

    const users = await userRepo.findUsersWithFilters({
      ...filters,
      currentUserId,
      blockedUserIds,
    });

    const usersWithDistances = await Promise.all(
      users.map(async (user: Record<string, any>) => {
        if (!user.latitude || !user.longitude || !user.birthday) return null;

        const age = getAge(user.birthday);
        if (age === null || age < ageRange[0] || age > ageRange[1]) return null;

        if (minPhotos && (!user.images || user.images.length < minPhotos)) {
          return null;
        }

        const destination = {
          lat: parseFloat(user.latitude),
          lng: parseFloat(user.longitude),
        };

        const country = getCountryFromCoordinates(
          destination.lat,
          destination.lng,
        );
        const sameCountry = originCountry?.abrv === country?.abrv;

        let distanceKm: number | string = radius[1];
        let travelTimeMinutes = 0;

        if (sameCountry) {
          const result = getTravelTime(
            origin.lat,
            origin.lng,
            destination.lat,
            destination.lng,
          );
          distanceKm = result.distanceKm;
          travelTimeMinutes = result.travelTimeMinutes;
        } else {
          distanceKm = `Currently in ${country?.name.includes("United") ? "The " : ""}${country?.name} ${country?.flag}`;
        }

        const premiumBoost = await premiumService.getBoostMultiplier(user.id);
        const baseVisibilityScore =
          calculateVisibilityScore(user) * premiumBoost;
        const advancedScore = calculateAdvancedFilterScore(user, filters);

        return {
          ...user,
          distanceKm,
          travelTimeMinutes,
          country,
          baseVisibilityScore,
          advancedScore,
          totalScore: baseVisibilityScore + advancedScore,
          hasLikedLoggedInUser: user.hasLikedLoggedInUser,
        };
      }),
    );

    const filteredResults = usersWithDistances
      .filter((user) => user !== null)
      .filter((user) => {
        const distance =
          typeof user.distanceKm === "number" ? user.distanceKm : radius[1];
        return distance >= radius[0] && distance <= radius[1];
      })
      .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

    await cacheResults(currentUserId, queryHash, filteredResults);

    return filteredResults;
  },
};
