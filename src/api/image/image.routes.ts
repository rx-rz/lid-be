import { Elysia, t } from "elysia";
import { imageService } from "./image.services";
import { clerkPlugin } from "elysia-clerk";

export const imagesRoutes = new Elysia({ prefix: "/image" })
  .use(clerkPlugin())
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
  .use(clerkPlugin())

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
  .post(
    "",
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
