import { v2 as cloudinary } from "cloudinary";
import { imageRepo } from "../../repo/image.repo";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const imageService = {
  generateUploadSignature: () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "user_uploads";
    const upload_preset = "diaspora";

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder, upload_preset },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || "amaben",
      apiKey: process.env.CLOUDINARY_API_KEY || "167243632659323",
      timestamp,
      signature,
      folder,
      upload_preset,
    };
  },

  getUserImages: async (userId: string) => {
    return await imageRepo.getImagesByUserId(userId);
  },

  processAndSyncImages: async (
    userId: string,
    images: Array<{ order?: number; imageUrl: string }>,
  ) => {
    const existingImages = await imageRepo.getImagesByUserId(userId);
    const existingImageMap = new Map(
      existingImages.map((img) => [img.order, img.id]),
    );

    const processedImages = await Promise.all(
      images.map(async (image) => {
        const order = image.order || 1;
        const existingImageId = existingImageMap.get(order);

        if (existingImageId) {
          return await imageRepo.updateImage(
            existingImageId,
            userId,
            image.imageUrl,
          );
        } else {
          return await imageRepo.insertImage(userId, image.imageUrl, order);
        }
      }),
    );

    return processedImages;
  },
};
