import { InternalServerError, NotFoundError } from "elysia";
import { preferenceRepo } from "../../repo/preference.repo";

export const preferenceService = {
  create: async (userId: string, lookingToDate: string[]) => {
    try {
      const preference = await preferenceRepo.upsertPreference(
        userId,
        lookingToDate,
      );

      if (!preference) {
        throw new InternalServerError("Failed to create user preferences.");
      }
      return preference;
    } catch (err: any) {
      if (err.code === "23503") {
        throw new NotFoundError(
          "Cannot create preferences: User does not exist.",
        );
      }

      if (err instanceof InternalServerError || err instanceof NotFoundError) {
        throw err;
      }

      console.error("[PreferenceService.create error]:", err);
      throw new InternalServerError(
        "An unexpected error occurred while saving preferences.",
      );
    }
  },

  update: async (userId: string, data: any) => {
    const existingPreference = await preferenceRepo.getPreferenceByIdOrUserId(
      userId,
    );

    if (!existingPreference) {
      throw new NotFoundError(`Preferences for user ${userId} not found.`);
    }

    const mergedData = {
      ...existingPreference,
      ...data,
      updatedAt: new Date(),
      createdAt: existingPreference.createdAt,
    };

    const updatedPreference = await preferenceRepo.updatePreference(
      userId,
      mergedData,
    );

    if (!updatedPreference) {
      throw new InternalServerError("Failed to update user preferences.");
    }

    return updatedPreference;
  },

  get: async (userId: string) => {
    const preference = await preferenceRepo.getPreferenceByUserId(userId);

    if (!preference) {
      throw new NotFoundError(`Preferences for user ${userId} not found.`);
    }

    return preference;
  },
};
