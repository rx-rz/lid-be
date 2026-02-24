import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { locationsTable } from "../db/schema";

export const locationRepo = {
  createLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
    countryAbbreviation: string,
  ) => {
    const [location] = await db
      .insert(locationsTable)
      .values({ userId, latitude, longitude, countryAbbreviation })
      .returning();
    return location;
  },

  updateLocation: async (
    userId: string,
    latitude: string,
    longitude: string,
    countryAbbreviation?: string,
  ) => {
    const [location] = await db
      .update(locationsTable)
      .set({ userId, latitude, longitude, countryAbbreviation })
      .where(eq(locationsTable.userId, userId))
      .returning();
    return location;
  },
};
