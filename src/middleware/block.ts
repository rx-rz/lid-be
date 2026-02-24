import { Elysia } from "elysia";
import { eq, or } from "drizzle-orm";
import { blocksTable } from "../db/schema";
import { db } from "../db/db";

export const blockMiddleware = new Elysia({ name: "middleware.block" }).derive(
  async ({ query }) => {
    const currentUserId = query?.userId as string | undefined;

    if (!currentUserId) {
      return { blockedUserIds: [] };
    }

    const blockedList = await db
      .select()
      .from(blocksTable)
      .where(
        or(
          eq(blocksTable.blockedId, currentUserId),
          eq(blocksTable.blockerId, currentUserId),
        ),
      );

    const blockedUserIds = blockedList
      .map((rel) =>
        rel.blockerId === currentUserId ? rel.blockedId : rel.blockerId,
      )
      .filter((id): id is string => id !== null);

    return { blockedUserIds };
  },
);
