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
  type InsertUser,
  type SelectUser,
  SelectImage,
  SelectProfile,
  SelectPreferences,
} from "../db/schema";
import { DrizzleDB, withDb } from "../db/db";
import { GetUsersFilters } from "../api/user/user.services";
import { Cursor, decodeCursor, encodeCursor } from "../utils/cursor";

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

type UserQueryResult = {
  user: SelectUser;
  profile: SelectProfile | null;
  preferences: SelectPreferences | null;
  onlineStatus: boolean | null;
  latitude: string | null;
  longitude: string | null;
  countryAbbreviation: string | null;
  hasLikedLoggedInUser: boolean;
  superLike: boolean;
  likedAt: Date | null;
};

export const userRepo = {
  createUser: async (data: InsertUser, db?: DrizzleDB) => {
    const dbInstance = withDb(db);
    const [user] = await dbInstance.insert(usersTable).values(data).returning();
    return user;
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
    const [user] = await dbInstance
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return user;
  },

  getUserDetailsById: async (id: string, db?: DrizzleDB) => {
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
        subscriptionType: true,
      },
      with: {
        images: {
          columns: {
            imageUrl: true,
          },
          limit: 1,
        },
      },
    });

    if (!user) return undefined;

    const { images, subscriptionType, ...userData } = user;

    return {
      ...userData,
      subscription: subscriptionType,
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
      ? decodeCursor<Cursor>(filters.cursor)
      : null;

    const baseExclusions = buildBaseExclusions(dbInstance, filters);

    // Fetch super liked users only on first page
    const superLikedUsers = !decodedCursor
      ? await fetchSuperLikedUsers(dbInstance, filters, baseExclusions)
      : [];

    // Fetch normal users with pagination
    const rawUsers = await fetchNormalUsers(
      dbInstance,
      filters,
      baseExclusions,
      decodedCursor,
      limit,
    );

    // Handle pagination
    const hasMorePages = rawUsers.length > limit;
    const normalUsersToReturn = hasMorePages
      ? rawUsers.slice(0, limit)
      : rawUsers;
    const lastUser = normalUsersToReturn[normalUsersToReturn.length - 1];

    const nextCursor =
      hasMorePages && lastUser
        ? encodeCursor<Cursor>({
            createdAt:
              lastUser.user.createdAt?.toISOString() ??
              new Date().toISOString(),
            id: lastUser.user.id,
          })
        : null;

    // Combine users and fetch their images
    const allUsersToReturn = [...superLikedUsers, ...normalUsersToReturn];
    const returnedUserIds = allUsersToReturn.map((u) => u.user.id);
    const imagesMap = await fetchAndMapImages(dbInstance, returnedUserIds);

    return {
      users: formatUserResponse(allUsersToReturn, imagesMap),
      nextCursor,
    };
  },
};

const buildBaseExclusions = (
  dbInstance: DrizzleDB,
  filters: GetUsersFilters,
) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return [
    not(eq(usersTable.id, filters.currentUserId)),
    filters.blockedUserIds?.length
      ? not(inArray(usersTable.id, filters.blockedUserIds))
      : undefined,
    // filters.activity === "justJoined"
    //   ? gte(usersTable.createdAt, twentyFourHoursAgo)
    //   : undefined,
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
  ].filter(Boolean);
};

const getCommonSelectFields = (
  incomingLikes: any,
  isSuperLike: boolean = false,
) => ({
  user: usersTable,
  profile: profilesTable,
  preferences: preferencesTable,
  onlineStatus: userActivityTable.onlineStatus,
  latitude: locationsTable.latitude,
  longitude: locationsTable.longitude,
  countryAbbreviation: locationsTable.countryAbbreviation,
  hasLikedLoggedInUser: isSuperLike
    ? sql<boolean>`true`
    : sql<boolean>`${incomingLikes.likerId} IS NOT NULL`,
  superLike: sql<boolean>`${isSuperLike}`,
  likedAt: incomingLikes.likedAt,
});

const fetchSuperLikedUsers = async (
  dbInstance: DrizzleDB,
  filters: GetUsersFilters,
  baseExclusions: any[],
): Promise<UserQueryResult[]> => {
  const incomingLikes = alias(likesTable, "incomingLikes");

  return dbInstance
    .select(getCommonSelectFields(incomingLikes, true))
    .from(usersTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
    .leftJoin(preferencesTable, eq(preferencesTable.userId, usersTable.id))
    .leftJoin(userActivityTable, eq(userActivityTable.userId, usersTable.id))
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
};

const fetchNormalUsers = async (
  dbInstance: DrizzleDB,
  filters: GetUsersFilters & { cursor?: string | null; limit?: number },
  baseExclusions: any[],
  decodedCursor: Cursor | null,
  limit: number,
): Promise<UserQueryResult[]> => {
  const incomingLikes = alias(likesTable, "incomingLikes");

  const cursorCondition = decodedCursor
    ? sql`(
        ${usersTable.createdAt},
        ${usersTable.id}
      ) < (
        ${new Date(decodedCursor.createdAt).toISOString()}::timestamp,
        ${decodedCursor.id}
      )`
    : undefined;

  return dbInstance
    .select(getCommonSelectFields(incomingLikes, false))
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
};

const fetchAndMapImages = async (
  dbInstance: DrizzleDB,
  userIds: string[],
): Promise<Record<string, SelectImage[]>> => {
  if (userIds.length === 0) return {};

  const userImages = await dbInstance
    .select()
    .from(imagesTable)
    .where(inArray(imagesTable.userId, userIds));

  return userImages.reduce(
    (acc, image) => {
      if (!acc[image.userId]) acc[image.userId] = [];
      acc[image.userId].push(image);
      return acc;
    },
    {} as Record<string, SelectImage[]>,
  );
};

const formatUserResponse = (
  rows: UserQueryResult[],
  imagesMap: Record<string, SelectImage[]>,
): FilteredUser[] => {
  return rows.map((row) => ({
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
  }));
};
