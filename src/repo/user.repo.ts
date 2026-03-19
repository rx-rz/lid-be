import {
  and,
  desc,
  eq,
  gte,
  inArray,
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  usersTable,
  profilesTable,
  locationsTable,
  likesTable,
  dislikesTable,
  matchesTable,
  preferencesTable,
  imagesTable,
  userActivityTable,
  InsertUser,
  SelectUser,
  SelectImage,
  SelectProfile,
  SelectPreferences,
} from "../db/schema";
import { DrizzleDB, withDb } from "../db/db";
import { GetUsersFilters } from "../api/user/user.services";
import { decodeCursor, encodeCursor } from "../utils/cursor";

type StandardCursor = {
  createdAt: string;
  id: string;
};

export type FilteredUser = SelectUser & {
  latitude: string | null;
  longitude: string | null;
  countryAbbreviation: string | null;
  hasLikedLoggedInUser: boolean;
  superLike: boolean;
  likedAt: Date | null;
  images: SelectImage[];
  profile?: SelectProfile | null;
  preferences?: SelectPreferences | null;
  onlineStatus?: boolean | null;
};

type FindUsersResponse = {
  users: FilteredUser[];
  nextCursor: string | null;
};

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

    const user = await dbInstance.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
      columns: {
        id: true,
        displayName: true,
        email: true,
        birthday: true,
        onboardingPage: true,
        fcmToken: true,
        subscriptionType: true, // <-- NEW: Grab it directly from the user record!
      },
      with: {
        images: {
          columns: {
            imageUrl: true,
          },
          limit: 1,
        },
        // REMOVED: No need to query payments table here anymore!
      },
    });

    if (!user) return undefined;

    // Destructure out what we need to reshape
    const { images, subscriptionType, ...userData } = user;

    return {
      ...userData,
      subscription: subscriptionType, // It's guaranteed to be 'economy' or higher
      image: images?.[0]?.imageUrl ?? null,
    };
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

  findUsersWithFilters: async (
    filters: GetUsersFilters & { cursor?: string | null; limit?: number },
    db?: DrizzleDB,
  ): Promise<FindUsersResponse> => {
    const dbInstance = withDb(db);
    const limit = filters.limit ?? 20;
    const decodedCursor = filters.cursor
      ? decodeCursor<StandardCursor>(filters.cursor)
      : null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const incomingLikes = alias(likesTable, "incomingLikes");

    const baseExclusions = [
      not(eq(usersTable.id, filters.currentUserId)),
      filters.blockedUserIds?.length
        ? not(inArray(usersTable.id, filters.blockedUserIds))
        : undefined,
      filters.activity === "justJoined"
        ? gte(usersTable.createdAt, twentyFourHoursAgo)
        : undefined,
      filters.country && filters.country !== "0"
        ? eq(locationsTable.countryAbbreviation, filters.country)
        : undefined,
      notExists(
        dbInstance
          .select({ likerId: likesTable.likerId })
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
          .select({ dislikerId: dislikesTable.dislikerId })
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
          .select({ user1Id: matchesTable.user1Id })
          .from(matchesTable)
          .where(
            or(
              and(
                eq(matchesTable.user1Id, filters.currentUserId),
                eq(matchesTable.user2Id, usersTable.id),
              ),
              and(
                eq(matchesTable.user1Id, usersTable.id),
                eq(matchesTable.user2Id, filters.currentUserId),
              ),
            ),
          ),
      ),
    ];

    let superLikedUsers: any[] = [];

    if (!decodedCursor) {
      superLikedUsers = await dbInstance
        .select({
          user: usersTable,
          profile: profilesTable,
          preferences: preferencesTable,
          onlineStatus: userActivityTable.onlineStatus,
          latitude: locationsTable.latitude,
          longitude: locationsTable.longitude,
          countryAbbreviation: locationsTable.countryAbbreviation,
          hasLikedLoggedInUser: sql<boolean>`true`,
          superLike: sql<boolean>`true`,
          likedAt: incomingLikes.likedAt,
        })
        .from(usersTable)
        .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
        .leftJoin(preferencesTable, eq(preferencesTable.userId, usersTable.id))
        .leftJoin(
          userActivityTable,
          eq(userActivityTable.userId, usersTable.id),
        )
        .leftJoin(locationsTable, eq(locationsTable.userId, usersTable.id))
        .innerJoin(
          incomingLikes,
          and(
            eq(incomingLikes.likerId, usersTable.id),
            eq(incomingLikes.likedId, filters.currentUserId),
            eq(incomingLikes.superLike, true),
          ),
        )
        .where(and(...baseExclusions))
        .orderBy(desc(incomingLikes.likedAt))
        .limit(10);
    }

    const cursorCondition = decodedCursor
      ? sql`(
        ${usersTable.createdAt},
        ${usersTable.id}
      ) < (
        ${new Date(decodedCursor.createdAt).toISOString()}::timestamp,
        ${decodedCursor.id}
      )`
      : undefined;

    const rawUsers = await dbInstance
      .select({
        user: usersTable,
        profile: profilesTable,
        preferences: preferencesTable,
        onlineStatus: userActivityTable.onlineStatus,
        latitude: locationsTable.latitude,
        longitude: locationsTable.longitude,
        countryAbbreviation: locationsTable.countryAbbreviation,
        hasLikedLoggedInUser: sql<boolean>`${incomingLikes.likerId} IS NOT NULL`,
        superLike: sql<boolean>`false`,
        likedAt: incomingLikes.likedAt,
      })
      .from(usersTable)
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .leftJoin(preferencesTable, eq(preferencesTable.userId, usersTable.id))
      .leftJoin(userActivityTable, eq(userActivityTable.userId, usersTable.id))
      .leftJoin(locationsTable, eq(locationsTable.userId, usersTable.id))
      .leftJoin(
        incomingLikes,
        and(
          eq(incomingLikes.likerId, usersTable.id),
          eq(incomingLikes.likedId, filters.currentUserId),
        ),
      )
      .where(
        and(
          cursorCondition,
          ...baseExclusions,
          sql`${incomingLikes.superLike} IS NOT TRUE`,
        ),
      )
      .orderBy(desc(usersTable.createdAt), desc(usersTable.id))
      .limit(limit + 1);

    const hasMorePages = rawUsers.length > limit;
    const normalUsersToReturn = hasMorePages
      ? rawUsers.slice(0, limit)
      : rawUsers;
    const lastUser = normalUsersToReturn[normalUsersToReturn.length - 1];

    const nextCursor =
      hasMorePages && lastUser
        ? encodeCursor<StandardCursor>({
            createdAt:
              lastUser.user.createdAt?.toISOString() ??
              new Date().toISOString(),
            id: lastUser.user.id,
          })
        : null;

    const allUsersToReturn = [...superLikedUsers, ...normalUsersToReturn];

    // Fetch images in bulk to avoid flat-join group-by explosion
    const returnedUserIds = allUsersToReturn.map((u) => u.user.id);
    let imagesMap: Record<string, SelectImage[]> = {};

    if (returnedUserIds.length > 0) {
      const userImages = await dbInstance
        .select()
        .from(imagesTable)
        .where(inArray(imagesTable.userId, returnedUserIds));

      imagesMap = userImages.reduce(
        (acc, image) => {
          if (!acc[image.userId]) acc[image.userId] = [];
          acc[image.userId].push(image);
          return acc;
        },
        {} as Record<string, SelectImage[]>,
      );
    }

    return {
      users: allUsersToReturn.map((row) => ({
        ...row.user,
        profile: row.profile,
        preferences: row.preferences,
        onlineStatus: row.onlineStatus,
        latitude: row.latitude,
        longitude: row.longitude,
        countryAbbreviation: row.countryAbbreviation,
        hasLikedLoggedInUser: row.hasLikedLoggedInUser,
        superLike: row.superLike,
        likedAt: row.likedAt,
        images: imagesMap[row.user.id] || [],
      })),
      nextCursor,
    };
  },
};
