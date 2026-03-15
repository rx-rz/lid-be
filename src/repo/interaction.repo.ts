import { eq, and, sql, exists } from "drizzle-orm";
import { db } from "../db/db";
import {
  likesTable,
  dislikesTable,
  matchesTable,
  usersTable,
  imagesTable,
  swipeLimitsTable,
} from "../db/schema";
import { alias } from "drizzle-orm/pg-core";

export const interactionRepo = {
  getExistingLike: async (likerId: string, likedId: string) => {
    const [like] = await db
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
  ) => {
    const [like] = await db
      .insert(likesTable)
      .values({ likerId, likedId, superLike })
      .returning();
    return like;
  },

  getExistingDislike: async (dislikerId: string, dislikedId: string) => {
    const [dislike] = await db
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

  createDislike: async (dislikerId: string, dislikedId: string) => {
    const [dislike] = await db
      .insert(dislikesTable)
      .values({ dislikerId, dislikedId })
      .returning();
    return dislike;
  },

  getLikedUsers: async (userId: string) => {
    return await db
      .select({
        likedId: likesTable.likedId,
        likedAt: likesTable.likedAt,
        superLike: likesTable.superLike,
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
      .leftJoin(usersTable, eq(likesTable.likerId, usersTable.id));
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

  checkAndIncrementSwipeLimit: async (userId: string): Promise<void> => {
    const now = new Date();
    const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [record] = await db
      .select()
      .from(swipeLimitsTable)
      .where(eq(swipeLimitsTable.userId, userId))
      .limit(1);

    if (!record || record.windowStart < windowCutoff) {
      await db
        .insert(swipeLimitsTable)
        .values({ userId, swipeCount: 1, windowStart: now })
        .onConflictDoUpdate({
          target: swipeLimitsTable.userId,
          set: { swipeCount: 1, windowStart: now },
        });
      return;
    }

    if (record.swipeCount >= 25) {
      const resetTime = new Date(
        record.windowStart.getTime() + 24 * 60 * 60 * 1000,
      );
      throw new Error(`SWIPE_LIMIT_REACHED:${resetTime.toISOString()}`);
    }

    await db
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
