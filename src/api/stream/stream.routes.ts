import { Elysia, t } from "elysia";
import { streamService } from "./stream.services";
import { clerkPlugin } from "elysia-clerk";

export const streamRoutes = new Elysia({ prefix: "/stream" })
// TODO: Confirm he uses authentication here
  // .use(clerkPlugin())
  .post("/token", ({ body }) => streamService.generateToken(body), {
    body: t.Object({
      userId: t.String(),
      name: t.Optional(t.String()),
      image: t.Optional(t.String()),
      email: t.Optional(t.String()),
    }),
    detail: { tags: ["Chat"], summary: "Get Stream.io token" },
  })
  .post(
    "/call",
    ({ body }) => ({ callId: body.callId, type: body.type || "default" }),
    {
      body: t.Object({ callId: t.String(), type: t.Optional(t.String()) }),
      detail: { tags: ["Chat"], summary: "Setup call context" },
    },
  );
