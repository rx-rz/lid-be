import { Elysia, t } from "elysia";
import { profileService } from "./profile.services";
import { InternalServerError, NotFoundError } from "../../middleware/error";

export const profileRoutes = new Elysia({ prefix: "/profile" })
  .post(
    "",
    async ({ body, set }) => {
      const profile = await profileService.createProfile(
        body.userId,
        body.bio,
        body.interests,
      );
      if (!profile) throw new InternalServerError("Failed to create profile.");
      set.status = 201;
      return profile;
    },
    {
      body: t.Object({
        userId: t.String(),
        bio: t.String(),
        interests: t.Array(t.String()),
      }),
      detail: {
        tags: ["Profiles"],
        summary: "Create Profile",
        description: "Creates a user profile with bio and interests.",
      },
    },
  )
  .get(
    "/:userId",
    async ({ params: { userId } }) => {
      const profile = await profileService.getProfile(userId);
      if (!profile) {
        throw new NotFoundError("Profile not found.", {
          code: "PROFILE_NOT_FOUND",
        });
      }
      return profile;
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        tags: ["Profiles"],
        summary: "Get Profile",
        description:
          "Retrieves a complete profile with joined user data, preferences, and images.",
      },
    },
  )
  .put(
    "/:userId",
    async ({ params: { userId }, body }) => {
      const profile = await profileService.updateProfile(
        userId,
        body.bio,
        body.interests,
      );
      if (!profile) {
        throw new NotFoundError("Profile not found.", {
          code: "PROFILE_NOT_FOUND",
        });
      }
      return profile;
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        bio: t.Optional(t.String()),
        interests: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ["Profiles"],
        summary: "Update Profile",
        description: "Updates profile bio and/or interests.",
      },
    },
  )
  .delete(
    "/:userId",
    async ({ params: { userId } }) => {
      const profile = await profileService.deleteProfile(userId);
      if (!profile) {
        throw new NotFoundError("Profile not found.", {
          code: "PROFILE_NOT_FOUND",
        });
      }
      return { success: true };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        tags: ["Profiles"],
        summary: "Delete Profile",
        description: "Deletes a user's profile.",
      },
    },
  );
