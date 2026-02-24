import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/db";
import { favoritesTable, usersTable, imagesTable } from "../db/schema";

export const favoriteRepo = {
  getFavoritesByUserId: async (userId: string) => {
    return await db
      .select({
        id: favoritesTable.id,
        favoriteUserId: favoritesTable.favoriteUserId,
        createdAt: favoritesTable.createdAt,
        user: {
          id: usersTable.id,
          name: usersTable.displayName,
          email: usersTable.email,
        },
        image: sql<string>`(
          SELECT ${imagesTable.imageUrl} 
          FROM ${imagesTable} 
          WHERE ${imagesTable.userId} = ${favoritesTable.favoriteUserId}
          LIMIT 1
        )`.as("image"),
      })
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId))
      .leftJoin(usersTable, eq(favoritesTable.favoriteUserId, usersTable.id));
  },

  checkExists: async (userId: string, favoriteUserId: string) => {
    const [existing] = await db
      .select()
      .from(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, userId),
          eq(favoritesTable.favoriteUserId, favoriteUserId),
        ),
      )
      .limit(1);
    return !!existing;
  },

  addFavorite: async (userId: string, favoriteUserId: string) => {
    const [favorite] = await db
      .insert(favoritesTable)
      .values({ userId, favoriteUserId })
      .returning();
    return favorite;
  },

  removeFavorite: async (userId: string, favoriteUserId: string) => {
    const [deleted] = await db
      .delete(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, userId),
          eq(favoritesTable.favoriteUserId, favoriteUserId),
        ),
      )
      .returning();
    return deleted;
  },
};
