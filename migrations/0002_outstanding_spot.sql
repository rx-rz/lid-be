ALTER TABLE "matches" ALTER COLUMN "status" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "pronouns" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "pronouns" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "zodiac" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "zodiac" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "bio" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "bio" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "why_here" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "religion" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "religion" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "education" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "education" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "pets" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "pets" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "age" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "age" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "distance" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "distance" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "language" SET DATA TYPE varchar(300)[];--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "language" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "ethnicity" SET DATA TYPE varchar(300)[];--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "ethnicity" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "family_plans" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "family_plans" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "gender" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "gender" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "height" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "height" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "job_title" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "job_title" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "company" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "company" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "school" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "school" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "sexuality" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "sexuality" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "body_type" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "body_type" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "dietary_preference" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "dietary_preference" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "sleeping_habits" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "sleeping_habits" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "workout_frequency" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "workout_frequency" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "love_language" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "love_language" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "travel_plans" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "travel_plans" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "personality" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "personality" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "relationship_status" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "relationship_status" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "roulette_sessions" ALTER COLUMN "status" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_name" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "video_calls" ALTER COLUMN "status" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "video_calls" ALTER COLUMN "status" SET DEFAULT 'ongoing';