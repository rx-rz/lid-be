CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "cruise_pass_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "add_on_superlikes_remaining" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "add_on_boosts_remaining" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "add_on_love_letters_remaining" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "add_on_recalls_remaining" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "add_on_video_calls_remaining" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "subscription_last_weekly_reset_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "subscription_next_weekly_reset_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "subscription_last_monthly_reset_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN IF NOT EXISTS "subscription_next_monthly_reset_at" timestamp with time zone;
