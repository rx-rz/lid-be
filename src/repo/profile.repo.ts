import { eq } from "drizzle-orm";
import { DrizzleDB, withDb } from "../db/db";
import {
  profilesTable,
  usersTable,
  preferencesTable,
  imagesTable,
} from "../db/schema";

export const profileRepo = {
  upsertProfile: async (
    userId: string,
    bio: string,
    interests: string[],
    db?: DrizzleDB,
  ) => {
    const dbInstance = withDb(db);
    const [profile] = await dbInstance
      .insert(profilesTable)
      .values({ userId, bio, interests })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: {
          bio: bio,
          interests: interests,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  },

  getProfileWithDetails: async (userId: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);

    const [profileRecord] = await dbInstance
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

    const images = await dbInstance
      .select({ imageUrl: imagesTable.imageUrl, order: imagesTable.order })
      .from(imagesTable)
      .where(eq(imagesTable.userId, userId));

    return {
      ...profileRecord.profile,
      user: profileRecord.user,
      preferences: profileRecord.preferences,
      images: images ?? [],
    };
  },

  updateProfile: async (
    userId: string,
    data: { bio?: string; interests?: string[] },
    db?: DrizzleDB,
  ) => {
    const dbInstance = withDb(db);
    const [profile] = await dbInstance
      .update(profilesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
    return profile;
  },

  deleteProfile: async (userId: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [profile] = await dbInstance
      .delete(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .returning();
    return profile;
  },
};
