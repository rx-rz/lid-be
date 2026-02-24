import { Elysia, t } from "elysia";
import { imageService } from "./image.services";
export const imageRoutes = new Elysia()
  .get(
    "/image/upload-url",
    async () => {
      return imageService.generateUploadSignature();
    },
    {
      detail: { tags: ["Images"], summary: "Get Cloudinary Upload Signature" },
    },
  )
  .get(
    "/images/:userId",
    async ({ params: { userId } }) => {
      return await imageService.getUserImages(userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Images"], summary: "Get User Images" },
    },
  )
  .post(
    "/images",
    async ({ body, set }) => {
      const processedImages = await imageService.processAndSyncImages(
        body.userId,
        body.images,
      );
      set.status = 201;
      return processedImages;
    },
    {
      body: t.Object({
        userId: t.String(),
        images: t.Array(
          t.Object({
            order: t.Optional(t.Number()),
            imageUrl: t.String(),
          }),
        ),
      }),
      detail: { tags: ["Images"], summary: "Sync User Images (Create/Update)" },
    },
  );
