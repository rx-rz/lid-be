import { InsertUser } from "../../db/schema";
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
    return await userRepo.deleteUser(id);
  },

  getUser: async (id: string) => {
    return await userRepo.getUserById(id);
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
    // 5. Process distances, formatting, and premium visibility
    const usersWithDistances = await Promise.all(
      users.map(async (user: any) => {
        // Skip users missing critical location or age data
        if (!user.latitude || !user.longitude || !user.birthday) return null;

        // Apply programmatic filters (age + photos)
        const age =
          new Date().getFullYear() - new Date(user.birthday).getFullYear();
        if (age < ageRange[0] || age > ageRange[1]) return null;
        if (minPhotos && (!user.images || user.images.length < minPhotos))
          return null;

        const destination = {
          lat: parseFloat(user.latitude),
          lng: parseFloat(user.longitude),
        };

        // Get destination country (cached)
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

        // For same country: calculate actual travel distance
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
        const boostedVisibilityScore =
          calculateVisibilityScore(user) * premiumBoost;
        return {
          ...user,
          distanceKm,
          travelTimeMinutes,
          country,
          boostedVisibilityScore,
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
      .sort(
        (a: any, b: any) =>
          (b.boostedVisibilityScore || 0) - (a.boostedVisibilityScore || 0),
      );

    await cacheResults(currentUserId, queryHash, filteredResults);

    return filteredResults;
  },
};
