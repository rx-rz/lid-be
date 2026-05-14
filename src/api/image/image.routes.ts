import { Elysia, t } from "elysia";
import { imageService } from "./image.services";
import { authMiddleware } from "../../middleware/auth";

export const imagesRoutes = new Elysia({ prefix: "/image" })
  .use(authMiddleware)
  .get(
    "/upload-url",
    async () => {
      return imageService.generateUploadSignature();
    },
    {
      detail: { tags: ["Images"], summary: "Get Cloudinary Upload Signature" },
    },
  );
export const imageRoutes = new Elysia({ prefix: "/images" })
  .use(authMiddleware)

  .post(
    "",
    async ({ body, currentUserId, set }) => {
      const processedImages = await imageService.processAndSyncImages(
        currentUserId,
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

// .get(
//   "/:userId",
//   async ({ params: { userId } }) => {
//     return await imageService.getUserImages(userId);
//   },
//   {
//     params: t.Object({ userId: t.String() }),
//     detail: { tags: ["Images"], summary: "Get User Images" },
//   },
// )
