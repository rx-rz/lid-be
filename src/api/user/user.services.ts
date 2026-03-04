import { clerkClient } from "elysia-clerk";
import { InsertUser } from "../../db/schema";
import { locationRepo } from "../../repo/location.repo";
import { GetUsersFilters, userRepo } from "../../repo/user.repo";
import {
  cacheResults,
  createQueryHash,
  getCachedCountry,
  getCachedDistance,
  getCachedResults,
  getCountryFromCoordinates,
  getTravelTimeFromAPI,
  setCachedCountry,
  setCachedDistance,
} from "../../utils/location";
import { blockService } from "../block/block.services";
import { premiumService } from "../premium/premium.services";
import { preferenceRepo } from "../../repo/preference.repo";

const calculateAdvancedFilterScore = (
  user: any,
  filters: GetUsersFilters,
): number => {
  let score = 0;
  const p = user.preferences;

  if (!p) return score;

  if (filters.ethnicity?.length && p.ethnicity)
    if (filters.ethnicity.includes(p.ethnicity)) score += 1;

  if (filters.zodiac?.length && p.zodiac)
    if (filters.zodiac.includes(p.zodiac)) score += 1;

  if (filters.familyPlans?.length && p.familyPlans)
    if (filters.familyPlans.includes(p.familyPlans)) score += 1;

  if (filters.educationLevel?.length && p.education)
    if (
      filters.educationLevel.some((e) =>
        p.education?.toLowerCase().includes(e.toLowerCase()),
      )
    )
      score += 1;

  if (filters.height?.length && p.height)
    if (
      filters.height.some((h) =>
        p.height?.toLowerCase().includes(h.toLowerCase()),
      )
    )
      score += 1;

  if (filters.workoutFrequency?.length && p.workoutFrequency)
    if (filters.workoutFrequency.includes(p.workoutFrequency)) score += 1;

  if (filters.personality?.length && p.personality)
    if (filters.personality.includes(p.personality)) score += 1;

  if (filters.language?.length && p.language)
    if (filters.language.includes(p.language)) score += 1;

  if (filters.bodyType?.length && p.bodyType)
    if (filters.bodyType.includes(p.bodyType)) score += 1;

  if (filters.loveLanguage?.length && p.loveLanguage)
    if (filters.loveLanguage.includes(p.loveLanguage)) score += 1;

  if (filters.smoking?.length && p.smoking)
    if (filters.smoking.includes(p.smoking)) score += 1;

  if (filters.drinking?.length && p.drinking)
    if (filters.drinking.includes(p.drinking)) score += 1;

  if (filters.opennessToLongDistance?.length && p.opennessToLongDistance)
    if (filters.opennessToLongDistance.includes(p.opennessToLongDistance))
      score += 1;

  if (filters.willingToRelocate?.length && p.willingToRelocate)
    if (filters.willingToRelocate.includes(p.willingToRelocate)) score += 1;

  if (filters.hasBio && (p.hasBio || user.profile?.bio?.length > 20))
    score += 1;

  return score;
};

const calculateVisibilityScore = (user: any): number => {
  let score = 1;
  if (user.onlineStatus === "online") score += 2;
  if (user?.images?.length > 0) score += 1;
  if (user.profile?.bio?.length > 20) score += 0.5;
  return score;
};

export const userService = {
  createUserAndProfile: async (clerkId: string, phone?: string) => {
    const userExists = await userRepo.checkUserExists(clerkId);
    if (userExists) throw new Error("User already exists");

    const user = await userRepo.createUser({ id: clerkId, phone });
    await userRepo.createProfile(clerkId);

    return user;
  },

  updateUser: async (id: string, data: Partial<InsertUser>) => {
    return await userRepo.updateUser(id, data);
  },

  deleteUserAccount: async (id: string) => {
    await clerkClient.users.deleteUser(id);
    return await userRepo.deleteUser(id);
  },

  getUser: async (id: string) => {
    const user = await userRepo.getUserById(id);
    if (!user) throw new Error("User not found.");

    const [l, p] = await Promise.all([
      locationRepo.getLocationByUserId(id),
      preferenceRepo.getPreferenceByUserId(id),
    ]);

    const location = l
      ? await getCountryFromCoordinates(
          parseFloat(l.latitude),
          parseFloat(l.longitude),
        )
      : null;

    return { ...user, location: location ?? null, whyHere: p.whyHere };
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
    // const cachedResults = await getCachedResults(currentUserId, queryHash);
    // if (cachedResults) return cachedResults;

    const currentLocation = await userRepo.getUserLocation(currentUserId);
    if (!currentLocation) throw new Error("Current user location not found");

    const origin = {
      lat: parseFloat(currentLocation.latitude as string),
      lng: parseFloat(currentLocation.longitude as string),
    };
    const blockedUserIds = await blockService.getBlockedIds(currentUserId);

    let originCountry = await getCachedCountry(origin.lat, origin.lng);
    if (!originCountry) {
      originCountry = await getCountryFromCoordinates(origin.lat, origin.lng);
      if (originCountry)
        await setCachedCountry(origin.lat, origin.lng, originCountry);
    }

    const users = await userRepo.findUsersWithFilters({
      ...filters,
      currentUserId,
      blockedUserIds,
    });

    const usersWithDistances = await Promise.all(
      users.map(async (user: any) => {
        if (!user.latitude || !user.longitude || !user.birthday) return null;

        const dob = new Date(user.birthday);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const hasBirthdayPassed =
          today.getMonth() > dob.getMonth() ||
          (today.getMonth() === dob.getMonth() &&
            today.getDate() >= dob.getDate());
        if (!hasBirthdayPassed) age--;

        if (age < ageRange[0] || age > ageRange[1]) return null;
        if (minPhotos && (!user.images || user.images.length < minPhotos))
          return null;
        const destination = {
          lat: parseFloat(user.latitude),
          lng: parseFloat(user.longitude),
        };

        let country = await getCachedCountry(destination.lat, destination.lng);
        if (!country) {
          country = await getCountryFromCoordinates(
            destination.lat,
            destination.lng,
          );
          if (country)
            await setCachedCountry(destination.lat, destination.lng, country);
        }

        const sameCountry = originCountry?.abrv === country?.abrv;
        let distanceKm: number | string = radius[1];
        let travelTimeMinutes = 0;

        if (sameCountry) {
          const cachedDistance = await getCachedDistance(origin, destination);
          if (cachedDistance) {
            distanceKm = cachedDistance.distanceKm;
            travelTimeMinutes = cachedDistance.travelTimeMinutes;
          } else {
            const result = await getTravelTimeFromAPI(
              origin.lat,
              origin.lng,
              destination.lat,
              destination.lng,
            );
            distanceKm = result.distanceKm;
            travelTimeMinutes = result.travelTimeMinutes;
            await setCachedDistance(origin, destination, result);
          }
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
        };
      }),
    );

    const filteredResults = usersWithDistances
      .filter(Boolean)
      .filter((user: any) => {
        const distance =
          typeof user.distanceKm === "number" ? user.distanceKm : radius[1];
        return distance >= radius[0] && distance <= radius[1];
      })
      .sort((a: any, b: any) => (b.totalScore || 0) - (a.totalScore || 0));

    await cacheResults(currentUserId, queryHash, filteredResults);

    return filteredResults;
  },
};
