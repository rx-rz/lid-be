import { db } from "../db/db";
import { userActivityTable } from "../db/schema";

export const userActivityRepo = {
  upsertUserStatus: async (userId: string, onlineStatus: boolean) => {
    const [activity] = await db
      .insert(userActivityTable)
      .values({
        userId,
        onlineStatus,
        lastActive: new Date(),
      })
      .onConflictDoUpdate({
        target: userActivityTable.userId,
        set: {
          onlineStatus,
          lastActive: new Date(),
        },
      })
      .returning();

    return activity;
  },
};
