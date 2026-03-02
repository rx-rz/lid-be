import {
  boolean,
  date,
  pgTable,
  text,
  timestamp,
  varchar,
  index,
  uuid,
  jsonb,
  uniqueIndex,
  serial,
  integer,
  primaryKey,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";
import { InferEnum } from "drizzle-orm";

export const genderEnum = pgEnum("gender", ["MAN", "WOMAN", "NONBINARY"]);

export const subscriptionEnum = pgEnum("subscription_type", [
  "free",
  "premium",
  "gold",
]);

export const whyHereEnum = pgEnum("whyhere_enum", [
  "man",
  "woman",
  "nonbinary",
]);

export type Gender = InferEnum<typeof genderEnum>;
export type SubscriptionType = InferEnum<typeof subscriptionEnum>;

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "resolved",
  "dismissed",
]);

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    displayName: varchar("display_name", { length: 50 }),
    email: text("email").unique(),
    gender: genderEnum("gender"),
    birthday: date("birthday"),
    verified: boolean("verified").default(false),
    showGender: boolean("show_gender").default(false),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    subscriptionType: subscriptionEnum("subscription_type").default("free"),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    fcmToken: text("fcm_token"),
    streamToken: text("stream_token"),
  },
  (table) => [
    index("email_idx").on(table.email),
    index("login_idx").on(table.lastLogin.desc()),
    index("displayName_idx").on(table.displayName),
    index("id_idx").on(table.id),
    index("active_users_idx").on(table.lastLogin.desc(), table.verified),
    index("subscription_idx").on(table.subscriptionType, table.verified),
    index("demographic_idx").on(table.gender, table.birthday),
  ],
);

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .unique(),
  bio: text("bio"),
  interests: jsonb("interests").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profilesRelations = relations(profilesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [profilesTable.userId],
    references: [usersTable.id],
  }),
}));

export type InsertProfile = typeof profilesTable.$inferInsert;
export type SelectProfile = typeof profilesTable.$inferSelect;

export const preferencesTable = pgTable(
  "preferences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    interests: text("interests").array(),
    lookingToDate: text("looking_to_date").array(),

    ethnicity: varchar("ethnicity", { length: 50 }).default(""),
    pronouns: varchar("pronouns", { length: 50 }).default(""),
    zodiac: varchar("zodiac", { length: 50 }).default(""),
    bio: varchar("bio", { length: 50 }).default(""),
    whyHere: whyHereEnum("why_here"),
    smoking: boolean("smoking").default(false),
    drinking: boolean("drinking").default(false),
    religion: varchar("religion", { length: 50 }).default(""),
    education: varchar("education", { length: 50 }).default(""),
    pets: varchar("pets", { length: 50 }).default(""),
    age: varchar("age", { length: 50 }).default(""),
    distance: varchar("distance", { length: 50 }).default(""),
    language: varchar("language", { length: 50 }).default(""),
    familyPlans: varchar("family_plans", { length: 50 }).default(""),
    gender: varchar("gender", { length: 50 }).default(""),
    height: varchar("height", { length: 50 }).default(""),
    hasBio: boolean("has_bio").default(false),
    minNumberOfPhotos: varchar("min_photos").default(""),
    connections: varchar("connections").default(""),
    jobTitle: varchar("job_title", { length: 100 }).default(""),
    company: varchar("company", { length: 100 }).default(""),
    school: varchar("school", { length: 100 }).default(""),
    sexuality: varchar("sexuality", { length: 50 }).default(""),
    bodyType: varchar("body_type", { length: 50 }).default(""),
    dietaryPreference: varchar("dietary_preference", { length: 50 }).default(
      "",
    ),
    sleepingHabits: varchar("sleeping_habits", { length: 50 }).default(""),
    workoutFrequency: varchar("workout_frequency", { length: 50 }).default(""),
    loveLanguage: varchar("love_language", { length: 50 }).default(""),
    travelPlans: varchar("travel_plans", { length: 100 }).default(""),
    personality: varchar("personality", { length: 50 }).default(""),
    relationshipStatus: varchar("relationship_status", { length: 50 }).default(
      "",
    ),
    willingToRelocate: boolean("willing_to_relocate").default(false),
    opennessToLongDistance: boolean("openness_to_long_distance").default(false),
  },
  (table) => [uniqueIndex("unique_preferences_idx").on(table.userId)],
);

export const preferencesRelations = relations(preferencesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [preferencesTable.userId],
    references: [usersTable.id],
  }),
}));

export type InsertPreferences = typeof preferencesTable.$inferInsert;
export type SelectPreferences = typeof preferencesTable.$inferSelect;

export const imagesTable = pgTable("images", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  order: integer("order").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const imagesRelations = relations(imagesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [imagesTable.userId],
    references: [usersTable.id],
  }),
}));

export type InsertImage = typeof imagesTable.$inferInsert;
export type SelectImage = typeof imagesTable.$inferSelect;

export const locationsTable = pgTable(
  "location",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    latitude: text("latitude").notNull(),
    longitude: text("longitude").notNull(),
    countryAbbreviation: text("country_abbreviation").default("NG"),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("unique_location_idx").on(table.userId)],
);

export const locationsRelations = relations(locationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [locationsTable.userId],
    references: [usersTable.id],
  }),
}));

export type InsertLocation = typeof locationsTable.$inferInsert;
export type SelectLocation = typeof locationsTable.$inferSelect;

export const blocksTable = pgTable(
  "blocks",
  {
    id: text("id").primaryKey(),
    blockerId: text("blocker_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    blockedId: text("blocked_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("block_relationship_idx").on(table.blockerId, table.blockedId),
    index("reverse_block_relationship_idx").on(
      table.blockedId,
      table.blockerId,
    ),
  ],
);

export type InsertBlock = typeof blocksTable.$inferInsert;
export type SelectBlock = typeof blocksTable.$inferSelect;

export const likesTable = pgTable(
  "likes",
  {
    likerId: text("liker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    likedId: text("liked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    likedAt: timestamp("liked_at", { withTimezone: true }).defaultNow(),
    superLike: boolean("super_like").default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.likerId, table.likedId] })],
);

export const likesTableRelations = relations(likesTable, ({ one }) => ({
  liker: one(usersTable, {
    fields: [likesTable.likerId],
    references: [usersTable.id],
  }),
  liked: one(usersTable, {
    fields: [likesTable.likedId],
    references: [usersTable.id],
  }),
}));

export type InsertLike = typeof likesTable.$inferInsert;
export type SelectLike = typeof likesTable.$inferSelect;

export const dislikesTable = pgTable(
  "dislikes",
  {
    dislikerId: text("disliker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    dislikedId: text("disliked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    dislikedAt: timestamp("disliked_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.dislikerId, table.dislikedId] })],
);

export const dislikesTableRelations = relations(dislikesTable, ({ one }) => ({
  disliker: one(usersTable, {
    fields: [dislikesTable.dislikerId],
    references: [usersTable.id],
  }),
  disliked: one(usersTable, {
    fields: [dislikesTable.dislikedId],
    references: [usersTable.id],
  }),
}));

export type InsertDislike = typeof dislikesTable.$inferInsert;
export type SelectDislike = typeof dislikesTable.$inferSelect;

export const matchesTable = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user1Id: text("user1_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    user2Id: text("user2_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow(),
    status: varchar("status", { length: 20 }).default("pending"),
  },
  (table) => [unique("unique_match_idx").on(table.user1Id, table.user2Id)],
);

export const matchesTableRelations = relations(matchesTable, ({ one }) => ({
  user1: one(usersTable, {
    fields: [matchesTable.user1Id],
    references: [usersTable.id],
  }),
  user2: one(usersTable, {
    fields: [matchesTable.user2Id],
    references: [usersTable.id],
  }),
}));

export type InsertMatch = typeof matchesTable.$inferInsert;
export type SelectMatch = typeof matchesTable.$inferSelect;

export const profileViewsTable = pgTable(
  "profile_views",
  {
    viewerId: text("viewer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    viewedId: text("viewed_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
    isNew: boolean("is_new").default(true),
  },
  (table) => [primaryKey({ columns: [table.viewerId, table.viewedId] })],
);

export const profileViewsRelations = relations(
  profileViewsTable,
  ({ one }) => ({
    viewer: one(usersTable, {
      fields: [profileViewsTable.viewerId],
      references: [usersTable.id],
    }),
    viewed: one(usersTable, {
      fields: [profileViewsTable.viewedId],
      references: [usersTable.id],
    }),
  }),
);

export type InsertProfileView = typeof profileViewsTable.$inferInsert;
export type SelectProfileView = typeof profileViewsTable.$inferSelect;

export const favoritesTable = pgTable("favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  favoriteUserId: text("favorite_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const favoritesRelations = relations(favoritesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [favoritesTable.userId],
    references: [usersTable.id],
  }),
  favoriteUser: one(usersTable, {
    fields: [favoritesTable.favoriteUserId],
    references: [usersTable.id],
  }),
}));

export type InsertFavorite = typeof favoritesTable.$inferInsert;
export type SelectFavorite = typeof favoritesTable.$inferSelect;

export const chatsTable = pgTable("chats", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  readStatus: boolean("read_status").default(false),
});

export const chatsTableRelations = relations(chatsTable, ({ one }) => ({
  sender: one(usersTable, {
    fields: [chatsTable.senderId],
    references: [usersTable.id],
  }),
  receiver: one(usersTable, {
    fields: [chatsTable.receiverId],
    references: [usersTable.id],
  }),
}));

export type InsertChat = typeof chatsTable.$inferInsert;
export type SelectChat = typeof chatsTable.$inferSelect;

export const loveLettersTable = pgTable("love_letters", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  readStatus: boolean("read_status").default(false),
});

export const loveLettersTableRelations = relations(
  loveLettersTable,
  ({ one }) => ({
    sender: one(usersTable, {
      fields: [loveLettersTable.senderId],
      references: [usersTable.id],
    }),
    receiver: one(usersTable, {
      fields: [loveLettersTable.receiverId],
      references: [usersTable.id],
    }),
  }),
);

export type InsertLoveLetter = typeof loveLettersTable.$inferInsert;
export type SelectLoveLetter = typeof loveLettersTable.$inferSelect;

export const videoCallsTable = pgTable("video_calls", {
  id: serial("id").primaryKey(),
  callerId: text("caller_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).default("ongoing"),
  duration: integer("duration").default(0),
});

export const videoCallsTableRelations = relations(
  videoCallsTable,
  ({ one }) => ({
    caller: one(usersTable, {
      fields: [videoCallsTable.callerId],
      references: [usersTable.id],
    }),
    receiver: one(usersTable, {
      fields: [videoCallsTable.receiverId],
      references: [usersTable.id],
    }),
  }),
);

export type InsertVideoCall = typeof videoCallsTable.$inferInsert;
export type SelectVideoCall = typeof videoCallsTable.$inferSelect;

export const rouletteSessionsTable = pgTable(
  "roulette_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).$type<
      "waiting" | "matched" | "completed"
    >(),
    interests: text("interests").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    previousPartners: text("previous_partners").array(),
  },
  (table) => [uniqueIndex("unique_roulette_user_idx").on(table.userId)],
);

export type InsertRouletteSession = typeof rouletteSessionsTable.$inferInsert;
export type SelectRouletteSession = typeof rouletteSessionsTable.$inferSelect;

export const rouletteMatchesTable = pgTable("roulette_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  session1Id: uuid("session1_id")
    .notNull()
    .references(() => rouletteSessionsTable.id, { onDelete: "cascade" }),
  session2Id: uuid("session2_id")
    .notNull()
    .references(() => rouletteSessionsTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  roomId: text("room_id"),
  scheduledEndTime: timestamp("scheduled_end_time"),
});

export type InsertRouletteMatch = typeof rouletteMatchesTable.$inferInsert;
export type SelectRouletteMatch = typeof rouletteMatchesTable.$inferSelect;

export const reportsTable = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reportedId: text("reported_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type InsertReport = typeof reportsTable.$inferInsert;
export type SelectReport = typeof reportsTable.$inferSelect;

export const paymentsTable = pgTable(
  "payment",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    subscriptionType: varchar("subscription_type", { length: 20 }).default(
      "free",
    ),
    nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
    paymentStatus: varchar("payment_status", { length: 20 }).default("active"),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("unique_payment_idx").on(table.userId)],
);

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [paymentsTable.userId],
    references: [usersTable.id],
  }),
}));

export type InsertPayment = typeof paymentsTable.$inferInsert;
export type SelectPayment = typeof paymentsTable.$inferSelect;

export const premiumFeaturesTable = pgTable("premium_features", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  visibilityBoost: boolean("visibility_boost").default(false),
  lastBoostedAt: timestamp("last_boosted_at"),
  expiresAt: timestamp("expires_at"),
  superlikesRemaining: integer("superlikes_remaining").default(0),
  boostsRemaining: integer("boosts_remaining").default(0),
});

export type InsertPremiumFeature = typeof premiumFeaturesTable.$inferInsert;
export type SelectPremiumFeature = typeof premiumFeaturesTable.$inferSelect;

export const userActivityTable = pgTable("user_activity", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  onlineStatus: boolean("online_status").default(false),
  lastActive: timestamp("last_active", { withTimezone: true }),
});

export const userActivityTableRelations = relations(
  userActivityTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userActivityTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export type InsertUserActivity = typeof userActivityTable.$inferInsert;
export type SelectUserActivity = typeof userActivityTable.$inferSelect;

export const getHelpTable = pgTable("get_help", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  screenshot: text("screenshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertGetHelp = typeof getHelpTable.$inferInsert;
export type SelectGetHelp = typeof getHelpTable.$inferSelect;
