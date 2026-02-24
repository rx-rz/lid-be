import { and, eq, not, or, sql } from "drizzle-orm";
import { db } from "../db/db";
import {
  matchesTable,
  usersTable,
  locationsTable,
  imagesTable,
  userActivityTable,
} from "../db/schema";

export const matchRepo = {
  createMatch: async (user1Id: string, user2Id: string) => {
    const [match] = await db
      .insert(matchesTable)
      .values({ user1Id, user2Id })
      .returning();
    return match;
  },

  getMatchesByUserId: async (userId: string) => {
    return await db
      .select({
        match: matchesTable,
        user: usersTable,
        location: locationsTable,
        userActivity: userActivityTable,
        images: sql`array_agg(${imagesTable.imageUrl})`.as("images"),
      })
      .from(matchesTable)
      .where(
        and(
          or(
            eq(matchesTable.user1Id, userId),
            eq(matchesTable.user2Id, userId),
          ),
          not(eq(usersTable.id, userId)),
        ),
      )
      .leftJoin(
        usersTable,
        or(
          eq(matchesTable.user1Id, usersTable.id),
          eq(matchesTable.user2Id, usersTable.id),
        ),
      )
      .leftJoin(locationsTable, eq(usersTable.id, locationsTable.userId))
      .leftJoin(userActivityTable, eq(usersTable.id, userActivityTable.userId))
      .leftJoin(imagesTable, eq(usersTable.id, imagesTable.userId))
      .groupBy(
        matchesTable.user1Id,
        matchesTable.user2Id,
        matchesTable.matchedAt,
        matchesTable.status,
        usersTable.id,
        locationsTable.id,
        userActivityTable.userId,
      );
  },
};
