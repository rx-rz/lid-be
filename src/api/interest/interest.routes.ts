import { Elysia } from "elysia";
import { metadataService } from "../metadata/metadata.services";

export const interestRoutes = new Elysia({ prefix: "/interests" }).get(
  "/",
  () => metadataService.getInterests(),
  {
    detail: { tags: ["Metadata"], summary: "Get cached interests list" },
  },
);
