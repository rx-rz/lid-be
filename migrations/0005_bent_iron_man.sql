DO $$ BEGIN
 CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."push_provider" AS ENUM('expo', 'fcm');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "provider" "push_provider" DEFAULT 'expo' NOT NULL,
  "platform" "device_platform" DEFAULT 'unknown' NOT NULL,
  "device_id" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "user_push_tokens"
 ADD CONSTRAINT "user_push_tokens_user_id_users_id_fk"
 FOREIGN KEY ("user_id")
 REFERENCES "public"."users"("id")
 ON DELETE cascade
 ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_push_token_idx"
ON "user_push_tokens" USING btree ("user_id","token");

CREATE INDEX IF NOT EXISTS "user_push_tokens_user_idx"
ON "user_push_tokens" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "user_push_tokens_provider_idx"
ON "user_push_tokens" USING btree ("provider");

CREATE INDEX IF NOT EXISTS "user_push_tokens_enabled_idx"
ON "user_push_tokens" USING btree ("enabled");