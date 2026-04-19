import { faker } from "@faker-js/faker";
import { userService } from "../api/user/user.services";
import { profileService } from "../api/profile/profile.services";
import { locationService } from "../api/location/location.services";
import { preferenceService } from "../api/preference/preference.services";
import { interactionService } from "../api/interaction/interaction.services";

import type { SubscriptionTier } from "../db/schema";
import { TIER_PERMISSIONS } from "../utils/permissions";
import { premiumFeatureRepo } from "../repo/premium.repo";
type Gender = "MAN" | "WOMAN" | "NONBINARY";

const GENDERS: Gender[] = ["MAN", "WOMAN", "NONBINARY"];
const SUBSCRIPTIONS: SubscriptionTier[] = [
  "economy",
  "premium",
  "first-class",
  "weekender",
];
const BATCH_SIZE = 50;

// Rich Seed Data Arrays
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

export const runSeeder = async (targetUserCount = 1000) => {
  console.log(`🌱 Starting batched seeder for ${targetUserCount} users...`);
  const seededUserIds: string[] = [];

  // ==========================================
  // PHASE 1: Create Users, Profiles, Locations, and Wallets
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
        const lookingToDate = faker.helpers.arrayElements(GENDERS, {
          min: 1,
          max: 3,
        });
        const birthday = faker.date
          .birthdate({ min: 18, max: 50, mode: "age" })
          .toISOString()
          .split("T")[0];

        // Process a single user completely
        await userService.createUserProfile(clerkId, phone);
        await userService.updateUser(clerkId, {
          displayName: faker.person.firstName(),
          email: faker.internet.email(),
          gender: gender,
          birthday: birthday,
          verified: faker.datatype.boolean(),
          showGender: true,
          subscriptionType: subTier,
          onboardingPage: "AddPhotos",
        });

        const limits = TIER_PERMISSIONS[subTier];
        await premiumFeatureRepo.upsertFeatures(clerkId, {
          superlikesRemaining: limits.superLikesPerWeek,
          boostsRemaining: limits.boostsPerWeek,
          loveLettersRemaining: limits.loveLettersPerWeek,
          videoCallsRemaining:
            limits.videoCalls === "unlimited" ? 9999 : limits.videoCalls,
        });

        await profileService.createProfile(
          clerkId,
          faker.person.bio(),
          faker.helpers.arrayElements(
            [
              "traveling",
              "reading",
              "gaming",
              "cooking",
              "fitness",
              "music",
              "art",
            ],
            { min: 2, max: 5 },
          ),
        );

        await locationService.createLocation(
          clerkId,
          faker.location.latitude().toString(),
          faker.location.longitude().toString(),
        );

        const pref = await preferenceService.create(clerkId, lookingToDate);

        // FULL PREFERENCES POPULATION
        await preferenceService.update(pref.id, clerkId, {
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
            "Still figuring it out",
          ]),
          religion: faker.helpers.arrayElement(RELIGIONS),
          education: faker.helpers.arrayElement([
            "Bachelors",
            "Masters",
            "PhD",
            "High School",
          ]),
          pets: faker.helpers.arrayElement(PETS),
          language: faker.helpers.arrayElements(LANGUAGES, { min: 1, max: 3 }),
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
          relationshipStatus: faker.helpers.arrayElement(RELATIONSHIP_STATUSES),
        });

        return clerkId; // Return ID on success
      },
    );

    // Run the batch concurrently
    const results = await Promise.allSettled(batchPromises);

    // Extract successful IDs
    results.forEach((res) => {
      if (res.status === "fulfilled") {
        seededUserIds.push(res.value);
      } else {
        console.error(`❌ Batch error:`, res.reason);
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

  const interactionTasks: (() => Promise<void>)[] = [];

  for (const likerId of seededUserIds) {
    const interactions = faker.helpers.arrayElements(seededUserIds, {
      min: 10,
      max: 30,
    });

    for (const targetId of interactions) {
      if (likerId === targetId) continue;

      interactionTasks.push(async () => {
        const interactionType = faker.helpers.arrayElement([
          "LIKE",
          "SUPER_LIKE",
          "DISLIKE",
          "SKIP",
        ]);
        try {
          if (interactionType === "LIKE") {
            await interactionService.likeUser(likerId, targetId, false);
          } else if (interactionType === "SUPER_LIKE") {
            await interactionService.likeUser(likerId, targetId, true);
          } else if (interactionType === "DISLIKE") {
            await interactionService.dislikeUser(likerId, targetId);
          }
        } catch (error: any) {
          const isExpectedError =
            error.message.includes("already exists") ||
            error.message.includes("cannot like yourself") ||
            error.message.includes("SWIPE_LIMIT_REACHED") ||
            error.message.includes("INSUFFICIENT_SUPERLIKES");

          if (!isExpectedError) {
            console.warn(
              `[Interaction Warning] ${likerId} -> ${targetId}:`,
              error.message,
            );
          }
        }
      });
    }
  }

  console.log(
    `🚀 Executing ${interactionTasks.length} interactions in batches...`,
  );

  for (let i = 0; i < interactionTasks.length; i += BATCH_SIZE) {
    const batch = interactionTasks.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map((task) => task()));

    if ((i + BATCH_SIZE) % (BATCH_SIZE * 20) === 0) {
      console.log(
        `⏳ Interaction progress: ${Math.min(i + BATCH_SIZE, interactionTasks.length)} / ${interactionTasks.length}`,
      );
    }
  }

  console.log(
    `🎉 Seeding complete! Processed ${seededUserIds.length} users and all interactions.`,
  );
};

// If executing directly
if (require.main === module) {
  runSeeder().then(() => process.exit(0));
}
