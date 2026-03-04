ALTER TABLE "preferences" ALTER COLUMN "smoking" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "smoking" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "drinking" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "drinking" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "willing_to_relocate" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "willing_to_relocate" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "openness_to_long_distance" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "openness_to_long_distance" DROP DEFAULT;