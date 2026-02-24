import { z } from "zod";
import { config } from "dotenv";

const NODE_ENV = process.env.NODE_ENV ?? "development";

config({
  path: NODE_ENV === "development" ? ".env.local" : ".env",
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.url(),

  PORT: z.coerce.number().default(3000),
});

export const ENV = envSchema.parse(process.env);
