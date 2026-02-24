import { and, eq, ne, not, sql, inArray, desc, or, exists } from "drizzle-orm";
import { db } from "../db/db";
import {
  rouletteMatchesTable,
  rouletteSessionsTable,
  matchesTable,
  usersTable,
} from "../db/schema";

export const rouletteRepo = {
  findSessionByUserId: async (userId: string) => {
    const [session] = await db
      .select()
      .from(rouletteSessionsTable)
      .where(eq(rouletteSessionsTable.userId, userId))
      .limit(1);
    return session;
  },

  upsertSession: async (userId: string, previousPartners: string[]) => {
    const [session] = await db
      .insert(rouletteSessionsTable)
      .values({
        id: crypto.randomUUID(),
        userId,
        status: "waiting",
        updatedAt: new Date(),
        previousPartners,
      })
      .onConflictDoUpdate({
        target: rouletteSessionsTable.userId,
        set: { status: "waiting", updatedAt: new Date() },
      })
      .returning();
    return session;
  },

  findWaitingPartner: async (
    userId: string,
    genderFilter?: string,
    previousPartners: string[] = [],
  ) => {
    return await db
      .select({ session: rouletteSessionsTable })
      .from(rouletteSessionsTable)
      .innerJoin(usersTable, eq(rouletteSessionsTable.userId, usersTable.id))
      .where(
        and(
          eq(rouletteSessionsTable.status, "waiting"),
          ne(rouletteSessionsTable.userId, userId),
          genderFilter ? eq(usersTable.gender, genderFilter as any) : sql`1=1`,
          previousPartners.length > 0
            ? not(inArray(rouletteSessionsTable.userId, previousPartners))
            : sql`1=1`,
          // Exclude accepted matches
          not(
            exists(
              db
                .select()
                .from(matchesTable)
                .where(
                  and(
                    eq(matchesTable.status, "accepted"),
                    or(
                      and(
                        eq(matchesTable.user1Id, userId),
                        eq(matchesTable.user2Id, rouletteSessionsTable.userId),
                      ),
                      and(
                        eq(matchesTable.user1Id, rouletteSessionsTable.userId),
                        eq(matchesTable.user2Id, userId),
                      ),
                    ),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(rouletteSessionsTable.createdAt)
      .limit(1);
  },

  updateSession: async (
    id: string,
    data: Partial<typeof rouletteSessionsTable.$inferInsert>,
  ) => {
    return await db
      .update(rouletteSessionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rouletteSessionsTable.id, id))
      .returning();
  },

  createMatchRecord: async (
    session1Id: string,
    session2Id: string,
    roomId: string,
    endTime: Date,
  ) => {
    const [match] = await db
      .insert(rouletteMatchesTable)
      .values({
        id: crypto.randomUUID(),
        session1Id,
        session2Id,
        roomId,
        startedAt: new Date(),
        scheduledEndTime: endTime,
      })
      .returning();
    return match;
  },

  getActiveMatch: async (sessionId: string) => {
    const [match] = await db
      .select()
      .from(rouletteMatchesTable)
      .where(
        and(
          or(
            eq(rouletteMatchesTable.session1Id, sessionId),
            eq(rouletteMatchesTable.session2Id, sessionId),
          ),
          sql`ended_at IS NULL`,
        ),
      )
      .orderBy(desc(rouletteMatchesTable.startedAt))
      .limit(1);
    return match;
  },
};
