import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/db";
import {
  likesTable,
  dislikesTable,
  matchesTable,
  usersTable,
  imagesTable,
} from "../db/schema";

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
        user: sql`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.displayName}, 'email', ${usersTable.email})`,
        images: sql`COALESCE(
          (SELECT array_agg(${imagesTable.imageUrl})
           FROM ${imagesTable}
           WHERE ${imagesTable.userId} = ${likesTable.likedId}),
          ARRAY[]::text[]
        )`,
      })
      .from(likesTable)
      .where(eq(likesTable.likerId, userId))
      .leftJoin(usersTable, eq(likesTable.likedId, usersTable.id))
      .groupBy(
        likesTable.likedId,
        likesTable.likedAt,
        likesTable.superLike,
        usersTable.id,
        usersTable.displayName,
        usersTable.email,
      );
  },

  getReceivedLikes: async (userId: string) => {
    return await db
      .select({
        likedId: likesTable.likerId, 
        likedAt: likesTable.likedAt,
        superLike: likesTable.superLike,
        user: sql`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.displayName}, 'email', ${usersTable.email})`,
        images: sql`COALESCE(
          (SELECT array_agg(${imagesTable.imageUrl})
           FROM ${imagesTable}
           WHERE ${imagesTable.userId} = ${likesTable.likerId}),
          ARRAY[]::text[]
        )`,
      })
      .from(likesTable)
      .where(eq(likesTable.likedId, userId))
      .leftJoin(usersTable, eq(likesTable.likerId, usersTable.id))
      .groupBy(
        likesTable.likerId,
        likesTable.likedAt,
        likesTable.superLike,
        usersTable.id,
        usersTable.displayName,
        usersTable.email,
      );
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
};
