import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { ENV } from "./src/config/env";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
