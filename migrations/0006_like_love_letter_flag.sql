ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "is_love_letter" boolean DEFAULT false NOT NULL;
