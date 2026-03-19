import { createHash } from "crypto";
import { countryIndex } from "./country-emojis.js";
import { redisClient } from "./redis.js";
import coordinateToCountry from "coordinate_to_country";

const CACHE_TTL = 86400;
const RESULTS_CACHE_TTL = 3600;
const COUNTRY_CACHE_TTL = 604800;

// --- O(1) OPTIMIZATIONS ---

// 1. Hoist Intl instantiation. Doing this in a loop crushes CPU performance.
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// 2. Convert O(N) array search to an O(1) Hash Map
const flagEmojiMap = Object.values(countryIndex.countryFlagEmoji).reduce(
  (acc, curr) => {
    acc[curr.code] = curr.emoji;
    return acc;
  },
  {} as Record<string, string>
);

// 3. Fast-path lookup: Use this when you already know the abbreviation (e.g., from DB)
export function getCountryDetailsFromAbbr(
  countryCode: string
): { name: string; abrv: string; flag: string } {
  const name = regionNames.of(countryCode) ?? countryCode;
  return {
    name,
    abrv: countryCode,
    flag: flagEmojiMap[countryCode] ?? "🏳️",
  };
}

// --------------------------

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getTravelTime(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): { travelTimeMinutes: number; distanceKm: number } {
  const R = 6371;
  const dLat = (destinationLatitude - originLatitude) * (Math.PI / 180);
  const dLon = (destinationLongitude - originLongitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLatitude * (Math.PI / 180)) *
      Math.cos(destinationLatitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;

  const estimatedRouteKm = straightLineKm * 1.3;

  let speedKmh = 40;
  if (estimatedRouteKm > 50) speedKmh = 65;
  if (estimatedRouteKm > 200) speedKmh = 85;

  const timeHours = estimatedRouteKm / speedKmh;

  return {
    distanceKm: Number(estimatedRouteKm.toFixed(1)),
    travelTimeMinutes: Math.round(timeHours * 60),
  };
}

export function getCountryFromCoordinates(
  latitude: number,
  longitude: number,
): { name: string; abrv: string; flag: string } | null {
  // We only run this heavy math if absolutely necessary
  const codes = coordinateToCountry(latitude, longitude, true);
  if (!codes?.length) return null;

  const countryCode = codes[0]; 
  return getCountryDetailsFromAbbr(countryCode);
}

export async function getCachedCountry(
  lat: number,
  lng: number,
): Promise<{ name: string; abrv: string; flag: string } | null> {
  const cacheKey = `country:${lat},${lng}`;
  return await redisClient.get<{ name: string; abrv: string; flag: string }>(
    cacheKey,
  );
}

export async function setCachedCountry(
  lat: number,
  lng: number,
  data: { name: string; abrv: string; flag: string },
): Promise<void> {
  const cacheKey = `country:${lat},${lng}`;
  await redisClient.setWithTtl(cacheKey, data, COUNTRY_CACHE_TTL);
}

export async function setCachedDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  data: { distanceKm: number; travelTimeMinutes: number },
): Promise<void> {
  const cacheKey = `distance:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
  await redisClient.setWithTtl(cacheKey, data, CACHE_TTL);
}

export async function getCachedDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ distanceKm: number; travelTimeMinutes: number } | null> {
  const cacheKey = `distance:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
  return await redisClient.get<{
    distanceKm: number;
    travelTimeMinutes: number;
  }>(cacheKey);
}

export function createQueryHash(params: Record<any, any>): string {
  return createHash("sha256").update(JSON.stringify(params)).digest("hex");
}

export async function getCachedResults<T = any>(
  userId: string,
  queryHash: string,
): Promise<T | null> {
  const cacheKey = `user_results:${userId}:${queryHash}`;
  return await redisClient.get<T>(cacheKey);
}

export async function cacheResults(
  userId: string,
  queryHash: string,
  results: any,
) {
  const cacheKey = `user_results:${userId}:${queryHash}`;
  await redisClient.setWithTtl(cacheKey, results, RESULTS_CACHE_TTL);
}