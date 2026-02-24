import { Elysia, t } from "elysia";
import { helpRepo } from "../../repo/help.repo";

export const helpRoutes = new Elysia({ prefix: "/get-help" })
  .get("/", () => helpRepo.findAll(), { detail: { tags: ["Support"] } })
  .post(
    "/",
    async ({ body }) => {
      return { success: true, help: await helpRepo.create(body) };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        message: t.String(),
        screenshot: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["Support"] },
    },
  );
