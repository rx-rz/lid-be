import { and, eq } from "drizzle-orm";
import { db } from "../db/db";
import { imagesTable } from "../db/schema";

export const imageRepo = {
  getImagesByUserId: async (userId: string) => {
    return await db
      .select()
      .from(imagesTable)
      .where(eq(imagesTable.userId, userId))
      .orderBy(imagesTable.order);
  },

  updateImage: async (id: number, userId: string, imageUrl: string) => {
    const [updatedImage] = await db
      .update(imagesTable)
      .set({ imageUrl })
      .where(and(eq(imagesTable.id, id), eq(imagesTable.userId, userId)))
      .returning();
    return updatedImage;
  },

  insertImage: async (userId: string, imageUrl: string, order: number) => {
    const [insertedImage] = await db
      .insert(imagesTable)
      .values({ userId, imageUrl, order })
      .returning();
    return insertedImage;
  },
};
