import { Elysia, t } from "elysia";
import { clerkPlugin } from "elysia-clerk";

import { userRepo } from "../../repo/user.repo";
import { blockMiddleware } from "../../middleware/block";
import { userService } from "./user.services";
import { interactionService } from "../interaction/interaction.services";

const ErrorResponse = t.Object({ error: t.String() });
const FailResponse = t.Object({ status: t.String(), message: t.String() });

const UserSchema = t.Object({
  id: t.String(),
  displayName: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String({ format: "email" }), t.Null()]),
  gender: t.Union([t.String(), t.Null()]),
  birthday: t.Union([t.String(), t.Null()]),
  verified: t.Union([t.Boolean(), t.Null()]),
  showGender: t.Union([t.Boolean(), t.Null()]),
  lastLogin: t.Union([t.String(), t.Date(), t.Null()]),
  subscriptionType: t.Optional(
    t.Union([
      t.Literal("economy"),
      t.Literal("premium-economy"),
      t.Literal("first-class"),
      t.Literal("weekender"),
    ]),
  ),
  phone: t.Union([t.String(), t.Null()]),
  createdAt: t.Union([t.String(), t.Date(), t.Null()]),
  updatedAt: t.Union([t.String(), t.Date(), t.Null()]),
  fcmToken: t.Union([t.String(), t.Null()]),
  streamToken: t.Union([t.String(), t.Null()]),
});

const parseMultiSelect = (val?: string): string[] | undefined => {
  if (!val) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(val));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [val];
  }
};

const parseBooleanFilter = (val?: string): boolean | undefined => {
  if (val === "true") return true;
  if (val === "false") return false;
  return undefined;
};

export const userRoutes = new Elysia({ name: "routes.user" })
  .use(clerkPlugin())
  .post(
    "/user",
    async ({ body, set }) => {
      try {
        const data = await userService.createUserProfile(
          body.clerkId,
          body.phone,
        );
        set.status = 201;
        return data;
      } catch (error: any) {
        set.status = 400;
        return { error: error.message || "Failed to create user" };
      }
    },
    {
      body: t.Object({
        clerkId: t.String(),
        phone: t.Optional(t.String()),
      }),
      response: {
        201: UserSchema,
        400: ErrorResponse,
      },
      detail: {
        tags: ["User"],
        summary: "Create User Profile (Onboarding Step 1)",
        description:
          "Creates a new user account and automatically generates a default profile attached to it.",
      },
    },
  )
  .patch(
    "/user/:id",
    async ({ params: { id }, body, set }) => {
      try {
        const data = await userService.updateUser(id, {
          ...body,
          lastLogin: body.lastLogin ? new Date(body.lastLogin) : undefined,
        });

        if (!data) {
          set.status = 404;
          return { error: "User not found or not updated" };
        }

        return data;
      } catch (error: any) {
        set.status = 500;
        return { error: error.message || "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      transform({ body }) {
        if (!body || typeof body !== "object") return;

        for (const [key, value] of Object.entries(body)) {
          if (value === "") {
            (body as Record<string, any>)[key] = undefined;
          }
        }
      },
      body: t.Object({
        birthday: t.Optional(t.String()),
        gender: t.Optional(
          t.Union([
            t.Literal("MAN"),
            t.Literal("WOMAN"),
            t.Literal("NONBINARY"),
          ]),
        ),
        email: t.Optional(t.String()),
        lastLogin: t.Optional(t.String()),
        displayName: t.Optional(t.String()),
        subscriptionType: t.Optional(
          t.Union([
            t.Literal("economy"),
            t.Literal("premium-economy"),
            t.Literal("first-class"),
            t.Literal("weekender"),
          ]),
        ),
        phone: t.Optional(t.String()),
        onboardingPage: t.Optional(
          t.Union([
            t.Literal("DisplayName"),
            t.Literal("Birthday"),
            t.Literal("Gender"),
            t.Literal("DatingPreference"),
            t.Literal("Interests"),
            t.Literal("AddPhotos"),
          ]),
        ),
        showGender: t.Optional(t.Boolean()),
      }),
      response: {
        200: UserSchema,
        404: ErrorResponse,
        500: ErrorResponse,
      },
      detail: {
        tags: ["User"],
        summary: "Update User Details",
        description: "Partially updates an existing user's information.",
      },
    },
  )
  .patch(
    "/user/stream/:userId",
    async ({ params: { userId }, body, set }) => {
      const data = await userRepo.updateStreamToken(userId, body.streamToken);
      set.status = 201;
      return { message: data?.streamToken ?? "" };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({ streamToken: t.String() }),
      response: {
        201: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["User"],
        summary: "Update Stream.io Token",
      },
    },
  )
  .delete(
    "/user/:id",
    async ({ params: { id }, set }) => {
      await userService.deleteUserAccount(id);
      set.status = 204;
      return;
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1, error: "User ID is required" }),
      }),
      response: {
        204: t.Void(),
      },
      detail: {
        tags: ["User"],
        summary: "Delete User Account",
        description:
          "Permanently deletes a user and triggers a cascading deletion of all associated data.",
      },
    },
  )
  .get(
    "/user/:userId/mutual-likes",
    async ({ params: { userId }, set }) => {
      const data = await interactionService.getMutualLikes(userId);
      set.status = 200;
      return { mutualLikes: data };
    },
    {
      params: t.Object({
        userId: t.String({ minLength: 1, error: "User ID is required" }),
      }),
      response: {
        200: t.Object({
          mutualLikes: t.Array(
            t.Object({
              userId: t.String(),
              likedAt: t.Union([t.Date(), t.String(), t.Null()]),
              superLike: t.Boolean(),
              user: t.Object({
                id: t.String(),
                name: t.Nullable(t.String()),
                email: t.Nullable(t.String()),
                age: t.Nullable(t.Number()),
              }),
              images: t.Any(),
            }),
          ),
        }),
      },
      detail: {
        tags: ["User"],
        summary: "Get Mutual Likes",
        description:
          "Returns all users who have liked each other (but haven't matched yet).",
      },
    },
  )
  .get(
    "/user/:userId",
    async ({ params: { userId }, set }) => {
      const data = await userService.getUserDetails(userId);
      if (!data) {
        set.status = 404;
        return { error: "User not found" };
      }
      return data as any;
    },
    {
      params: t.Object({ userId: t.String() }),
      response: {
        200: t.Object({
          id: t.String(),
          displayName: t.Union([t.String(), t.Null()]),
          email: t.Union([t.String(), t.Null()]),
          subscription: t.Union([t.String(), t.Null()]),
          image: t.Union([t.String(), t.Null()]),
          whyHere: t.Union([t.String(), t.Null()]),
          location: t.Optional(
            t.Nullable(
              t.Object({
                name: t.String(),
                abrv: t.String(),
                flag: t.String(),
              }),
            ),
          ),
          onboardingPage: t.Optional(
            t.Nullable(
              t.Union([
                t.Literal("DisplayName"),
                t.Literal("Birthday"),
                t.Literal("Gender"),
                t.Literal("DatingPreference"),
                t.Literal("Interests"),
                t.Literal("AddPhotos"),
              ]),
            ),
          ),
        }),
        404: ErrorResponse,
      },
      detail: {
        tags: ["User"],
        summary: "Get User by ID",
      },
    },
  )
  .put(
    "/fcm-token",
    async ({ body }) => {
      await userRepo.updateUser(body.userId, { fcmToken: body.fcmToken });
      return { message: "Token updated successfully" };
    },
    {
      body: t.Object({
        userId: t.String(),
        fcmToken: t.String(),
      }),
      response: {
        200: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["User"],
        summary: "Update FCM Push Token",
      },
    },
  )
  .use(blockMiddleware)
  .get(
    "/users",
    async ({ query, set }) => {
      let parsedRadius: number[] = [];
      let parsedAge: number[] = [];

      try {
        const radiusArr = JSON.parse(query.radius);
        const ageArr = JSON.parse(query.age);

        if (!Array.isArray(radiusArr) || !Array.isArray(ageArr)) {
          throw new Error();
        }

        parsedRadius = radiusArr.map(Number);
        parsedAge = ageArr.map(Number);
      } catch {
        set.status = 400;
        return {
          status: "fail",
          message: "Invalid JSON format for radius or age",
        };
      }

      if (
        parsedRadius.length < 2 ||
        parsedAge.length < 2 ||
        parsedRadius.some(isNaN) ||
        parsedAge.some(isNaN)
      ) {
        set.status = 400;
        return {
          status: "fail",
          message: "Invalid number format or missing array items",
        };
      }

      if (
        parsedRadius[0] < -90 ||
        parsedRadius[0] > 90 ||
        parsedRadius[1] < -180 ||
        parsedRadius[1] > 180
      ) {
        set.status = 422;
        return {
          status: "unprocessable entity",
          message: "Invalid coordinate range",
        };
      }

      if (parsedAge[0] < 1 || parsedAge[1] > 199) {
        set.status = 422;
        return { status: "Invalid", message: "Invalid age range" };
      }

      const payload = await userService.getFilteredUsersList(
        query.userId,
        {
          currentUserId: query.userId,
          blockedUserIds: [], // Resolved in blockMiddleware previously
          cursor: query.cursor,
          limit: query.limit ? Number(query.limit) : undefined,
          activity: query.activity as "justJoined" | undefined,
          country: query.country?.toUpperCase(),
          smoking: parseBooleanFilter(query.smoking),
          drinking: parseBooleanFilter(query.drinking),
          hasBio: parseBooleanFilter(query.hasBio),
          opennessToLongDistance: parseBooleanFilter(
            query.opennessToLongDistance,
          ),
          willingToRelocate: parseBooleanFilter(query.willingToRelocate),

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
        parsedRadius,
        parsedAge,
        query.minPhotos ? Number(query.minPhotos) : undefined,
      );

      return payload;
    },
    {
      query: t.Object(
        {
          userId: t.String(),
          radius: t.String(),
          age: t.String(),

          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),

          gender: t.Optional(t.String()),
          activity: t.Optional(t.Literal("justJoined")),
          country: t.Optional(t.String()),
          smoking: t.Optional(t.String()),
          hasBio: t.Optional(t.String()),
          drinking: t.Optional(t.String()),
          minPhotos: t.Optional(t.String()),
          familyPlans: t.Optional(t.String()),
          zodiac: t.Optional(t.String()),
          height: t.Optional(t.String()),
          ethnicity: t.Optional(t.String()),
          educationLevel: t.Optional(t.String()),
          lookingFor: t.Optional(t.Any()),
          workoutFrequency: t.Optional(t.String()),
          personality: t.Optional(t.String()),
          language: t.Optional(t.String()),
          bodyType: t.Optional(t.String()),
          loveLanguage: t.Optional(t.String()),
          opennessToLongDistance: t.Optional(t.String()),
          willingToRelocate: t.Optional(t.String()),
          religion: t.Optional(t.String()),
          pets: t.Optional(t.String()),
          sexuality: t.Optional(t.String()),
          dietaryPreference: t.Optional(t.String()),
          sleepingHabits: t.Optional(t.String()),
          travelPlans: t.Optional(t.String()),
          relationshipStatus: t.Optional(t.String()),
        },
        {
          examples: {
            userId: "user_123",
            radius: '["50", "100"]',
            age: '["25", "35"]',
            cursor:
              "eyJjcmVhdGVkQXQiOiIyMDI0LTAzLTE3VDEyOjAwOjAwLjAwMFoiLCJpZCI6InVzZXJfNDU2In0=",
            limit: "20",
            activity: "justJoined",
            country: "US",
            gender: '["male","female"]',
            ethnicity: '["black","white","asian"]',
            zodiac: '["leo","aries","scorpio"]',
            smoking: "false",
            drinking: "true",
            hasBio: "true",
            minPhotos: "2",
            familyPlans: '["wantKids","openToKids"]',
            height: '["160-170","170-180"]',
            educationLevel: '["bachelors","masters"]',
            lookingFor: '["relationship","somethingSerious"]',
            workoutFrequency: '["often","sometimes"]',
            personality: '["introvert","ambivert"]',
            language: '["english","spanish"]',
            bodyType: '["athletic","average"]',
            loveLanguage: '["qualityTime","actsOfService"]',
            opennessToLongDistance: "true",
            willingToRelocate: "false",
            religion: '["christian","spiritual"]',
            pets: '["dog","cat"]',
            dietaryPreference: '["vegan","vegetarian"]',
            sleepingHabits: '["earlyBird","nightOwl"]',
          },
        },
      ),
      response: {
        200: t.Object({
          users: t.Array(t.Any()), 
          nextCursor: t.Union([t.String(), t.Null()]),
        }),
        400: FailResponse,
        422: FailResponse,
      },
      detail: {
        tags: ["User"],
        summary: "Get Users (Advanced Matchmaking)",
        description:
          "Advanced user search with location-based matching and multiple preference filters. Automatically excludes blocked users, existing likes, and existing dislikes.",
      },
    },
  );
