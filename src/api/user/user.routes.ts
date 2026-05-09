import { Elysia, t } from "elysia";
import { clerkPlugin } from "elysia-clerk";

import { userRepo } from "../../repo/user.repo";
import { sanitizeFilteredUsersResult, userService } from "./user.services";
import { interactionService } from "../interaction/interaction.services";
import { blockMiddleware } from "../../middleware/block";

import {
  UserSchema,
  GetUsersQuerySchema,
  buildUserFilters,
} from "../../schemas/user.schema";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";
import { ErrorResponseSchema, NotFoundError } from "../../middleware/error";
import { fcmAdmin } from "../../services/fcm";
/**
 * ---------------------------------------
 * SHARED RESPONSE SCHEMAS
 * ---------------------------------------
 */

/**
 * ---------------------------------------
 * ROUTES
 * ---------------------------------------
 */

export const userRoutes = new Elysia({ name: "routes.user" })
  .use(clerkPlugin())

  /**
   * ---------------------------------------
   * RATE LIMITER (SCOPED)
   * ---------------------------------------
   * Applies only to routes in this specific file.
   * Max 60 requests per minute per IP.
   */
  .use(
    routeRateLimit(rateLimitPresets.generalAuthenticated),
  )

  /**
   * ---------------------------------------
   * CREATE USER
   * ---------------------------------------
   */
  .post(
    "/user",
    async ({ body, set }) => {
      const user = await userService.createUserProfile(
        body.clerkId,
        body.phone,
      );

      set.status = 201;
      return user;
    },
    {
      body: t.Object({
        clerkId: t.String(),
        phone: t.Optional(t.String()),
      }),
      detail: { tags: ["User"], summary: "Create user profile" },
      response: {
        201: UserSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
  )

  /**
   * ---------------------------------------
   * UPDATE USER
   * ---------------------------------------
   */
  .patch(
    "/user/:id",
    async ({ params: { id }, body }) => {
      const updated = await userService.updateUser(id, {
        ...body,
        lastLogin: body.lastLogin ? new Date(body.lastLogin) : undefined,
      });

      if (!updated) {
        throw new NotFoundError("User not found or not updated.", {
          code: "USER_NOT_FOUND",
        });
      }

      return updated as any;
    },
    {
      params: t.Object({
        id: t.String(),
      }),

      transform({ body }) {
        if (!body || typeof body !== "object") return;

        for (const [k, v] of Object.entries(body)) {
          if (v === "") (body as any)[k] = undefined;
        }
      },

      body: t.Partial(
        t.Object({
          birthday: t.String(),
          gender: t.Union([
            t.Literal("MAN"),
            t.Literal("WOMAN"),
            t.Literal("NONBINARY"),
          ]),
          email: t.String(),
          lastLogin: t.String(),
          displayName: t.String(),
          subscriptionType: t.Union([
            t.Literal("economy"),
            t.Literal("premium"),
            t.Literal("first-class"),
            t.Literal("weekender"),
          ]),
          phone: t.String(),
          onboardingPage: t.Union([
            t.Literal("DisplayName"),
            t.Literal("Birthday"),
            t.Literal("Gender"),
            t.Literal("DatingPreference"),
            t.Literal("Interests"),
            t.Literal("AddPhotos"),
          ]),
          showGender: t.Boolean(),
        }),
      ),
      detail: { tags: ["User"], summary: "Update user details" },
      response: {
        200: UserSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  )

  /**
   * ---------------------------------------
   * UPDATE STREAM TOKEN
   * ---------------------------------------
   */
  .patch(
    "/user/stream/:userId",
    async ({ params: { userId }, body, set }) => {
      const data = await userRepo.updateStreamToken(userId, body.streamToken);

      set.status = 200;
      return {
        message: data?.streamToken ?? "",
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        streamToken: t.String(),
      }),
      detail: { tags: ["User"], summary: "Update user's Stream.io token" },
      response: {
        200: t.Object({
          message: t.String(),
        }),
      },
    },
  )

  /**
   * ---------------------------------------
   * DELETE USER
   * ---------------------------------------
   */
  .delete(
    "/user/:id",
    async ({ params: { id }, set }) => {
      await userService.deleteUserAccount(id);
      set.status = 204;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: { tags: ["User"], summary: "Delete user account" },
      response: {
        204: t.Void(),
      },
    },
  )

  /**
   * ---------------------------------------
   * GET USER DETAILS
   * ---------------------------------------
   */
  .get(
    "/user/:userId",
    async ({ params: { userId } }) => {
      const user = await userService.getUserDetails(userId);

      if (!user) {
        throw new NotFoundError("User not found.", { code: "USER_NOT_FOUND" });
      }

      return user;
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      detail: { tags: ["User"], summary: "Get user details" },
      response: {
        200: t.Any(),
        404: ErrorResponseSchema,
      },
    },
  )

  /**
   * ---------------------------------------
   * MUTUAL LIKES
   * ---------------------------------------
   */
  .get(
    "/user/:userId/mutual-likes",
    async ({ params: { userId } }) => {
      const data = await interactionService.getMutualLikes(userId);

      return {
        mutualLikes: data,
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      detail: { tags: ["User"], summary: "Get mutual likes for a user" },
      response: {
        200: t.Object({
          mutualLikes: t.Array(t.Any()),
        }),
      },
    },
  )
  // .post(
  //   "/push-token/test",
  //   async ({ body }) => {
  //     return await userService.testExpoPushNotification(body.token);
  //   },
  //   {
  //     body: t.Object({
  //       token: t.String(),
  //     }),
  //     detail: {
  //       tags: ["User"],
  //       summary: "Test Expo push notification",
  //     },
  //     response: {
  //       200: t.Object({
  //         tickets: t.Array(t.Any()),
  //       }),
  //       400: ErrorResponseSchema,
  //     },
  //   },
  // )
  /**
   * ---------------------------------------
   * UPDATE FCM TOKEN
   * ---------------------------------------
   */
  .put(
    "/fcm-token",
    async ({ body }) => {
      await userService.registerPushToken({
        userId: body.userId,
        token: body.fcmToken,
        provider: "fcm",
        platform: body.platform ?? "unknown",
        deviceId: body.deviceId,
      });

      return {
        message: "FCM token updated successfully",
      };
    },
    {
      body: t.Object({
        userId: t.String(),
        fcmToken: t.String(),
        platform: t.Optional(
          t.Union([
            t.Literal("ios"),
            t.Literal("android"),
            t.Literal("web"),
            t.Literal("unknown"),
          ]),
        ),
        deviceId: t.Optional(t.String()),
      }),
      detail: { tags: ["User"], summary: "Update user's FCM token" },
      response: {
        200: t.Object({
          message: t.String(),
        }),
      },
    },
  )
  .put(
    "/push-token",
    async ({ body }) => {
      await userService.registerPushToken({
        userId: body.userId,
        token: body.token,
        provider: body.provider ?? "expo",
        platform: body.platform ?? "unknown",
        deviceId: body.deviceId,
      });

      return {
        message: "Push token updated successfully",
      };
    },
    {
      body: t.Object({
        userId: t.String(),
        token: t.String(),
        provider: t.Optional(t.Union([t.Literal("expo"), t.Literal("fcm")])),
        platform: t.Optional(
          t.Union([
            t.Literal("ios"),
            t.Literal("android"),
            t.Literal("web"),
            t.Literal("unknown"),
          ]),
        ),
        deviceId: t.Optional(t.String()),
      }),
      detail: { tags: ["User"], summary: "Register user's push token" },
      response: {
        200: t.Object({
          message: t.String(),
        }),
      },
    },
  )
  .delete(
    "/push-token",
    async ({ body }) => {
      await userService.unregisterPushToken({
        userId: body.userId,
        token: body.token,
      });

      return {
        message: "Push token disabled successfully",
      };
    },
    {
      body: t.Object({
        userId: t.String(),
        token: t.String(),
      }),
      detail: { tags: ["User"], summary: "Disable user's push token" },
      response: {
        200: t.Object({
          message: t.String(),
        }),
      },
    },
  )

  /**
   * ---------------------------------------
   * USERS LIST (MATCHMAKING)
   * ---------------------------------------
   */
  .use(blockMiddleware)
  .use(routeRateLimit(rateLimitPresets.discovery))
  .get(
    "/users",
    async ({ query }) => {
      const { radius, age, filters, minPhotos } = buildUserFilters(query);

      const result = await userService.getFilteredUsersList(
        query.userId,
        filters,
        radius,
        age,
        minPhotos,
      );

      return sanitizeFilteredUsersResult(result as any);
    },
    {
      query: GetUsersQuerySchema,
      detail: { tags: ["User"], summary: "Get filtered list of users" },
      response: {
        200: t.Object({
          users: t.Array(t.Any()),
          nextCursor: t.Union([t.String(), t.Null()]),
        }),
        400: ErrorResponseSchema,
      },
    },
  );
