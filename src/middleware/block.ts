import { Elysia } from "elysia";
import { eq, or } from "drizzle-orm";
import { blocksTable } from "../db/schema";
import { db } from "../db/db";

export const blockMiddleware = new Elysia({ name: "middleware.block" }).derive(
  async ({ currentUserId, query }: any) => {
    const actorId = currentUserId ?? (query?.userId as string | undefined);

    if (!actorId) {
      return { blockedUserIds: [] };
    }

    const blockedList = await db
      .select()
      .from(blocksTable)
      .where(
        or(
          eq(blocksTable.blockedId, actorId),
          eq(blocksTable.blockerId, actorId),
        ),
      );

    const blockedUserIds = blockedList
      .map((rel) =>
        rel.blockerId === actorId ? rel.blockedId : rel.blockerId,
      )
      .filter((id): id is string => id !== null);

    return { blockedUserIds };
  },
);
