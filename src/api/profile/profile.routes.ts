import { Elysia, t } from "elysia";
import { profileService } from "./profile.services";

export const profileRoutes = new Elysia({ prefix: "/profile" })
  .post(
    "",
    async ({ body, set }) => {
      try {
        const profile = await profileService.createProfile(
          body.userId,
          body.bio,
          body.interests,
        );
        set.status = 201;
        return profile;
      } catch (error: any) {
        set.status = 400;
        return { error: error.message || "Failed to create profile" };
      }
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
    async ({ params: { userId }, set }) => {
      const profile = await profileService.getProfile(userId);
      if (!profile) {
        set.status = 404;
        return { error: "Profile not found" };
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
    async ({ params: { userId }, body, set }) => {
      const profile = await profileService.updateProfile(
        userId,
        body.bio,
        body.interests,
      );
      if (!profile) {
        set.status = 404;
        return { error: "Profile not found" };
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
    async ({ params: { userId }, set }) => {
      const profile = await profileService.deleteProfile(userId);
      if (!profile) {
        set.status = 404;
        return { error: "Profile not found" };
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
