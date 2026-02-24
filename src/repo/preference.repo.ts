import { eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { preferencesTable } from "../db/schema";

export const preferenceRepo = {
  createPreference: async (userId: string, lookingToDate: string[]) => {
    const [preference] = await db
      .insert(preferencesTable)
      .values({ userId, lookingToDate })
      .returning();
    return preference;
  },

  getPreferenceByIdOrUserId: async (id: number, userId: string) => {
    const [preference] = await db
      .select()
      .from(preferencesTable)
      .where(
        or(eq(preferencesTable.id, id), eq(preferencesTable.userId, userId)),
      )
      .limit(1);
    return preference;
  },

  getPreferenceByUserId: async (userId: string) => {
    const [preference] = await db
      .select()
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, userId))
      .limit(1);
    return preference;
  },

  updatePreference: async (
    id: number,
    userId: string,
    data: Partial<typeof preferencesTable.$inferInsert>,
  ) => {
    const [updatedPreference] = await db
      .update(preferencesTable)
      .set(data)
      .where(
        or(eq(preferencesTable.id, id), eq(preferencesTable.userId, userId)),
      )
      .returning();
    return updatedPreference;
  },
};
