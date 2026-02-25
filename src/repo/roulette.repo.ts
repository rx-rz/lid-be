import { and, desc, eq, inArray, ne, not, or, sql } from "drizzle-orm";
import { db } from "../db/db";
import { rouletteMatchesTable, rouletteSessionsTable } from "../db/schema";

export const rouletteRepo = {
  findSessionByUserId: async (userId: string) => {
    const [session] = await db
      .select()
      .from(rouletteSessionsTable)
      .where(eq(rouletteSessionsTable.userId, userId))
      .limit(1);
    return session;
  },

  getSessionById: async (sessionId: string) => {
    const [session] = await db
      .select()
      .from(rouletteSessionsTable)
      .where(eq(rouletteSessionsTable.id, sessionId))
      .limit(1);
    return session;
  },

  upsertWaitingSession: async (userId: string, previousPartners: string[]) => {
    const sessionId = crypto.randomUUID();
    const currentTime = new Date();

    const [session] = await db
      .insert(rouletteSessionsTable)
      .values({
        id: sessionId,
        userId,
        status: "waiting",
        updatedAt: currentTime,
        previousPartners,
      })
      .onConflictDoUpdate({
        target: rouletteSessionsTable.userId,
        set: {
          status: "waiting",
          updatedAt: currentTime,
        },
      })
      .returning();

    return session;
  },

  updateSession: async (sessionId: string, data: Partial<typeof rouletteSessionsTable.$inferInsert>) => {
    const [updated] = await db
      .update(rouletteSessionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rouletteSessionsTable.id, sessionId))
      .returning();
    return updated;
  },

  findCompatiblePartner: async (userId: string, previousPartners: string[]) => {
    const partners = await db
      .select()
      .from(rouletteSessionsTable)
      .where(
        and(
          eq(rouletteSessionsTable.status, "waiting"),
          ne(rouletteSessionsTable.userId, userId),
          previousPartners.length > 0
            ? not(inArray(rouletteSessionsTable.userId, previousPartners))
            : sql`1=1`
        )
      )
      .orderBy(rouletteSessionsTable.createdAt)
      .limit(1);
    
    return partners[0];
  },

  claimPartner: async (partnerId: string) => {
    const [updatedPartner] = await db
      .update(rouletteSessionsTable)
      .set({
        status: "matched",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(rouletteSessionsTable.id, partnerId),
          eq(rouletteSessionsTable.status, "waiting")
        )
      )
      .returning();
      
    return updatedPartner;
  },

  createMatchRecord: async (session1Id: string, session2Id: string, roomId: string, scheduledEndTime: Date) => {
    const matchId = crypto.randomUUID();
    const [match] = await db
      .insert(rouletteMatchesTable)
      .values({
        id: matchId,
        session1Id,
        session2Id,
        roomId,
        startedAt: new Date(),
        scheduledEndTime,
      })
      .returning();
    return match;
  },

  getActiveMatchForSession: async (sessionId: string) => {
    const [match] = await db
      .select()
      .from(rouletteMatchesTable)
      .where(
        and(
          or(
            eq(rouletteMatchesTable.session1Id, sessionId),
            eq(rouletteMatchesTable.session2Id, sessionId)
          ),
          sql`ended_at IS NULL`
        )
      )
      .orderBy(desc(rouletteMatchesTable.startedAt))
      .limit(1);
    return match;
  },

  getMatchById: async (matchId: string) => {
    const [match] = await db
      .select()
      .from(rouletteMatchesTable)
      .where(eq(rouletteMatchesTable.id, matchId))
      .limit(1);
    return match;
  },

  endMatch: async (matchId: string) => {
    const [match] = await db
      .update(rouletteMatchesTable)
      .set({ endedAt: new Date() })
      .where(eq(rouletteMatchesTable.id, matchId))
      .returning();
    return match;
  },

  getExpiredMatches: async (now: Date) => {
    return await db
      .select()
      .from(rouletteMatchesTable)
      .where(and(sql`scheduled_end_time < ${now}`, sql`ended_at IS NULL`));
  },

  getUserMatchHistory: async (userId: string, limit: number) => {
    const userSessions = await db
      .select({ id: rouletteSessionsTable.id })
      .from(rouletteSessionsTable)
      .where(eq(rouletteSessionsTable.userId, userId));

    if (userSessions.length === 0) return [];

    const sessionIds = userSessions.map((s) => s.id);

    return await db
      .select()
      .from(rouletteMatchesTable)
      .where(
        or(
          inArray(rouletteMatchesTable.session1Id, sessionIds),
          inArray(rouletteMatchesTable.session2Id, sessionIds)
        )
      )
      .orderBy(desc(rouletteMatchesTable.startedAt))
      .limit(limit);
  },

  getSystemStats: async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rouletteSessionsTable)
      .where(
        and(
          or(
            eq(rouletteSessionsTable.status, "waiting"),
            eq(rouletteSessionsTable.status, "matched")
          ),
          sql`updated_at > ${oneDayAgo}`
        )
      );

    const [waitingUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rouletteSessionsTable)
      .where(eq(rouletteSessionsTable.status, "waiting"));

    const [activeMatches] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rouletteMatchesTable)
      .where(sql`ended_at IS NULL`);

    const [recentMatches] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rouletteMatchesTable)
      .where(sql`started_at > ${oneDayAgo}`);

    const [avgDuration] = await db
      .select({
        avg: sql<number>`avg(extract(epoch from (ended_at - started_at))) * 1000`,
      })
      .from(rouletteMatchesTable)
      .where(and(sql`ended_at IS NOT NULL`, sql`started_at > ${oneDayAgo}`));

    return {
      activeUsers: Number(activeUsers?.count || 0),
      waitingUsers: Number(waitingUsers?.count || 0),
      activeMatches: Number(activeMatches?.count || 0),
      matchesLast24h: Number(recentMatches?.count || 0),
      avgMatchDurationMs: Math.round(Number(avgDuration?.avg || 0)),
      timestamp: now,
    };
  },
};