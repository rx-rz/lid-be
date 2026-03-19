import { clerkClient } from "elysia-clerk";
import { InternalServerError, NotFoundError } from "elysia";

import { InsertUser } from "../../db/schema";
import { db } from "../../db/db";
import { userRepo, FilteredUser } from "../../repo/user.repo";
import { locationRepo } from "../../repo/location.repo";
import { preferenceRepo } from "../../repo/preference.repo";
import { blockService } from "../block/block.services";
import { premiumService } from "../premium/premium.services";

import {
  getCountryDetailsFromAbbr,
  getCountryFromCoordinates,
  getTravelTime,
} from "../../utils/location";

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

export type ProcessedUser = FilteredUser & {
  distanceKm: string | number;
  travelTimeMinutes: number;
  country: { name: string; abrv: string; flag: string } | null;
  baseVisibilityScore: number;
  advancedScore: number;
  totalScore: number;
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
  user: FilteredUser,
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

  const matchArray = (filterArr?: string[], prefArr?: string[] | null) =>
    filterArr?.length &&
    prefArr?.length &&
    filterArr.some((f) => prefArr.includes(f))
      ? 1
      : 0;

  score += matchArray(filters.ethnicity, p.ethnicity ?? undefined);
  score += matchArray(filters.language, p.language ?? undefined);

  score += matchExact(filters.zodiac, p.zodiac);
  score += matchExact(filters.familyPlans, p.familyPlans);
  score += matchExact(filters.workoutFrequency, p.workoutFrequency);
  score += matchExact(filters.personality, p.personality);
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

const calculateVisibilityScore = (user: FilteredUser): number => {
  let score = 1;
  if (user.onlineStatus) score += 2;
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
    const currentLocation = await userRepo.getUserLocation(currentUserId);
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      throw new Error("Current user location not found");
    }

    const origin = {
      lat: parseFloat(currentLocation.latitude),
      lng: parseFloat(currentLocation.longitude),
    };

    const blockedUserIds = await blockService.getBlockedIds(currentUserId);

    let originCountry = null;
    if (currentLocation.countryAbbreviation) {
      originCountry = getCountryDetailsFromAbbr(
        currentLocation.countryAbbreviation,
      );
    } else {
      originCountry = getCountryFromCoordinates(origin.lat, origin.lng);
    }

    const fetchedData = await userRepo.findUsersWithFilters({
      ...filters,
      currentUserId,
      blockedUserIds,
    });

    const rawUsers: FilteredUser[] = Array.isArray(fetchedData)
      ? fetchedData
      : fetchedData.users;
    const nextCursor = Array.isArray(fetchedData)
      ? null
      : fetchedData.nextCursor;

    const userIds = rawUsers.map((u) => u.id).filter(Boolean);
    const boostMultipliersMap =
      await premiumService.getBoostMultipliers(userIds);

    const usersWithDistances = await Promise.all(
      rawUsers.map(
        async (user: FilteredUser): Promise<ProcessedUser | null> => {
          if (!user.latitude || !user.longitude || !user.birthday) return null;

          const age = getAge(user.birthday);
          if (age === null || age < ageRange[0] || age > ageRange[1])
            return null;

          if (minPhotos && (!user.images || user.images.length < minPhotos)) {
            return null;
          }

          const destination = {
            lat: parseFloat(user.latitude),
            lng: parseFloat(user.longitude),
          };

          let country = null;
          if (user.countryAbbreviation) {
            country = getCountryDetailsFromAbbr(user.countryAbbreviation);
          } else {
            country = getCountryFromCoordinates(
              destination.lat,
              destination.lng,
            );
          }

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

          const premiumBoost = boostMultipliersMap[user.id] ?? 1;

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
            superLike: user.superLike ?? false,
            likedAt: user.likedAt ?? null,
          };
        },
      ),
    );

    const filteredResults = usersWithDistances
      .filter((user): user is ProcessedUser => user !== null)
      .filter((user) => {
        const distance =
          typeof user.distanceKm === "number" ? user.distanceKm : radius[1];
        return distance >= radius[0] && distance <= radius[1];
      })
      .sort((a, b) => {
        if (a.superLike && !b.superLike) return -1;
        if (!a.superLike && b.superLike) return 1;

        if (a.superLike && b.superLike) {
          const timeA = a.likedAt ? new Date(a.likedAt).getTime() : 0;
          const timeB = b.likedAt ? new Date(b.likedAt).getTime() : 0;
          return timeA - timeB;
        }

        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      });

    return { users: filteredResults, nextCursor };
  },
};
