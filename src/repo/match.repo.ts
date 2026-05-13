import { and, desc, eq, exists, isNotNull, not, or, sql } from "drizzle-orm";
import { db, DrizzleDB, withDb } from "../db/db";
import {
  matchesTable,
  usersTable,
  locationsTable,
  imagesTable,
  userActivityTable,
  rouletteSessionsTable,
  rouletteMatchesTable,
} from "../db/schema";

export const matchRepo = {
  normalizePair: (user1Id: string, user2Id: string) => {
    const [first, second] = [user1Id, user2Id].sort();
    return { user1Id: first, user2Id: second };
  },

  createMatch: async (user1Id: string, user2Id: string, tx?: DrizzleDB) => {
    const dbInstance = withDb(tx);
    const normalized = matchRepo.normalizePair(user1Id, user2Id);
    const [match] = await dbInstance
      .insert(matchesTable)
      .values(normalized)
      .onConflictDoNothing()
      .returning();
    return (
      match ||
      (
        await dbInstance
          .select()
          .from(matchesTable)
          .where(
            and(
              eq(matchesTable.user1Id, normalized.user1Id),
              eq(matchesTable.user2Id, normalized.user2Id),
            ),
          )
          .limit(1)
      )[0]
    );
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
  getRouletteEncounter: async (user1Id: string, user2Id: string) => {
    const [encounter] = await db
      .select({ endedAt: rouletteMatchesTable.endedAt })
      .from(rouletteMatchesTable)
      .innerJoin(
        rouletteSessionsTable,
        or(
          eq(rouletteMatchesTable.session1Id, rouletteSessionsTable.id),
          eq(rouletteMatchesTable.session2Id, rouletteSessionsTable.id),
        ),
      )
      .where(
        and(
          isNotNull(rouletteMatchesTable.endedAt),
          or(
            and(
              eq(rouletteSessionsTable.userId, user1Id),
              exists(
                db
                  .select()
                  .from(rouletteSessionsTable)
                  .where(
                    and(
                      eq(rouletteSessionsTable.userId, user2Id),
                      or(
                        eq(
                          rouletteMatchesTable.session1Id,
                          rouletteSessionsTable.id,
                        ),
                        eq(
                          rouletteMatchesTable.session2Id,
                          rouletteSessionsTable.id,
                        ),
                      ),
                    ),
                  ),
              ),
            ),
          ),
        ),
      )
      .orderBy(desc(rouletteMatchesTable.endedAt))
      .limit(1);

    return encounter ?? null;
  },
};
