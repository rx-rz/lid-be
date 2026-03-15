import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { ENV } from "../config/env";
import { PgTransaction } from "drizzle-orm/pg-core";

const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export type DrizzleDB = typeof db | PgTransaction<any, typeof schema, any>;

export const withDb = (externalDB?: DrizzleDB | null): typeof db  => {
  return (externalDB ?? db) as typeof db;
};
