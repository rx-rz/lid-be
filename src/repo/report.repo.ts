import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { reportsTable } from "../db/schema";

export const reportRepo = {
  create: async (data: {
    reporterId: string;
    reportedId: string;
    reason: string;
    details?: string;
  }) => {
    const [report] = await db
      .insert(reportsTable)
      .values({
        id: crypto.randomUUID(),
        ...data,
      })
      .returning();
    return report;
  },

  findAll: async () => {
    return await db.select().from(reportsTable);
  },

  updateStatus: async (id: string, status: string) => {
    const [report] = await db
      .update(reportsTable)
      .set({ status: status as any })
      .where(eq(reportsTable.id, id))
      .returning();
    return report;
  },
};
