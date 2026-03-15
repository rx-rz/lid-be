CREATE TYPE "public"."gender" AS ENUM('MAN', 'WOMAN', 'NONBINARY');--> statement-breakpoint
CREATE TYPE "public"."onboarding_page" AS ENUM('DisplayName', 'Birthday', 'Gender', 'DatingPreference', 'Interests', 'AddPhotos');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('free', 'premium', 'gold');--> statement-breakpoint
CREATE TYPE "public"."whyhere_enum" AS ENUM('man', 'woman', 'nonbinary');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"read_status" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "dislikes" (
	"disliker_id" text NOT NULL,
	"disliked_id" text NOT NULL,
	"disliked_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "dislikes_disliker_id_disliked_id_pk" PRIMARY KEY("disliker_id","disliked_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"favorite_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "get_help" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"screenshot" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"image_url" text NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"liker_id" text NOT NULL,
	"liked_id" text NOT NULL,
	"liked_at" timestamp with time zone DEFAULT now(),
	"super_like" boolean DEFAULT false NOT NULL,
	CONSTRAINT "likes_liker_id_liked_id_pk" PRIMARY KEY("liker_id","liked_id")
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"country_abbreviation" text DEFAULT 'NG',
	"last_updated" timestamp with time zone DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "love_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"read_status" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" text NOT NULL,
	"user2_id" text NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now(),
	"status" varchar(20) DEFAULT 'pending',
	CONSTRAINT "unique_match_idx" UNIQUE("user1_id","user2_id")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"subscription_type" varchar(20) DEFAULT 'free',
	"next_billing_date" timestamp with time zone,
	"payment_status" varchar(20) DEFAULT 'active',
	"last_updated" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payment_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interests" text[],
	"looking_to_date" text[],
	"ethnicity" varchar(50) DEFAULT '',
	"pronouns" varchar(50) DEFAULT '',
	"zodiac" varchar(50) DEFAULT '',
	"bio" varchar(50) DEFAULT '',
	"why_here" "whyhere_enum",
	"smoking" boolean,
	"drinking" boolean,
	"religion" varchar(50) DEFAULT '',
	"education" varchar(50) DEFAULT '',
	"pets" varchar(50) DEFAULT '',
	"age" varchar(50) DEFAULT '',
	"distance" varchar(50) DEFAULT '',
	"language" varchar(50) DEFAULT '',
	"family_plans" varchar(50) DEFAULT '',
	"gender" varchar(50) DEFAULT '',
	"height" varchar(50) DEFAULT '',
	"has_bio" boolean DEFAULT false,
	"min_photos" varchar DEFAULT '',
	"connections" varchar DEFAULT '',
	"job_title" varchar(100) DEFAULT '',
	"company" varchar(100) DEFAULT '',
	"school" varchar(100) DEFAULT '',
	"sexuality" varchar(50) DEFAULT '',
	"body_type" varchar(50) DEFAULT '',
	"dietary_preference" varchar(50) DEFAULT '',
	"sleeping_habits" varchar(50) DEFAULT '',
	"workout_frequency" varchar(50) DEFAULT '',
	"love_language" varchar(50) DEFAULT '',
	"travel_plans" varchar(100) DEFAULT '',
	"personality" varchar(50) DEFAULT '',
	"personality_profile" text DEFAULT '',
	"relationship_status" varchar(50) DEFAULT '',
	"willing_to_relocate" boolean,
	"openness_to_long_distance" boolean,
	CONSTRAINT "preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "premium_features" (
	"user_id" text PRIMARY KEY NOT NULL,
	"visibility_boost" boolean DEFAULT false,
	"last_boosted_at" timestamp,
	"expires_at" timestamp,
	"superlikes_remaining" integer DEFAULT 0,
	"boosts_remaining" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "profile_views" (
	"viewer_id" text NOT NULL,
	"viewed_id" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now(),
	"is_new" boolean DEFAULT true,
	CONSTRAINT "profile_views_viewer_id_viewed_id_pk" PRIMARY KEY("viewer_id","viewed_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"bio" text,
	"interests" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roulette_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session1_id" uuid NOT NULL,
	"session2_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"room_id" text,
	"scheduled_end_time" timestamp
);
--> statement-breakpoint
CREATE TABLE "roulette_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" varchar(20),
	"interests" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_partners" text[]
);
--> statement-breakpoint
CREATE TABLE "swipe_limits" (
	"user_id" text NOT NULL,
	"swipe_count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"user_id" text PRIMARY KEY NOT NULL,
	"online_status" boolean DEFAULT false,
	"last_active" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" varchar(50),
	"email" text,
	"gender" "gender",
	"birthday" date,
	"verified" boolean DEFAULT false,
	"show_gender" boolean DEFAULT false,
	"last_login" timestamp with time zone,
	"subscription_type" "subscription_type" DEFAULT 'free',
	"phone" varchar(20),
	"onboarding_page" "onboarding_page",
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fcm_token" text,
	"stream_token" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"caller_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'ongoing',
	"duration" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dislikes" ADD CONSTRAINT "dislikes_disliker_id_users_id_fk" FOREIGN KEY ("disliker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dislikes" ADD CONSTRAINT "dislikes_disliked_id_users_id_fk" FOREIGN KEY ("disliked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_favorite_user_id_users_id_fk" FOREIGN KEY ("favorite_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_liker_id_users_id_fk" FOREIGN KEY ("liker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_liked_id_users_id_fk" FOREIGN KEY ("liked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "love_letters" ADD CONSTRAINT "love_letters_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "love_letters" ADD CONSTRAINT "love_letters_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_features" ADD CONSTRAINT "premium_features_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewed_id_users_id_fk" FOREIGN KEY ("viewed_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roulette_matches" ADD CONSTRAINT "roulette_matches_session1_id_roulette_sessions_id_fk" FOREIGN KEY ("session1_id") REFERENCES "public"."roulette_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roulette_matches" ADD CONSTRAINT "roulette_matches_session2_id_roulette_sessions_id_fk" FOREIGN KEY ("session2_id") REFERENCES "public"."roulette_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roulette_sessions" ADD CONSTRAINT "roulette_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_limits" ADD CONSTRAINT "swipe_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_relationship_idx" ON "blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "reverse_block_relationship_idx" ON "blocks" USING btree ("blocked_id","blocker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_location_idx" ON "location" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_payment_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_preferences_idx" ON "preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_roulette_user_idx" ON "roulette_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_swipe_limit_idx" ON "swipe_limits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_idx" ON "users" USING btree ("last_login" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "displayName_idx" ON "users" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "id_idx" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "active_users_idx" ON "users" USING btree ("last_login" DESC NULLS LAST,"verified");--> statement-breakpoint
CREATE INDEX "subscription_idx" ON "users" USING btree ("subscription_type","verified");--> statement-breakpoint
CREATE INDEX "demographic_idx" ON "users" USING btree ("gender","birthday");