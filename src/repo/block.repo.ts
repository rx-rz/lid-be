import { and, eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { blocksTable } from "../db/schema";

export const blockRepo = {
  getExistingBlock: async (blockerId: string, blockedId: string) => {
    const [block] = await db
      .select()
      .from(blocksTable)
      .where(
        and(
          eq(blocksTable.blockerId, blockerId),
          eq(blocksTable.blockedId, blockedId),
        ),
      )
      .limit(1);
    return block;
  },

  createBlock: async (blockerId: string, blockedId: string) => {
    const [block] = await db
      .insert(blocksTable)
      .values({
        id: crypto.randomUUID(),
        blockerId,
        blockedId,
      })
      .returning();
    return block;
  },


  getBlockedUserIds: async (userId: string) => {
    const blocks = await db
      .select()
      .from(blocksTable)
      .where(
        or(
          eq(blocksTable.blockerId, userId),
          eq(blocksTable.blockedId, userId),
        ),
      );

    return blocks.map((b) =>
      b.blockerId === userId ? b.blockedId : b.blockerId,
    );
  },
};
