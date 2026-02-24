import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { config } from "dotenv";
import { ENV } from "../config/env";

config({ path: ".env.local" });

const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  max: 1,
});

const db = drizzle(pool);

async function migrateDB() {
  console.log("⏳ Running migrations...");

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateDB();
