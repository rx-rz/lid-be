CREATE TYPE "public"."whyhere_enum" AS ENUM('man', 'woman', 'nonbinary');--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "why_here" "whyhere_enum";