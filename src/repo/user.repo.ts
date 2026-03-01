import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  not,
  notExists,
  or,
  sql,
  ilike,
  arrayContains,
} from "drizzle-orm";
import {
  usersTable,
  profilesTable,
  preferencesTable,
  locationsTable,
  userActivityTable,
  likesTable,
  dislikesTable,
  imagesTable,
  paymentsTable,
  InsertUser,
  matchesTable,
} from "../db/schema";
import { db } from "../db/db";

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
};

export const userRepo = {
  createUser: async (data: InsertUser) => {
    const [user] = await db.insert(usersTable).values(data).returning();
    return user;
  },

  createProfile: async (userId: string) => {
    const [profile] = await db
      .insert(profilesTable)
      .values({ userId })
      .returning();
    return profile;
  },

  updateUser: async (id: string, data: Partial<InsertUser>) => {
    console.log({ id });
    const [user] = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning();
    return user;
  },

  getUserById: async (id: string) => {
    const images = await db
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.userId, id));

    const [user] = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        email: usersTable.email,
        subscription: paymentsTable.subscriptionType,
      })
      .from(usersTable)
      .leftJoin(paymentsTable, eq(usersTable.id, paymentsTable.userId))
      .where(eq(usersTable.id, id));

    if (!user) return undefined;
    return { ...user, image: images[0]?.imageUrl || null };
  },
  getUserWithFcmToken: async (id: string) => {
    const images = await db
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.userId, id));

    const [user] = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        email: usersTable.email,
        subscription: paymentsTable.subscriptionType,
        fcmToken: usersTable.fcmToken,
      })
      .from(usersTable)
      .leftJoin(paymentsTable, eq(usersTable.id, paymentsTable.userId))
      .where(eq(usersTable.id, id));

    if (!user) return undefined;
    return { ...user, image: images[0]?.imageUrl || null };
  },

  checkUserExists: async (userId: string): Promise<boolean> => {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return !!user;
  },
  getUserLocation: async (userId: string) => {
    const [location] = await db
      .select({
        latitude: locationsTable.latitude,
        longitude: locationsTable.longitude,
        countryAbbreviation: locationsTable.countryAbbreviation,
      })
      .from(locationsTable)
      .where(eq(locationsTable.userId, userId))
      .limit(1);

    return location;
  },
  deleteUser: async (id: string) => {
    // Relying on Drizzle's onDelete: 'cascade' set in the schema
    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
    return deleted;
  },

  updateFcmToken: async (userId: string, fcmToken: string) => {
    const [user] = await db
      .update(usersTable)
      .set({ fcmToken })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  },

  updateStreamToken: async (userId: string, streamToken: string) => {
    const [user] = await db
      .update(usersTable)
      .set({ streamToken })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  },

  findUsersWithFilters: async (filters: GetUsersFilters) => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const queryConditions = [
      not(eq(usersTable.id, filters.currentUserId)),

      filters.blockedUserIds?.length
        ? not(inArray(usersTable.id, filters.blockedUserIds))
        : undefined,

      filters.gender?.length
        ? inArray(usersTable.gender, filters.gender as any[])
        : undefined,

      filters.activity === "justJoined"
        ? gte(usersTable.createdAt, twentyFourHoursAgo)
        : undefined,

      filters.country && filters.country !== "0"
        ? eq(locationsTable.countryAbbreviation, filters.country)
        : undefined,

      notExists(
        db
          .select()
          .from(likesTable)
          .where(
            and(
              eq(likesTable.likerId, filters.currentUserId),
              eq(likesTable.likedId, usersTable.id),
              or(
                gte(likesTable.likedAt, sql`now() - interval '30 days'`),
                sql`EXISTS (
                SELECT 1 FROM ${matchesTable}
                WHERE (
                  (${matchesTable.user1Id} = ${filters.currentUserId} AND ${matchesTable.user2Id} = ${usersTable.id})
                  OR
                  (${matchesTable.user1Id} = ${usersTable.id} AND ${matchesTable.user2Id} = ${filters.currentUserId})
                )
              )`,
              ),
            ),
          ),
      ),

      notExists(
        db
          .select()
          .from(dislikesTable)
          .where(
            and(
              eq(dislikesTable.dislikerId, filters.currentUserId),
              eq(dislikesTable.dislikedId, usersTable.id),
            ),
          ),
      ),
    ].filter(Boolean);

    const rawUsers = await db
      .select({
        user: usersTable,
        birthday: usersTable.birthday,
        onlineStatus: userActivityTable.onlineStatus,
        latitude: locationsTable.latitude,
        longitude: locationsTable.longitude,
        countryAbbreviation: locationsTable.countryAbbreviation,
        preferences: preferencesTable,
        profile: profilesTable,
      })
      .from(usersTable)
      .leftJoin(locationsTable, eq(usersTable.id, locationsTable.userId))
      .leftJoin(preferencesTable, eq(usersTable.id, preferencesTable.userId))
      .leftJoin(profilesTable, eq(usersTable.id, profilesTable.userId))
      .leftJoin(userActivityTable, eq(usersTable.id, userActivityTable.userId))
      .where(and(...queryConditions));

    const userIds = rawUsers.map((u) => u.user.id);

    const allImages =
      userIds.length > 0
        ? await db
            .select()
            .from(imagesTable)
            .where(
              and(
                inArray(imagesTable.userId, userIds),
                isNotNull(imagesTable.imageUrl),
              ),
            )
            .orderBy(asc(imagesTable.order))
        : [];

    const imagesByUser = allImages.reduce(
      (acc, image) => {
        if (!acc[image.userId]) acc[image.userId] = [];
        acc[image.userId].push(image);
        return acc;
      },
      {} as Record<string, typeof allImages>,
    );

    return rawUsers.map((u) => ({
      ...u.user,
      birthday: u.birthday,
      onlineStatus: u.onlineStatus,
      latitude: u.latitude,
      longitude: u.longitude,
      countryAbbreviation: u.countryAbbreviation,
      preferences: u.preferences,
      profile: u.profile,
      images: imagesByUser[u.user.id] || [],
    }));
  },
};
