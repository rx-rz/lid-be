ALTER TABLE "premium_features" ALTER COLUMN "superlikes_remaining" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_features" ALTER COLUMN "boosts_remaining" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN "has_active_cruise_pass" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN "love_letters_remaining" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN "recalls_remaining" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_features" ADD COLUMN "video_calls_remaining" integer DEFAULT 0 NOT NULL;