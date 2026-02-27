import { Elysia, t } from "elysia";
import { preferenceService } from "./preference.services";
import { clerkPlugin } from "elysia-clerk";

const PreferenceSchema = t.Object({
  lookingToDate: t.Optional(t.Array(t.String())),
  interests: t.Optional(t.Array(t.String())),
  bio: t.Optional(t.String()),
  drinking: t.Optional(t.Boolean()),
  education: t.Optional(t.String()),
  pronouns: t.Optional(t.String()),
  religion: t.Optional(t.String()),
  smoking: t.Optional(t.Boolean()),
  ethnicity: t.Optional(t.String()),
  zodiac: t.Optional(t.String()),
  pets: t.Optional(t.String()),
  age: t.Optional(t.String()),
  distance: t.Optional(t.String()),
  language: t.Optional(t.String()),
  familyPlans: t.Optional(t.String()),
  gender: t.Optional(t.String()),
  height: t.Optional(t.String()),
  hasBio: t.Optional(t.Boolean()),
  minNumberOfPhotos: t.Optional(t.String()),
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
      set.status = 201;
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
