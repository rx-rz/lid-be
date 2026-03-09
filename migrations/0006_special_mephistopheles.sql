CREATE TYPE "public"."onboarding_page" AS ENUM('DisplayName', 'Birthday', 'Gender', 'DatingPreference', 'Interests', 'AddPhotos');--> statement-breakpoint
CREATE TABLE "swipe_limits" (
	"user_id" text NOT NULL,
	"swipe_count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_page" "onboarding_page";--> statement-breakpoint
ALTER TABLE "swipe_limits" ADD CONSTRAINT "swipe_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_swipe_limit_idx" ON "swipe_limits" USING btree ("user_id");