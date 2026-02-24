import { eq } from "drizzle-orm";
import { db } from "../db/db";
import {
  profilesTable,
  usersTable,
  preferencesTable,
  imagesTable,
} from "../db/schema";

export const profileRepo = {
  upsertProfile: async (userId: string, bio: string, interests: string[]) => {
    const [profile] = await db
      .insert(profilesTable)
      .values({ userId, bio, interests })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: {
          bio: profilesTable.bio,
          interests: profilesTable.interests,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  },

  getProfileWithDetails: async (userId: string) => {
    // 1. Fetch the base profile, user, and preferences
    const [profileRecord] = await db
      .select({
        profile: profilesTable,
        user: {
          id: usersTable.id,
          name: usersTable.displayName,
          email: usersTable.email,
          age: usersTable.birthday,
          gender: usersTable.gender,
        },
        preferences: preferencesTable,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .leftJoin(usersTable, eq(profilesTable.userId, usersTable.id))
      .leftJoin(
        preferencesTable,
        eq(profilesTable.userId, preferencesTable.userId),
      );

    if (!profileRecord) return null;

    // 2. Fetch images separately to avoid complex SQL aggregation dialect issues
    const images = await db
      .select({ imageUrl: imagesTable.imageUrl, order: imagesTable.order })
      .from(imagesTable)
      .where(eq(imagesTable.userId, userId));

    return {
      ...profileRecord.profile,
      user: profileRecord.user,
      preferences: profileRecord.preferences,
      images: images || [],
    };
  },

  updateProfile: async (
    userId: string,
    data: { bio?: string; interests?: string[] },
  ) => {
    const [profile] = await db
      .update(profilesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
    return profile;
  },

  deleteProfile: async (userId: string) => {
    const [profile] = await db
      .delete(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .returning();
    return profile;
  },
};
