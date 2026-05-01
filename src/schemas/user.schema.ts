import { t } from "elysia";
import { NullableString, NullableBoolean, NullableDate } from "../utils/schema";
import {
  parseBoolean,
  parseJsonArray,
  parseMultiSelect,
} from "../utils/query-parsers";

export const SubscriptionType = t.Union([
  t.Literal("economy"),
  t.Literal("premium"),
  t.Literal("first-class"),
  t.Literal("weekender"),
]);

export const UserSchema = t.Object({
  id: t.String(),
  displayName: NullableString,
  email: t.Union([t.String({ format: "email" }), t.Null()]),
  gender: NullableString,
  birthday: NullableString,
  verified: NullableBoolean,
  showGender: NullableBoolean,
  lastLogin: NullableDate,
  subscriptionType: t.Optional(SubscriptionType),
  phone: NullableString,
  createdAt: NullableDate,
  updatedAt: NullableDate,
  fcmToken: NullableString,
  streamToken: NullableString,
});

export const GetUsersQuerySchema = t.Object({
  userId: t.String(),

  radius: t.String(),
  age: t.String(),

  cursor: t.Optional(t.String()),
  limit: t.Optional(t.String()),

  activity: t.Optional(t.Literal("justJoined")),
  country: t.Optional(t.String()),

  // booleans
  smoking: t.Optional(t.String()),
  drinking: t.Optional(t.String()),
  hasBio: t.Optional(t.String()),
  opennessToLongDistance: t.Optional(t.String()),
  willingToRelocate: t.Optional(t.String()),

  // multi-select
  gender: t.Optional(t.String()),
  ethnicity: t.Optional(t.String()),
  zodiac: t.Optional(t.String()),
  height: t.Optional(t.String()),

  familyPlans: t.Optional(t.String()),
  educationLevel: t.Optional(t.String()),
  lookingFor: t.Optional(t.String()),
  workoutFrequency: t.Optional(t.String()),
  personality: t.Optional(t.String()),
  language: t.Optional(t.String()),
  bodyType: t.Optional(t.String()),
  loveLanguage: t.Optional(t.String()),
  religion: t.Optional(t.String()),
  pets: t.Optional(t.String()),
  sexuality: t.Optional(t.String()),
  dietaryPreference: t.Optional(t.String()),
  sleepingHabits: t.Optional(t.String()),
  travelPlans: t.Optional(t.String()),
  relationshipStatus: t.Optional(t.String()),

  minPhotos: t.Optional(t.String()),
});

export const buildUserFilters = (query: any) => {
  const radius = parseJsonArray(query.radius);
  const age = parseJsonArray(query.age);

  if (radius.length < 2 || age.length < 2) {
    throw new Error("Invalid range");
  }

  return {
    radius,
    age,
    filters: {
      currentUserId: query.userId,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : undefined,
      activity: query.activity,
      country: query.country?.toUpperCase(),

      smoking: parseBoolean(query.smoking),
      drinking: parseBoolean(query.drinking),
      hasBio: parseBoolean(query.hasBio),
      opennessToLongDistance: parseBoolean(query.opennessToLongDistance),
      willingToRelocate: parseBoolean(query.willingToRelocate),

      gender: parseMultiSelect(query.gender),
      ethnicity: parseMultiSelect(query.ethnicity),
      zodiac: parseMultiSelect(query.zodiac),
      height: parseMultiSelect(query.height),

      familyPlans: parseMultiSelect(query.familyPlans),
      educationLevel: parseMultiSelect(query.educationLevel),
      lookingFor: parseMultiSelect(query.lookingFor),
      workoutFrequency: parseMultiSelect(query.workoutFrequency),
      personality: parseMultiSelect(query.personality),
      language: parseMultiSelect(query.language),
      bodyType: parseMultiSelect(query.bodyType),
      loveLanguage: parseMultiSelect(query.loveLanguage),
      religion: parseMultiSelect(query.religion),
      pets: parseMultiSelect(query.pets),
      sexuality: parseMultiSelect(query.sexuality),
      dietaryPreference: parseMultiSelect(query.dietaryPreference),
      sleepingHabits: parseMultiSelect(query.sleepingHabits),
      travelPlans: parseMultiSelect(query.travelPlans),
      relationshipStatus: parseMultiSelect(query.relationshipStatus),
    },
    minPhotos: query.minPhotos ? Number(query.minPhotos) : undefined,
  };
};
