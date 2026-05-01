import { faker } from "@faker-js/faker";
import { db } from "../db/db";
import {
  usersTable,
  profilesTable,
  locationsTable,
  preferencesTable,
  imagesTable,
  premiumFeaturesTable,
  likesTable,
  dislikesTable,
  matchesTable,
} from "../db/schema";
import type { SubscriptionTier, Gender, OnboardingPage } from "../db/schema";
import { TIER_PERMISSIONS } from "../utils/permissions";

const GENDERS: Gender[] = ["MAN", "WOMAN", "NONBINARY"];
const SUBSCRIPTIONS: SubscriptionTier[] = [
  "economy",
  "premium",
  "first-class",
  "weekender",
];
const ONBOARDING_PAGE: OnboardingPage = "AddPhotos";

// Lowered to prevent connection pool exhaustion
const BATCH_SIZE = 25;

// --- Data Pools ---
const ZODIACS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
const RELIGIONS = [
  "Christianity",
  "Islam",
  "Atheist",
  "Agnostic",
  "Hinduism",
  "Buddhism",
  "Judaism",
  "Spiritual",
];
const PETS = ["Dog", "Cat", "Bird", "Fish", "Reptile", "None", "Want one"];
const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Arabic",
];
const ETHNICITIES = ["Black", "White", "Asian", "Hispanic", "Mixed", "Other"];
const FAMILY_PLANS = [
  "Want kids",
  "Don't want kids",
  "Have kids and want more",
  "Have kids and don't want more",
  "Not sure yet",
];
const SEXUALITIES = [
  "Straight",
  "Gay",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Queer",
];
const BODY_TYPES = [
  "Athletic",
  "Average",
  "Thin",
  "Curvy",
  "Muscular",
  "A few extra pounds",
];
const DIETS = [
  "Omnivore",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
];
const SLEEPING_HABITS = ["Early bird", "Night owl", "Flexible"];
const WORKOUT_FREQS = ["Daily", "Often", "Sometimes", "Rarely", "Never"];
const LOVE_LANGUAGES = [
  "Words of Affirmation",
  "Acts of Service",
  "Receiving Gifts",
  "Quality Time",
  "Physical Touch",
];
const TRAVEL_PLANS = [
  "Backpacker",
  "Luxury",
  "Road trips",
  "Staycation",
  "Frequent flyer",
];
const PERSONALITIES = ["Introvert", "Extrovert", "Ambivert"];
const RELATIONSHIP_STATUSES = ["Single", "Divorced", "Widowed", "Separated"];
const PRONOUNS = ["He/Him", "She/Her", "They/Them", "Other"];
const INTERESTS = [
  "traveling",
  "reading",
  "gaming",
  "cooking",
  "fitness",
  "music",
  "art",
  "photography",
  "movies",
];

// Helper to safely convert "unlimited" to an integer for the database
const parseLimit = (limit: any): number => {
  if (limit === "unlimited") return 9999;
  const parsed = Number(limit);
  return isNaN(parsed) ? 0 : parsed;
};

export const runSeeder = async (targetUserCount = 100) => {
  console.log(
    `🌱 Starting raw database seeder for ${targetUserCount} users...`,
  );
  const seededUserIds: string[] = [];

  // ==========================================
  // PHASE 1: Direct Database Inserts (Users, Profiles, Configs)
  // ==========================================
  console.log("👥 Creating users in batches...");

  for (let i = 0; i < targetUserCount; i += BATCH_SIZE) {
    const batchPromises = Array.from(
      { length: Math.min(BATCH_SIZE, targetUserCount - i) },
      async () => {
        const clerkId = `user_${faker.string.alphanumeric(27)}`;
        const phone = `+1${faker.string.numeric(10)}`;
        const gender = faker.helpers.arrayElement(GENDERS);
        const subTier = faker.helpers.arrayElement(SUBSCRIPTIONS);

        const birthday = faker.date
          .birthdate({ min: 18, max: 50, mode: "age" })
          .toISOString()
          .split("T")[0];

        try {
          // 1. Insert Base User
          await db.insert(usersTable).values({
            id: clerkId,
            displayName: faker.person.firstName(),
            email: faker.internet.email(),
            gender: gender,
            birthday: birthday,
            verified: faker.datatype.boolean({ probability: 0.7 }),
            showGender: true,
            subscriptionType: subTier,
            onboardingPage: ONBOARDING_PAGE,
            phone: phone,
            lastLogin: new Date(),
          });

          // 2. Insert Profile
          const userInterests = faker.helpers.arrayElements(INTERESTS, {
            min: 2,
            max: 5,
          });
          await db.insert(profilesTable).values({
            userId: clerkId,
            bio: faker.person.bio(),
            interests: userInterests,
          });

          // 3. Insert Premium Limits (Safe Parsing for "unlimited")
          const limits =
            TIER_PERMISSIONS[subTier] || TIER_PERMISSIONS["economy"];
          await db.insert(premiumFeaturesTable).values({
            userId: clerkId,
            superlikesRemaining: parseLimit(limits.superLikesPerWeek),
            boostsRemaining: parseLimit(limits.boostsPerWeek),
            loveLettersRemaining: parseLimit(limits.loveLettersPerWeek),
            recallsRemaining: parseLimit(limits.recallsPerWeek),
            videoCallsRemaining: parseLimit(limits.videoCalls),
          });

          // 4. Insert Location (Using Nigeria bounding box coords for accurate distance testing)
          await db.insert(locationsTable).values({
            userId: clerkId,
            latitude: faker.location.latitude({ min: 4, max: 13 }).toString(),
            longitude: faker.location.longitude({ min: 3, max: 14 }).toString(),
            countryAbbreviation: "NG",
          });

          // 5. Insert Preferences
          await db.insert(preferencesTable).values({
            userId: clerkId,
            lookingToDate: faker.helpers.arrayElements(GENDERS, {
              min: 1,
              max: 3,
            }),
            interests: userInterests,
            smoking: faker.datatype.boolean(),
            drinking: faker.datatype.boolean(),
            hasBio: true,
            opennessToLongDistance: faker.datatype.boolean(),
            willingToRelocate: faker.datatype.boolean(),
            pronouns: faker.helpers.arrayElement(PRONOUNS),
            zodiac: faker.helpers.arrayElement(ZODIACS),
            bio: faker.lorem.sentence(),
            whyHere: faker.helpers.arrayElement([
              "Long-term relationship",
              "Short-term fun",
              "New friends",
            ]),
            religion: faker.helpers.arrayElement(RELIGIONS),
            education: faker.helpers.arrayElement([
              "Bachelors",
              "Masters",
              "PhD",
              "High School",
            ]),
            pets: faker.helpers.arrayElement(PETS),
            language: faker.helpers.arrayElements(LANGUAGES, {
              min: 1,
              max: 3,
            }),
            ethnicity: faker.helpers.arrayElements(ETHNICITIES, {
              min: 1,
              max: 2,
            }),
            familyPlans: faker.helpers.arrayElement(FAMILY_PLANS),
            gender: faker.helpers.arrayElement(GENDERS),
            height: `${faker.number.int({ min: 150, max: 200 })}cm`,
            jobTitle: faker.person.jobTitle(),
            company: faker.company.name(),
            school: "University of " + faker.location.city(),
            sexuality: faker.helpers.arrayElement(SEXUALITIES),
            bodyType: faker.helpers.arrayElement(BODY_TYPES),
            dietaryPreference: faker.helpers.arrayElement(DIETS),
            sleepingHabits: faker.helpers.arrayElement(SLEEPING_HABITS),
            workoutFrequency: faker.helpers.arrayElement(WORKOUT_FREQS),
            loveLanguage: faker.helpers.arrayElement(LOVE_LANGUAGES),
            travelPlans: faker.helpers.arrayElement(TRAVEL_PLANS),
            personality: faker.helpers.arrayElement(PERSONALITIES),
            relationshipStatus: faker.helpers.arrayElement(
              RELATIONSHIP_STATUSES,
            ),
            age: "18-55",
            distance: "100",
            minNumberOfPhotos: "1",
          });

          // 6. Insert dummy images (Required for discovery visibility scoring)
          await db.insert(imagesTable).values([
            { userId: clerkId, imageUrl: faker.image.avatar(), order: 1 },
            { userId: clerkId, imageUrl: faker.image.avatar(), order: 2 },
          ]);

          return clerkId;
        } catch (error) {
          console.error(`Error inserting user ${clerkId}:`, error);
          throw error;
        }
      },
    );

    const results = await Promise.allSettled(batchPromises);
    results.forEach((res) => {
      if (res.status === "fulfilled") {
        seededUserIds.push(res.value);
      }
    });

    console.log(
      `✅ Progress: ${seededUserIds.length} / ${targetUserCount} users created.`,
    );
  }

  // ==========================================
  // PHASE 2: Generate Interactions
  // ==========================================
  console.log("💘 Preparing interaction pool...");

  const interactionsMap = new Set<string>();

  for (const likerId of seededUserIds) {
    const interactions = faker.helpers.arrayElements(seededUserIds, {
      min: 5,
      max: 15,
    });

    for (const targetId of interactions) {
      if (likerId === targetId) continue;

      const interactionKey = `${likerId}_${targetId}`;
      if (interactionsMap.has(interactionKey)) continue;

      const interactionType = faker.helpers.arrayElement([
        "LIKE",
        "SUPER_LIKE",
        "DISLIKE",
        "SKIP",
      ]);

      try {
        if (interactionType === "LIKE" || interactionType === "SUPER_LIKE") {
          await db
            .insert(likesTable)
            .values({
              likerId,
              likedId: targetId,
              superLike: interactionType === "SUPER_LIKE",
            })
            .onConflictDoNothing();

          // Check if it's a match (if target already liked liker)
          const reverseKey = `${targetId}_${likerId}`;
          if (interactionsMap.has(reverseKey)) {
            await db
              .insert(matchesTable)
              .values({
                user1Id: likerId,
                user2Id: targetId,
              })
              .onConflictDoNothing();
          }

          interactionsMap.add(interactionKey);
        } else if (interactionType === "DISLIKE") {
          await db
            .insert(dislikesTable)
            .values({
              dislikerId: likerId,
              dislikedId: targetId,
            })
            .onConflictDoNothing();

          interactionsMap.add(interactionKey);
        }
      } catch (e) {
        // Silently catch composite key duplicates
      }
    }
  }

  console.log(
    `🎉 Seeding complete! Processed ${seededUserIds.length} users and interactions.`,
  );
};

// If executing directly
if (require.main === module) {
  runSeeder().then(() => process.exit(0));
}
