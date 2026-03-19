import { Elysia, t } from "elysia";
import { preferenceService } from "./preference.services";
import { clerkPlugin } from "elysia-clerk";

const PreferenceSchema = t.Object({
  interests: t.Optional(t.Array(t.String())),
  lookingToDate: t.Optional(t.Array(t.String())),
  ethnicity: t.Optional(t.Array(t.String())),
  pronouns: t.Optional(t.String()),
  zodiac: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  whyHere: t.Optional(t.String()),
  smoking: t.Optional(t.Boolean()),
  drinking: t.Optional(t.Boolean()),
  religion: t.Optional(t.String()),
  education: t.Optional(t.String()),
  pets: t.Optional(t.String()),
  age: t.Optional(t.String()),
  distance: t.Optional(t.String()),
  language: t.Optional(t.Array(t.String())),
  familyPlans: t.Optional(t.String()),
  gender: t.Optional(t.String()),
  height: t.Optional(t.String()),
  jobTitle: t.Optional(t.String()),
  company: t.Optional(t.String()),
  school: t.Optional(t.String()),
  sexuality: t.Optional(t.String()),
  bodyType: t.Optional(t.String()),
  dietaryPreference: t.Optional(t.String()),
  sleepingHabits: t.Optional(t.String()),
  workoutFrequency: t.Optional(t.String()),
  loveLanguage: t.Optional(t.String()),
  travelPlans: t.Optional(t.String()),
  personality: t.Optional(t.String()),
  personalityProfile: t.Optional(t.String()),
  relationshipStatus: t.Optional(t.String()),
  willingToRelocate: t.Optional(t.Boolean()),
  opennessToLongDistance: t.Optional(t.Boolean()),
  hasBio: t.Optional(t.Boolean()),
  minNumberOfPhotos: t.Optional(t.String()),
  connections: t.Optional(t.String()),
});

export const preferenceRoutes = new Elysia({ prefix: "/preference" })
  .use(clerkPlugin())
  .post(
    "",
    async ({ body, set }) => {
      const data = await preferenceService.create(
        body.userId,
        body.lookingToDate,
      );
      if (!data) throw new Error("Preference not created");
      set.status = "Created";
      return data;
    },
    {
      body: t.Object({
        userId: t.String(),
        lookingToDate: t.Array(t.String()),
      }),
      detail: { tags: ["Preferences"], summary: "Create base preferences" },
    },
  )
  .patch(
    "/:id/:userId",
    async ({ params: { id, userId }, body, set }) => {
      const updatedPreference = await preferenceService.update(
        Number(id),
        userId,
        body,
      );
      if (!updatedPreference) throw new Error("Preference not updated");
      set.status = 200;
      return updatedPreference;
    },
    {
      params: t.Object({ id: t.String(), userId: t.String() }),
      body: PreferenceSchema,
      detail: {
        tags: ["Preferences"],
        summary: "Update preferences via partial payload",
      },
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const data = await preferenceService.get(id);
      if (!data) {
        set.status = 404;
        return { error: "User preferences not found" };
      }
      return data;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Preferences"], summary: "Get User Preferences" },
    },
  );
