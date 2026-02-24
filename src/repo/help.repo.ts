import { db } from "../db/db";
import { getHelpTable } from "../db/schema";

export const helpRepo = {
  create: async (data: {
    email: string;
    message: string;
    screenshot?: string | null;
  }) => {
    const [entry] = await db
      .insert(getHelpTable)
      .values({
        id: crypto.randomUUID(),
        ...data,
      })
      .returning();
    return entry;
  },
  findAll: async () => {
    return await db.select().from(getHelpTable);
  },
};
