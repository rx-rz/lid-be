ALTER TABLE "payment" ALTER COLUMN "subscription_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "subscription_type" SET DEFAULT 'economy'::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_type" SET DEFAULT 'economy'::text;--> statement-breakpoint
DROP TYPE "public"."subscription_tier";--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('economy', 'premium', 'first-class', 'weekender');--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "subscription_type" SET DEFAULT 'economy'::"public"."subscription_tier";--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "subscription_type" SET DATA TYPE "public"."subscription_tier" USING "subscription_type"::"public"."subscription_tier";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_type" SET DEFAULT 'economy'::"public"."subscription_tier";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_type" SET DATA TYPE "public"."subscription_tier" USING "subscription_type"::"public"."subscription_tier";--> statement-breakpoint
DROP TYPE "public"."subscription_type";