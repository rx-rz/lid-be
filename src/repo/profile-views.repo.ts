import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../db/db";
import { profileViewsTable, usersTable, imagesTable } from "../db/schema";

export const profileViewsRepo = {
  upsertProfileView: async (viewerId: string, viewedId: string) => {
    const [view] = await db
      .insert(profileViewsTable)
      .values({ viewerId, viewedId, isNew: true, viewedAt: new Date() })
      .onConflictDoUpdate({
        target: [profileViewsTable.viewerId, profileViewsTable.viewedId],
        set: { viewedAt: new Date(), isNew: true },
      })
      .returning();
    return view;
  },

  getProfileViewsByUserId: async (userId: string) => {
    return await db
      .select({
        viewer: {
          id: usersTable.id,
          birthday: usersTable.birthday,
          displayName: usersTable.displayName,
          image: imagesTable.imageUrl,
        },
        viewedAt: profileViewsTable.viewedAt,
        isNew: profileViewsTable.isNew,
        viewerId: profileViewsTable.viewerId,
      })
      .from(profileViewsTable)
      .where(eq(profileViewsTable.viewedId, userId))
      .leftJoin(usersTable, eq(profileViewsTable.viewerId, usersTable.id))
      .leftJoin(imagesTable, eq(profileViewsTable.viewerId, imagesTable.userId))
      .orderBy(desc(profileViewsTable.viewedAt));
  },

  markViewsAsSeen: async (userId: string) => {
    await db
      .update(profileViewsTable)
      .set({ isNew: false })
      .where(
        and(
          eq(profileViewsTable.viewedId, userId),
          eq(profileViewsTable.isNew, true)
        )
      );
  },

  deleteOldViews: async (daysOld: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysOld);

    const result = await db
      .delete(profileViewsTable)
      .where(lt(profileViewsTable.viewedAt, targetDate));
    return result; 
  }
};