import { eq } from "drizzle-orm";
import { db } from "../db/db"; 
import { paymentsTable } from "../db/schema"; 
export const paymentRepo = {
  createCustomerRecord: async (userId: string, stripeCustomerId: string) => {
    const [record] = await db
      .insert(paymentsTable)
      .values({
        userId,
        stripeCustomerId,
        subscriptionType: "free",
        paymentStatus: "inactive",
      })
      .returning();
    return record;
  },

  getCustomerByUserId: async (userId: string) => {
    const [record] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.userId, userId));
    return record;
  },

  updateStatusByUserId: async (
    userId: string,
    data: Partial<typeof paymentsTable.$inferInsert>,
  ) => {
    const [record] = await db
      .update(paymentsTable)
      .set(data)
      .where(eq(paymentsTable.userId, userId))
      .returning();
    return record;
  },

  updateStatusByCustomerId: async (
    stripeCustomerId: string,
    data: Partial<typeof paymentsTable.$inferInsert>,
  ) => {
    const [record] = await db
      .update(paymentsTable)
      .set(data)
      .where(eq(paymentsTable.stripeCustomerId, stripeCustomerId))
      .returning();
    return record;
  },
};
