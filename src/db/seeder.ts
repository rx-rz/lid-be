import { faker } from "@faker-js/faker";
import { inArray, like, or } from "drizzle-orm";
import { db } from "./db";
import {
  blocksTable,
  dislikesTable,
  favoritesTable,
  imagesTable,
  likesTable,
  locationsTable,
  matchesTable,
  paymentsTable,
  preferencesTable,
  premiumFeaturesTable,
  profileViewsTable,
  profilesTable,
  reportsTable,
  userActivityTable,
  usersTable,
  type Gender,
  type InsertPreferences,
  type SubscriptionTier,
} from "./schema";
import { entitlementService } from "../services/entitlements";

type SeedUser = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  gender: Gender;
  birthday: string;
  subscriptionType: SubscriptionTier;
  verified: boolean;
  bio: string;
  interests: string[];
  lookingToDate: Gender[];
  latitude: string;
  longitude: string;
  countryAbbreviation: string;
  images: string[];
  preference: Omit<InsertPreferences, "userId">;
};

type SeederOptions = {
  targetUserCount: number;
  reset: boolean;
  seed: number;
};

const SEED_PREFIX = "seed_";
const DEFAULT_USER_COUNT = 30;
const MAX_GENERATED_USERS = 250;

const GENDERS: Gender[] = ["MAN", "WOMAN", "NONBINARY"];
const SUBSCRIPTIONS: SubscriptionTier[] = [
  "economy",
  "premium",
  "first-class",
  "weekender",
];

const INTERESTS = [
  "afrobeats",
  "art",
  "books",
  "cooking",
  "faith",
  "fashion",
  "film",
  "fitness",
  "football",
  "gaming",
  "jollof debates",
  "language exchange",
  "live music",
  "photography",
  "poetry",
  "road trips",
  "salsa",
  "startups",
  "travel",
  "volunteering",
];

const seedImage = (slug: string, index: number) =>
  `https://images.loveindiaspora.test/${slug}-${index}.jpg`;

const parseLimit = (limit: number | "unlimited" | boolean | undefined) => {
  if (limit === "unlimited" || limit === false) return 9999;
  if (limit === true || limit === undefined) return 0;
  return typeof limit === "number" && Number.isFinite(limit) ? limit : 0;
};

const preferenceDefaults = (
  overrides: Partial<Omit<InsertPreferences, "userId">> = {},
): Omit<InsertPreferences, "userId"> => ({
  interests: ["travel", "music", "food"],
  lookingToDate: ["MAN", "WOMAN"],
  pronouns: "They/Them",
  zodiac: "Libra",
  bio: "Building something intentional across cultures.",
  whyHere: "Long-term relationship",
  smoking: false,
  drinking: true,
  religion: "Spiritual",
  education: "Bachelors",
  pets: "Dog",
  age: "24-42",
  distance: "120",
  language: ["English"],
  ethnicity: ["Black"],
  familyPlans: "Not sure yet",
  gender: "NONBINARY",
  height: "172cm",
  hasBio: true,
  minNumberOfPhotos: "2",
  connections: "Open to diaspora connections",
  jobTitle: "Product Designer",
  company: "Remote Studio",
  school: "University of Lagos",
  sexuality: "Queer",
  bodyType: "Athletic",
  dietaryPreference: "Omnivore",
  sleepingHabits: "Night owl",
  workoutFrequency: "Sometimes",
  loveLanguage: "Quality Time",
  travelPlans: "Frequent flyer",
  personality: "Ambivert",
  personalityProfile: "Warm, curious, and direct.",
  relationshipStatus: "Single",
  willingToRelocate: true,
  opennessToLongDistance: true,
  ...overrides,
});

const scenarioUsers: SeedUser[] = [
  {
    id: "seed_amina",
    displayName: "Amina",
    email: "seed.amina@loveindiaspora.test",
    phone: "+15550001001",
    gender: "WOMAN",
    birthday: "1996-04-18",
    subscriptionType: "premium",
    verified: true,
    bio: "Lagos-born strategist in London, happiest around live music and food markets.",
    interests: ["afrobeats", "travel", "cooking", "startups"],
    lookingToDate: ["MAN", "NONBINARY"],
    latitude: "6.5244",
    longitude: "3.3792",
    countryAbbreviation: "NG",
    images: [seedImage("amina", 1), seedImage("amina", 2), seedImage("amina", 3)],
    preference: preferenceDefaults({
      interests: ["afrobeats", "travel", "cooking", "startups"],
      lookingToDate: ["MAN", "NONBINARY"],
      pronouns: "She/Her",
      zodiac: "Aries",
      gender: "WOMAN",
      height: "168cm",
      jobTitle: "Brand Strategist",
      company: "Diaspora Goods",
      language: ["English", "Yoruba"],
      whyHere: "Long-term relationship",
    }),
  },
  {
    id: "seed_kwame",
    displayName: "Kwame",
    email: "seed.kwame@loveindiaspora.test",
    phone: "+15550001002",
    gender: "MAN",
    birthday: "1992-09-03",
    subscriptionType: "first-class",
    verified: true,
    bio: "Ghanaian software lead in Toronto. Into football, jazz, and excellent plantain.",
    interests: ["football", "live music", "books", "travel"],
    lookingToDate: ["WOMAN"],
    latitude: "43.6532",
    longitude: "-79.3832",
    countryAbbreviation: "CA",
    images: [seedImage("kwame", 1), seedImage("kwame", 2)],
    preference: preferenceDefaults({
      interests: ["football", "live music", "books", "travel"],
      lookingToDate: ["WOMAN"],
      pronouns: "He/Him",
      zodiac: "Virgo",
      gender: "MAN",
      height: "183cm",
      jobTitle: "Engineering Lead",
      company: "Fintech North",
      language: ["English", "Twi"],
      whyHere: "Long-term relationship",
    }),
  },
  {
    id: "seed_zara",
    displayName: "Zara",
    email: "seed.zara@loveindiaspora.test",
    phone: "+15550001003",
    gender: "NONBINARY",
    birthday: "1998-12-12",
    subscriptionType: "economy",
    verified: false,
    bio: "Brooklyn photographer looking for soft mornings, sharp jokes, and new cities.",
    interests: ["photography", "film", "poetry", "salsa"],
    lookingToDate: ["MAN", "WOMAN", "NONBINARY"],
    latitude: "40.7128",
    longitude: "-74.0060",
    countryAbbreviation: "US",
    images: [seedImage("zara", 1), seedImage("zara", 2)],
    preference: preferenceDefaults({
      interests: ["photography", "film", "poetry", "salsa"],
      lookingToDate: ["MAN", "WOMAN", "NONBINARY"],
      pronouns: "They/Them",
      zodiac: "Sagittarius",
      gender: "NONBINARY",
      height: "170cm",
      jobTitle: "Photographer",
      company: "Self-employed",
      language: ["English", "Spanish"],
      whyHere: "New friends",
    }),
  },
  {
    id: "seed_chidi",
    displayName: "Chidi",
    email: "seed.chidi@loveindiaspora.test",
    phone: "+15550001004",
    gender: "MAN",
    birthday: "1989-06-27",
    subscriptionType: "weekender",
    verified: true,
    bio: "Abuja consultant in Berlin. Museums, faith, policy, and weekend train trips.",
    interests: ["faith", "books", "road trips", "volunteering"],
    lookingToDate: ["WOMAN"],
    latitude: "52.5200",
    longitude: "13.4050",
    countryAbbreviation: "DE",
    images: [seedImage("chidi", 1), seedImage("chidi", 2)],
    preference: preferenceDefaults({
      interests: ["faith", "books", "road trips", "volunteering"],
      lookingToDate: ["WOMAN"],
      pronouns: "He/Him",
      zodiac: "Cancer",
      religion: "Christianity",
      gender: "MAN",
      height: "178cm",
      jobTitle: "Policy Consultant",
      company: "Civic Bridge",
      language: ["English", "Igbo", "German"],
    }),
  },
  {
    id: "seed_nala",
    displayName: "Nala",
    email: "seed.nala@loveindiaspora.test",
    phone: "+15550001005",
    gender: "WOMAN",
    birthday: "1994-02-08",
    subscriptionType: "premium",
    verified: true,
    bio: "Nairobi doctor in Houston. Running, family dinners, and slow-burn romance.",
    interests: ["fitness", "cooking", "travel", "volunteering"],
    lookingToDate: ["MAN"],
    latitude: "29.7604",
    longitude: "-95.3698",
    countryAbbreviation: "US",
    images: [seedImage("nala", 1), seedImage("nala", 2), seedImage("nala", 3)],
    preference: preferenceDefaults({
      interests: ["fitness", "cooking", "travel", "volunteering"],
      lookingToDate: ["MAN"],
      pronouns: "She/Her",
      zodiac: "Aquarius",
      religion: "Christianity",
      gender: "WOMAN",
      height: "165cm",
      jobTitle: "Physician",
      company: "Houston Memorial",
      language: ["English", "Swahili"],
      workoutFrequency: "Often",
    }),
  },
  {
    id: "seed_tomi",
    displayName: "Tomi",
    email: "seed.tomi@loveindiaspora.test",
    phone: "+15550001006",
    gender: "MAN",
    birthday: "1999-07-21",
    subscriptionType: "economy",
    verified: true,
    bio: "London student, weekend DJ, still convinced my jollof ranking is objective.",
    interests: ["afrobeats", "gaming", "fashion", "jollof debates"],
    lookingToDate: ["WOMAN", "NONBINARY"],
    latitude: "51.5072",
    longitude: "-0.1276",
    countryAbbreviation: "GB",
    images: [seedImage("tomi", 1)],
    preference: preferenceDefaults({
      interests: ["afrobeats", "gaming", "fashion", "jollof debates"],
      lookingToDate: ["WOMAN", "NONBINARY"],
      pronouns: "He/Him",
      zodiac: "Cancer",
      gender: "MAN",
      height: "181cm",
      jobTitle: "Graduate Student",
      company: "University College London",
      language: ["English", "Yoruba"],
      minNumberOfPhotos: "1",
    }),
  },
];

const generatedUser = (index: number): SeedUser => {
  const id = `${SEED_PREFIX}generated_${String(index + 1).padStart(3, "0")}`;
  const gender = faker.helpers.arrayElement(GENDERS);
  const subscriptionType = faker.helpers.arrayElement(SUBSCRIPTIONS);
  const interests = faker.helpers.arrayElements(INTERESTS, { min: 3, max: 5 });
  const country = faker.helpers.arrayElement([
    { code: "NG", lat: [4.8, 12.2], lng: [3.1, 13.8] },
    { code: "GB", lat: [50.7, 55.9], lng: [-4.5, 1.6] },
    { code: "US", lat: [29.5, 40.9], lng: [-118.2, -73.8] },
    { code: "CA", lat: [43.1, 49.3], lng: [-123.1, -79.1] },
  ]);

  return {
    id,
    displayName: faker.person.firstName(),
    email: `${id}@loveindiaspora.test`,
    phone: `+1555${String(index + 2000).padStart(7, "0")}`,
    gender,
    birthday: faker.date
      .birthdate({ min: 21, max: 48, mode: "age" })
      .toISOString()
      .slice(0, 10),
    subscriptionType,
    verified: faker.datatype.boolean({ probability: 0.8 }),
    bio: faker.lorem.sentence({ min: 8, max: 16 }),
    interests,
    lookingToDate: faker.helpers.arrayElements(GENDERS, { min: 1, max: 3 }),
    latitude: faker.location
      .latitude({ min: country.lat[0], max: country.lat[1] })
      .toString(),
    longitude: faker.location
      .longitude({ min: country.lng[0], max: country.lng[1] })
      .toString(),
    countryAbbreviation: country.code,
    images: [seedImage(id, 1), seedImage(id, 2)],
    preference: preferenceDefaults({
      interests,
      lookingToDate: faker.helpers.arrayElements(GENDERS, { min: 1, max: 3 }),
      gender,
      pronouns:
        gender === "MAN" ? "He/Him" : gender === "WOMAN" ? "She/Her" : "They/Them",
      height: `${faker.number.int({ min: 152, max: 198 })}cm`,
      jobTitle: faker.person.jobTitle(),
      company: faker.company.name(),
      school: `University of ${faker.location.city()}`,
      language: faker.helpers.arrayElements(
        ["English", "Yoruba", "Igbo", "Hausa", "French", "Spanish", "Twi"],
        { min: 1, max: 3 },
      ),
    }),
  };
};

const buildSeedUsers = (targetUserCount: number) => {
  const generatedCount = Math.max(
    0,
    Math.min(targetUserCount - scenarioUsers.length, MAX_GENERATED_USERS),
  );

  return [
    ...scenarioUsers,
    ...Array.from({ length: generatedCount }, (_, index) => generatedUser(index)),
  ].slice(0, Math.max(targetUserCount, scenarioUsers.length));
};

const parseOptions = (argv: string[]): SeederOptions => {
  const getValue = (name: string) => {
    const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
    if (prefixed) return prefixed.split("=")[1];

    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const count = Number(getValue("--count") ?? process.env.SEED_USER_COUNT);
  const seed = Number(getValue("--seed") ?? process.env.SEED_RANDOM ?? 20260504);

  return {
    targetUserCount:
      Number.isFinite(count) && count > 0 ? Math.floor(count) : DEFAULT_USER_COUNT,
    reset: argv.includes("--reset") || process.env.SEED_RESET === "true",
    seed: Number.isFinite(seed) ? seed : 20260504,
  };
};

const cleanupSeedRelations = async (userIds: string[]) => {
  if (!userIds.length) return;

  await db
    .delete(profileViewsTable)
    .where(
      or(
        inArray(profileViewsTable.viewerId, userIds),
        inArray(profileViewsTable.viewedId, userIds),
      ),
    );
  await db
    .delete(favoritesTable)
    .where(
      or(
        inArray(favoritesTable.userId, userIds),
        inArray(favoritesTable.favoriteUserId, userIds),
      ),
    );
  await db
    .delete(blocksTable)
    .where(
      or(
        inArray(blocksTable.blockerId, userIds),
        inArray(blocksTable.blockedId, userIds),
      ),
    );
  await db
    .delete(reportsTable)
    .where(
      or(
        inArray(reportsTable.reporterId, userIds),
        inArray(reportsTable.reportedId, userIds),
      ),
    );
  await db
    .delete(matchesTable)
    .where(
      or(
        inArray(matchesTable.user1Id, userIds),
        inArray(matchesTable.user2Id, userIds),
      ),
    );
  await db
    .delete(likesTable)
    .where(
      or(inArray(likesTable.likerId, userIds), inArray(likesTable.likedId, userIds)),
    );
  await db
    .delete(dislikesTable)
    .where(
      or(
        inArray(dislikesTable.dislikerId, userIds),
        inArray(dislikesTable.dislikedId, userIds),
      ),
    );
  await db.delete(imagesTable).where(inArray(imagesTable.userId, userIds));
};

const resetAllSeedUsers = async () => {
  await db.delete(usersTable).where(like(usersTable.id, `${SEED_PREFIX}%`));
};

const upsertSeedUser = async (user: SeedUser) => {
  const now = new Date();
  const limits = entitlementService.getEntitlementsForTier(user.subscriptionType);

  await db
    .insert(usersTable)
    .values({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      birthday: user.birthday,
      verified: user.verified,
      showGender: true,
      subscriptionType: user.subscriptionType,
      onboardingPage: "AddPhotos",
      lastLogin: now,
      fcmToken: `seed-fcm-${user.id}`,
      streamToken: `seed-stream-${user.id}`,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        birthday: user.birthday,
        verified: user.verified,
        showGender: true,
        subscriptionType: user.subscriptionType,
        onboardingPage: "AddPhotos",
        lastLogin: now,
        fcmToken: `seed-fcm-${user.id}`,
        streamToken: `seed-stream-${user.id}`,
      },
    });

  await db
    .insert(profilesTable)
    .values({
      userId: user.id,
      bio: user.bio,
      interests: user.interests,
    })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: {
        bio: user.bio,
        interests: user.interests,
        updatedAt: now,
      },
    });

  await db
    .insert(locationsTable)
    .values({
      userId: user.id,
      latitude: user.latitude,
      longitude: user.longitude,
      countryAbbreviation: user.countryAbbreviation,
      lastUpdated: now,
    })
    .onConflictDoUpdate({
      target: locationsTable.userId,
      set: {
        latitude: user.latitude,
        longitude: user.longitude,
        countryAbbreviation: user.countryAbbreviation,
        lastUpdated: now,
      },
    });

  await db
    .insert(preferencesTable)
    .values({ userId: user.id, ...user.preference })
    .onConflictDoUpdate({
      target: preferencesTable.userId,
      set: { ...user.preference, updatedAt: now },
    });

  await db
    .insert(premiumFeaturesTable)
    .values({
      userId: user.id,
      superlikesRemaining: parseLimit(limits.superLikesPerWeek),
      boostsRemaining: parseLimit(limits.boostsPerWeek),
      loveLettersRemaining: parseLimit(limits.loveLettersPerWeek),
      recallsRemaining: parseLimit(limits.recallsPerWeek),
      videoCallsRemaining: parseLimit(limits.videoCalls),
      addOnSuperlikesRemaining: user.id === "seed_amina" ? 5 : 0,
      addOnBoostsRemaining: user.id === "seed_kwame" ? 2 : 0,
      addOnLoveLettersRemaining: user.id === "seed_nala" ? 3 : 0,
      addOnRecallsRemaining: user.id === "seed_tomi" ? 1 : 0,
      addOnVideoCallsRemaining: user.id === "seed_zara" ? 4 : 0,
      hasActiveCruisePass: user.id === "seed_chidi",
      cruisePassExpiresAt:
        user.id === "seed_chidi"
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : null,
    })
    .onConflictDoUpdate({
      target: premiumFeaturesTable.userId,
      set: {
        superlikesRemaining: parseLimit(limits.superLikesPerWeek),
        boostsRemaining: parseLimit(limits.boostsPerWeek),
        loveLettersRemaining: parseLimit(limits.loveLettersPerWeek),
        recallsRemaining: parseLimit(limits.recallsPerWeek),
        videoCallsRemaining: parseLimit(limits.videoCalls),
        addOnSuperlikesRemaining: user.id === "seed_amina" ? 5 : 0,
        addOnBoostsRemaining: user.id === "seed_kwame" ? 2 : 0,
        addOnLoveLettersRemaining: user.id === "seed_nala" ? 3 : 0,
        addOnRecallsRemaining: user.id === "seed_tomi" ? 1 : 0,
        addOnVideoCallsRemaining: user.id === "seed_zara" ? 4 : 0,
        hasActiveCruisePass: user.id === "seed_chidi",
        cruisePassExpiresAt:
          user.id === "seed_chidi"
            ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            : null,
      },
    });

  await db
    .insert(userActivityTable)
    .values({
      userId: user.id,
      onlineStatus: user.id === "seed_amina" || user.id === "seed_kwame",
      lastActive: now,
    })
    .onConflictDoUpdate({
      target: userActivityTable.userId,
      set: {
        onlineStatus: user.id === "seed_amina" || user.id === "seed_kwame",
        lastActive: now,
      },
    });

  await db
    .insert(paymentsTable)
    .values({
      userId: user.id,
      stripeCustomerId: `cus_seed_${user.id.replace(SEED_PREFIX, "")}`,
      subscriptionType: user.subscriptionType,
      paymentStatus: user.subscriptionType === "economy" ? "inactive" : "active",
      nextBillingDate:
        user.subscriptionType === "economy"
          ? null
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoUpdate({
      target: paymentsTable.userId,
      set: {
        stripeCustomerId: `cus_seed_${user.id.replace(SEED_PREFIX, "")}`,
        subscriptionType: user.subscriptionType,
        paymentStatus:
          user.subscriptionType === "economy" ? "inactive" : "active",
        nextBillingDate:
          user.subscriptionType === "economy"
            ? null
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        lastUpdated: now,
      },
    });

  await db.insert(imagesTable).values(
    user.images.map((imageUrl, index) => ({
      userId: user.id,
      imageUrl,
      order: index + 1,
    })),
  );
};

const seedSocialGraph = async (userIds: string[]) => {
  const required = [
    "seed_amina",
    "seed_kwame",
    "seed_zara",
    "seed_chidi",
    "seed_nala",
    "seed_tomi",
  ];
  if (!required.every((id) => userIds.includes(id))) return;

  await db.insert(likesTable).values([
    { likerId: "seed_amina", likedId: "seed_kwame", superLike: true },
    { likerId: "seed_kwame", likedId: "seed_amina", superLike: false },
    { likerId: "seed_zara", likedId: "seed_amina", superLike: false },
    { likerId: "seed_chidi", likedId: "seed_nala", superLike: true },
    { likerId: "seed_nala", likedId: "seed_chidi", superLike: false },
    { likerId: "seed_tomi", likedId: "seed_zara", superLike: false },
  ]);

  await db.insert(dislikesTable).values([
    { dislikerId: "seed_amina", dislikedId: "seed_tomi" },
    { dislikerId: "seed_kwame", dislikedId: "seed_zara" },
  ]);

  await db.insert(matchesTable).values([
    { user1Id: "seed_amina", user2Id: "seed_kwame", status: "matched" },
    { user1Id: "seed_chidi", user2Id: "seed_nala", status: "matched" },
  ]);

  await db.insert(favoritesTable).values([
    { userId: "seed_amina", favoriteUserId: "seed_kwame" },
    { userId: "seed_kwame", favoriteUserId: "seed_amina" },
    { userId: "seed_nala", favoriteUserId: "seed_chidi" },
  ]);

  await db.insert(profileViewsTable).values([
    { viewerId: "seed_kwame", viewedId: "seed_amina", isNew: true },
    { viewerId: "seed_zara", viewedId: "seed_amina", isNew: true },
    { viewerId: "seed_amina", viewedId: "seed_kwame", isNew: false },
  ]);

  await db.insert(blocksTable).values({
    id: "seed-block-tomi-chidi",
    blockerId: "seed_tomi",
    blockedId: "seed_chidi",
  });

  await db.insert(reportsTable).values({
    reporterId: "seed_zara",
    reportedId: "seed_tomi",
    reason: "Inappropriate message",
    details: "Seed report for moderation endpoint testing.",
    status: "pending",
  });

  const generatedIds = userIds.filter((id) => id.startsWith(`${SEED_PREFIX}generated_`));
  const interactionRows = generatedIds.slice(0, 20).flatMap((targetId, index) => {
    const likerId = index % 2 === 0 ? "seed_amina" : "seed_kwame";
    return [{ likerId, likedId: targetId, superLike: index % 7 === 0 }];
  });

  if (interactionRows.length) {
    await db.insert(likesTable).values(interactionRows).onConflictDoNothing();
  }
};

export const runSeeder = async (options: Partial<SeederOptions> | number = {}) => {
  const optionOverrides =
    typeof options === "number" ? { targetUserCount: options } : options;
  const resolved = {
    targetUserCount: DEFAULT_USER_COUNT,
    reset: false,
    seed: 20260504,
    ...optionOverrides,
  };

  faker.seed(resolved.seed);

  const users = buildSeedUsers(resolved.targetUserCount);
  const userIds = users.map((user) => user.id);

  console.log(
    `Starting database seeder with ${users.length} users (seed ${resolved.seed}).`,
  );

  if (resolved.reset) {
    console.log(`Resetting existing ${SEED_PREFIX} records.`);
    await resetAllSeedUsers();
  } else {
    await cleanupSeedRelations(userIds);
  }

  for (const user of users) {
    await upsertSeedUser(user);
  }

  await seedSocialGraph(userIds);

  console.log("Seed users ready:");
  console.table(
    scenarioUsers.map((user) => ({
      id: user.id,
      email: user.email,
      tier: user.subscriptionType,
    })),
  );
  console.log(
    `Done. Use --reset to remove all ${SEED_PREFIX} users before reseeding.`,
  );

  return {
    usersCreatedOrUpdated: users.length,
    scenarioUserIds: scenarioUsers.map((user) => user.id),
    reset: resolved.reset,
    seed: resolved.seed,
  };
};

if (import.meta.main) {
  runSeeder(parseOptions(Bun.argv.slice(2)))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeder failed:", error);
      process.exit(1);
    });
}
