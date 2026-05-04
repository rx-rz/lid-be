import { Elysia, t } from "elysia";
import { locationService } from "./location.services";
import { InternalServerError } from "../../middleware/error";

export const locationRoutes = new Elysia({ prefix: "/location" }).post(
  "/",
  async ({ body, set }) => {
      const data = await locationService.createLocation(
        body.userId,
        body.latitude,
        body.longitude,
      );
      if (!data) {
        throw new InternalServerError("Location creation failed.");
      }
      set.status = 201;
      return data;
  },
  {
    body: t.Object({
      userId: t.String(),
      latitude: t.String(),
      longitude: t.String(),
    }),
    detail: { tags: ["Location"], summary: "Create User Location" },
  },
);
