ALTER TABLE "users" ALTER COLUMN "gender" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."gender";--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MAN', 'WOMAN', 'NONBINARY');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "gender" SET DATA TYPE "public"."gender" USING "gender"::"public"."gender";