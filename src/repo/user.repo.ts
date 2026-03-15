import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  not,
  notExists,
  sql,
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
import { DrizzleDB, withDb } from "../db/db";
import { GetUsersFilters } from "../api/user/user.services";



export const userRepo = {
  createUser: async (data: InsertUser, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance.insert(usersTable).values(data).returning();
    return user;
  },

  createProfile: async (userId: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [profile] = await dbInstance
      .insert(profilesTable)
      .values({ userId })
      .returning();
    return profile;
  },

  updateUser: async (id: string, data: Partial<InsertUser>, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning();
    return user;
  },

  getUserById: async (id: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const images = await dbInstance
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.userId, id));

    const [user] = await dbInstance
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        email: usersTable.email,
        subscription: paymentsTable.subscriptionType,
        birthday: usersTable.birthday,
        onboardingPage: usersTable.onboardingPage,
      })
      .from(usersTable)
      .leftJoin(paymentsTable, eq(usersTable.id, paymentsTable.userId))
      .where(eq(usersTable.id, id));

    if (!user) return undefined;
    return { ...user, image: images[0]?.imageUrl ?? null };
  },

  getUserWithFcmToken: async (id: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const images = await dbInstance
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.userId, id));

    const [user] = await dbInstance
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
    return { ...user, image: images[0]?.imageUrl ?? null };
  },

  checkUserExists: async (userId: string, db?: DrizzleDB): Promise<boolean> => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return !!user;
  },

  getUserByClerkId: async (
    clerkId: string,
    db?: DrizzleDB,
  ): Promise<boolean> => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, clerkId))
      .limit(1);
    return !!user;
  },

  getUserLocation: async (userId: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [location] = await dbInstance
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

  deleteUser: async (id: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [deleted] = await dbInstance
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
    return deleted;
  },

  updateFcmToken: async (userId: string, fcmToken: string, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance
      .update(usersTable)
      .set({ fcmToken })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  },

  updateStreamToken: async (
    userId: string,
    streamToken: string,
    db?: DrizzleDB,
  ) => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance
      .update(usersTable)
      .set({ streamToken })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  },

  findUsersWithFilters: async (filters: GetUsersFilters, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const queryConditions = [
      not(eq(usersTable.id, filters.currentUserId)),

      filters.blockedUserIds?.length
        ? not(inArray(usersTable.id, filters.blockedUserIds))
        : undefined,

      filters.lookingFor?.length
        ? inArray(usersTable.gender, filters.lookingFor)
        : undefined,

      filters.activity === "justJoined"
        ? gte(usersTable.createdAt, twentyFourHoursAgo)
        : undefined,

      filters.country && filters.country !== "0"
        ? eq(locationsTable.countryAbbreviation, filters.country)
        : undefined,

      notExists(
        dbInstance
          .select({ 1: sql`1` })
          .from(likesTable)
          .where(
            and(
              eq(likesTable.likerId, filters.currentUserId),
              eq(likesTable.likedId, usersTable.id),
            ),
          ),
      ),

      notExists(
        dbInstance
          .select({ 1: sql`1` })
          .from(dislikesTable)
          .where(
            and(
              eq(dislikesTable.dislikerId, filters.currentUserId),
              eq(dislikesTable.dislikedId, usersTable.id),
            ),
          ),
      ),

      notExists(
        dbInstance
          .select({ 1: sql`1` })
          .from(matchesTable)
          .where(
            sql`(${matchesTable.user1Id} = ${filters.currentUserId} AND ${matchesTable.user2Id} = ${usersTable.id}) OR (${matchesTable.user1Id} = ${usersTable.id} AND ${matchesTable.user2Id} = ${filters.currentUserId})`,
          ),
      ),
    ].filter((c) => c !== undefined);

    const rawUsers = await dbInstance
      .select({
        user: usersTable,
        birthday: usersTable.birthday,
        onlineStatus: userActivityTable.onlineStatus,
        latitude: locationsTable.latitude,
        longitude: locationsTable.longitude,
        countryAbbreviation: locationsTable.countryAbbreviation,
        preferences: preferencesTable,
        profile: profilesTable,
        hasLikedLoggedInUser: sql<boolean>`EXISTS (
          SELECT 1 FROM ${likesTable}
          WHERE ${likesTable.likerId} = ${usersTable.id}
          AND ${likesTable.likedId} = ${filters.currentUserId}
        )`,
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
        ? await dbInstance
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
      hasLikedLoggedInUser: u.hasLikedLoggedInUser,
      images: imagesByUser[u.user.id] ?? [],
    }));
  },
};
