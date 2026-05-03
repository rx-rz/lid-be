import { InternalServerError, NotFoundError } from "elysia";
import { preferenceRepo } from "../../repo/preference.repo";
import { loggers } from "../../utils/logger";

export const preferenceService = {
  create: async (userId: string, data: any) => {
    try {
      const sanitized = {
        ...data,
        interests: data.interests ?? [],
        lookingToDate: data.lookingToDate ?? [],
        ethnicity: data.ethnicity ?? [],
        language: data.language ?? [],
      };

      const preference = await preferenceRepo.upsertPreference(
        userId,
        sanitized,
      );

      if (!preference) {
        throw new InternalServerError("Failed to create user preferences.");
      }

      return preference;
    } catch (err) {
      loggers.preference.error({ err, userId }, "failed to create preference");
      throw err;
    }
  },

  update: async (userId: string, data: any) => {
    const existingPreference =
      await preferenceRepo.getPreferenceByIdOrUserId(userId);

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
