import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { clerkPlugin } from "elysia-clerk";

import { userRepo } from "../../repo/user.repo";
import { blockMiddleware } from "../../middleware/block";
import { userService } from "./user.services";
import { interactionService } from "../interaction/interaction.services";

const MAX_DISTANCE = 22226378.14;

const ErrorResponse = t.Object({ error: t.String() });
const FailResponse = t.Object({ status: t.String(), message: t.String() });

const UserSchema = t.Object({
  id: t.String(),
  displayName: t.Union([t.String(), t.Null()]),
  email: t.Union([t.String(), t.Null()]),
  gender: t.Union([t.String(), t.Null()]),
  birthday: t.Union([t.String(), t.Null()]),
  verified: t.Union([t.Boolean(), t.Null()]),
  showGender: t.Union([t.Boolean(), t.Null()]),
  lastLogin: t.Union([t.String(), t.Date(), t.Null()]),
  subscriptionType: t.Union([t.String(), t.Null()]),
  phone: t.Union([t.String(), t.Null()]),
  createdAt: t.Union([t.String(), t.Date(), t.Null()]),
  updatedAt: t.Union([t.String(), t.Date(), t.Null()]),
  fcmToken: t.Union([t.String(), t.Null()]),
  streamToken: t.Union([t.String(), t.Null()]),
});

export const userRoutes = new Elysia({ name: "routes.user" })
  .use(clerkPlugin())
  .post(
    "/user",
    async ({ body, set }) => {
      try {
        const data = await userService.createUserAndProfile(
          body.clerkId,
          body.phone,
        );
        set.status = 201;
        return data;
      } catch (error: any) {
        set.status = 400;
        return { error: error.message };
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
        tags: ["User Management"],
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
        return { error: error.message };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      transform({ body }) {
        if (body && body.birthday === "") {
          body.birthday = undefined;
        }
        if (body && body.phone === "") {
          body.phone = undefined;
        }
        if (body && body.email === "") {
          body.email = undefined;
        }
        if (body && body.displayName === "") {
          body.displayName = undefined;
        }
        if (body && body.lastLogin === "") {
          body.lastLogin = undefined;
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
          t.Union([t.Literal("free"), t.Literal("premium"), t.Literal("gold")]),
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
        tags: ["User Management"],
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
      return { message: data?.streamToken || "" };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({ streamToken: t.String() }),
      response: {
        201: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Integrations"],
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
        tags: ["User Management"],
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

              likedAt: t.Union([t.Date(), t.String()]),
              superLike: t.Boolean(),
              user: t.Object({
                id: t.String(),
                name: t.Nullable(t.String()),
                email: t.Nullable(t.String()),
              }),
              images: t.Any(),
            }),
          ),
        }),
      },
      detail: {
        tags: ["Discovery"],
        summary: "Get Mutual Likes",
        description:
          "Returns all users who have liked each other (but haven't matched yet).",
      },
    },
  )
  .get(
    "/user/:userId",
    async ({ params: { userId }, set }) => {
      const data = await userService.getUser(userId);
      if (!data) {
        set.status = 404;
        return { error: "User not found" };
      }
      return data;
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
          whyHere: t.Optional(
            t.Nullable(
              t.Union([
                t.Literal("man"),
                t.Literal("woman"),
                t.Literal("nonbinary"),
              ]),
            ),
          ),
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
        tags: ["User Management"],
        summary: "Get User by ID",
      },
    },
  )

  .put(
    "/fcm-token",
    async ({ body }) => {
      await userRepo.updateFcmToken(body.userId, body.fcmToken);
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
        tags: ["Notifications"],
        summary: "Update FCM Push Token",
      },
    },
  )

  .use(blockMiddleware)
  .get(
    "/users",
    async ({ query, set }) => {
      let parsedRadius: number[];
      let parsedAge: number[];

      try {
        parsedRadius = JSON.parse(query.radius).map(Number);
        parsedAge = JSON.parse(query.age).map(Number);
      } catch {
        set.status = 400;
        return {
          status: "fail",
          message: "Invalid JSON format for radius or age",
        };
      }

      // if (
      //   parsedRadius[0] < -90 ||
      //   parsedRadius[0] > 90 ||
      //   parsedRadius[1] < -180 ||
      //   parsedRadius[1] > 180
      // ) {
      //   set.status = 422;
      //   return {
      //     status: "unprocessable entity",
      //     message: "Invalid coordinate range",
      //   };
      // }
      if (parsedRadius.some(isNaN) || parsedAge.some(isNaN)) {
        set.status = 400;
        return { status: "fail", message: "Invalid number format" };
      }

      if (parsedAge[0] < 1 || parsedAge[1] > 199) {
        set.status = 422;
        return { status: "Invalid", message: "Invalid age range" };
      }

      let parsedGender: string[] | undefined;
      if (query.gender) {
        try {
          const parsed = JSON.parse(query.gender);
          parsedGender = Array.isArray(parsed) ? parsed : [query.gender];
        } catch {
          parsedGender = [query.gender];
        }
      }

      const users = await userService.getFilteredUsersList(
        query.userId,
        {
          currentUserId: query.userId,
          blockedUserIds: [],

          activity: query.activity as "justJoined" | undefined,
          country: query.country?.toUpperCase(),
          smoking: parseMultiSelect(query.smoking),
          drinking: parseMultiSelect(query.drinking),
          hasBio: query.hasBio === "true",
          opennessToLongDistance: parseMultiSelect(
            query.opennessToLongDistance,
          ),
          willingToRelocate: parseMultiSelect(query.willingToRelocate),
          gender: parseMultiSelect(query.gender),
          ethnicity: parseMultiSelect(query.ethnicity),
          zodiac: parseMultiSelect(query.zodiac),
          familyPlans: parseMultiSelect(query.familyPlans),
          educationLevel: parseMultiSelect(query.educationLevel),
          height: parseMultiSelect(query.height),
          lookingFor: parseMultiSelect(query.lookingFor),
          workoutFrequency: parseMultiSelect(query.workoutFrequency),
          personality: parseMultiSelect(query.personality),
          language: parseMultiSelect(query.language),
          bodyType: parseMultiSelect(query.bodyType),
          loveLanguage: parseMultiSelect(query.loveLanguage),
        },
        parsedRadius,
        parsedAge,
        query.minPhotos ? Number(query.minPhotos) : undefined,
      );

      return { users };
    },
    {
      query: t.Object(
        {
          userId: t.String(),
          radius: t.String(),
          age: t.String(),
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
        },
        {
          examples: {
            userId: "user_123",
            radius: '["50", "100"]',
            age: '["25", "35"]',
            activity: "justJoined",
            country: "US",
            gender: '["male","female"]',
            ethnicity: '["black","white","asian"]',
            zodiac: '["leo","aries","scorpio"]',
            smoking: '"never"',
            drinking: '["socially","never"]',
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
            opennessToLongDistance: '["yes","maybe"]',
            willingToRelocate: '["yes","maybe"]',
          },
        },
      ),
      response: {
        200: t.Object({
          users: t.Array(t.Any()),
        }),
        400: FailResponse,
        422: FailResponse,
      },
      detail: {
        tags: ["Discovery"],
        summary: "Get Users (Advanced Matchmaking)",
        description:
          "Advanced user search with location-based matching and multiple preference filters. Automatically excludes blocked users, existing likes, and existing dislikes.",
      },
    },
  );

const parseMultiSelect = (val?: string): string[] | undefined => {
  if (!val) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(val));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [val];
  }
};
