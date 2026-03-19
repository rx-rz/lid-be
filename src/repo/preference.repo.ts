import { eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { preferencesTable } from "../db/schema";

export const preferenceRepo = {
  upsertPreference: async (userId: string, lookingToDate: string[]) => {
    const [preference] = await db
      .insert(preferencesTable)
      .values({ userId, lookingToDate })
      .onConflictDoUpdate({
        target: preferencesTable.userId,
        set: {
          lookingToDate,
        },
      })
      .returning();

    return preference;
  },

  getPreferenceByIdOrUserId: async (userId: string) => {
    const [preference] = await db
      .select()
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, userId))
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
    userId: string,
    data: Partial<typeof preferencesTable.$inferInsert>,
  ) => {
    const [updatedPreference] = await db
      .update(preferencesTable)
      .set(data)
      .where(eq(preferencesTable.userId, userId))
      .returning();
    return updatedPreference;
  },
};
