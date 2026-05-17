import { desc, eq, and, sql, exists } from "drizzle-orm";
import { db, DrizzleDB, withDb } from "../db/db";
import {
  likesTable,
  dislikesTable,
  matchesTable,
  usersTable,
  imagesTable,
  swipeLimitsTable,
} from "../db/schema";
import { alias } from "drizzle-orm/pg-core";
import { TooManyRequestsError } from "../middleware/error";

export const interactionRepo = {
  getExistingLike: async (likerId: string, likedId: string, tx?: DrizzleDB) => {
    const dbInstance = withDb(tx);
    const [like] = await dbInstance
      .select()
      .from(likesTable)
      .where(
        and(eq(likesTable.likerId, likerId), eq(likesTable.likedId, likedId)),
      )
      .limit(1);
    return like;
  },

  createLike: async (
    likerId: string,
    likedId: string,
    superLike: boolean = false,
    isLoveLetter: boolean = false,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const [like] = await dbInstance
      .insert(likesTable)
      .values({ likerId, likedId, superLike, isLoveLetter })
      .onConflictDoNothing()
      .returning();
    return like;
  },
  getExistingLoveLetterLike: async (
    likerId: string,
    likedId: string,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const [like] = await dbInstance
      .select()
      .from(likesTable)
      .where(
        and(
          eq(likesTable.likerId, likerId),
          eq(likesTable.likedId, likedId),
          eq(likesTable.isLoveLetter, true),
        ),
      )
      .limit(1);
    return like;
  },

  getExistingDislike: async (
    dislikerId: string,
    dislikedId: string,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const [dislike] = await dbInstance
      .select()
      .from(dislikesTable)
      .where(
        and(
          eq(dislikesTable.dislikerId, dislikerId),
          eq(dislikesTable.dislikedId, dislikedId),
        ),
      )
      .limit(1);
    return dislike;
  },

  createDislike: async (
    dislikerId: string,
    dislikedId: string,
    tx?: DrizzleDB,
  ) => {
    const dbInstance = withDb(tx);
    const [dislike] = await dbInstance
      .insert(dislikesTable)
      .values({ dislikerId, dislikedId })
      .onConflictDoNothing()
      .returning();
    return dislike;
  },

  getLikedUsers: async (userId: string) => {
    return await db
      .select({
        likedId: likesTable.likedId,
        likedAt: likesTable.likedAt,
        superLike: likesTable.superLike,
        isLoveLetter: likesTable.isLoveLetter,
        user: {
          id: usersTable.id,
          name: usersTable.displayName,
          email: usersTable.email,
          birthday: usersTable.birthday,
        },
        images: sql<string[]>`COALESCE(
          (SELECT array_agg(${imagesTable.imageUrl})
           FROM ${imagesTable}
           WHERE ${imagesTable.userId} = ${likesTable.likedId}),
          ARRAY[]::text[]
        )`,
      })
      .from(likesTable)
      .where(eq(likesTable.likerId, userId))
      .leftJoin(usersTable, eq(likesTable.likedId, usersTable.id));
  },

  getReceivedLikes: async (userId: string) => {
    return await db
      .select({
        likedId: likesTable.likerId,
        likedAt: likesTable.likedAt,
        superLike: likesTable.superLike,
        isLoveLetter: likesTable.isLoveLetter,
        user: {
          id: usersTable.id,
          name: usersTable.displayName,
          email: usersTable.email,
          birthday: usersTable.birthday,
        },
        images: sql<string[]>`COALESCE(
          (SELECT array_agg(${imagesTable.imageUrl})
           FROM ${imagesTable}
           WHERE ${imagesTable.userId} = ${likesTable.likerId}),
          ARRAY[]::text[]
        )`,
      })
      .from(likesTable)
      .where(eq(likesTable.likedId, userId))
      .leftJoin(usersTable, eq(likesTable.likerId, usersTable.id))
      .orderBy(desc(likesTable.likedAt));
  },

  getInteractionHistoryIds: async (userId: string) => {
    const likedUserIds = await db
      .select({ userId: likesTable.likedId })
      .from(likesTable)
      .where(eq(likesTable.likerId, userId));

    const dislikedUserIds = await db
      .select({ userId: dislikesTable.dislikedId })
      .from(dislikesTable)
      .where(eq(dislikesTable.dislikerId, userId));

    const matchedUserIds = await db
      .select({ userId: matchesTable.user1Id })
      .from(matchesTable)
      .where(eq(matchesTable.user2Id, userId))
      .union(
        db
          .select({ userId: matchesTable.user2Id })
          .from(matchesTable)
          .where(eq(matchesTable.user1Id, userId)),
      );

    return new Set([
      ...likedUserIds.map((u) => u.userId),
      ...dislikedUserIds.map((u) => u.userId),
      ...matchedUserIds.map((u) => u.userId),
    ]);
  },
  deleteDislike: async (dislikerId: string, dislikedId: string) => {
    const [deleted] = await db
      .delete(dislikesTable)
      .where(
        and(
          eq(dislikesTable.dislikerId, dislikerId),
          eq(dislikesTable.dislikedId, dislikedId),
        ),
      )
      .returning();
    return deleted;
  },
  checkAndIncrementSwipeLimit: async (
    userId: string,
    limit: number,
    tx?: DrizzleDB,
  ): Promise<void> => {
    const dbInstance = withDb(tx);
    const now = new Date();
    const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [record] = await dbInstance
      .select()
      .from(swipeLimitsTable)
      .where(eq(swipeLimitsTable.userId, userId))
      .limit(1);

    if (!record || record.windowStart < windowCutoff) {
      await dbInstance
        .insert(swipeLimitsTable)
        .values({ userId, swipeCount: 1, windowStart: now })
        .onConflictDoUpdate({
          target: swipeLimitsTable.userId,
          set: { swipeCount: 1, windowStart: now },
        });
      return;
    }

    if (record.swipeCount >= limit) {
      const resetTime = new Date(
        record.windowStart.getTime() + 24 * 60 * 60 * 1000,
      );
      throw new TooManyRequestsError("Swipe limit reached.", {
        code: "SWIPE_LIMIT_REACHED",
        details: [
          {
            message: "Daily swipe allowance has been reached.",
            resetTime: resetTime.toISOString(),
          },
        ],
      });
    }

    await dbInstance
      .update(swipeLimitsTable)
      .set({ swipeCount: sql`${swipeLimitsTable.swipeCount} + 1` })
      .where(eq(swipeLimitsTable.userId, userId));
  },

  getMutualLikes: async (userId: string) => {
    const reverseLikes = alias(likesTable, "reverseLikes");

    return await db
      .select({
        userId: likesTable.likedId,
        likedAt: likesTable.likedAt,
        superLike: likesTable.superLike,
        isLoveLetter: likesTable.isLoveLetter,
        user: {
          id: usersTable.id,
          name: usersTable.displayName,
          email: usersTable.email,
          birthday: usersTable.birthday,
        },
        images: sql<string[]>`COALESCE(
        (SELECT array_agg(${imagesTable.imageUrl})
         FROM ${imagesTable}
         WHERE ${imagesTable.userId} = ${likesTable.likedId}),
        ARRAY[]::text[]
      )`,
      })
      .from(likesTable)
      .leftJoin(usersTable, eq(likesTable.likedId, usersTable.id))
      .where(
        and(
          eq(likesTable.likerId, userId),
          exists(
            db
              .select({ 1: sql`1` })
              .from(reverseLikes)
              .where(
                and(
                  eq(reverseLikes.likerId, likesTable.likedId),
                  eq(reverseLikes.likedId, userId),
                ),
              ),
          ),
        ),
      );
  },
};
