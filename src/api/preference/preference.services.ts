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
      // 23503 is the Postgres code for a Foreign Key Violation
      // This means the userId doesn't exist in the users table yet
      if (err.code === "23503") {
        throw new NotFoundError(
          "Cannot create preferences: User does not exist.",
        );
      }

      // If we already threw an Elysia error inside the try block, let it bubble up
      if (err instanceof InternalServerError || err instanceof NotFoundError) {
        throw err;
      }

      console.error("[PreferenceService.create error]:", err);
      throw new InternalServerError(
        "An unexpected error occurred while saving preferences.",
      );
    }
  },

  update: async (id: number, userId: string, data: any) => {
    const existingPreference = await preferenceRepo.getPreferenceByIdOrUserId(
      id,
      userId,
    );

    // 1. Guard check: Ensure the record actually exists before trying to merge
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
      id,
      userId,
      mergedData,
    );

    // 2. Guard check: Ensure the database actually returned the updated row
    if (!updatedPreference) {
      throw new InternalServerError("Failed to update user preferences.");
    }

    return updatedPreference;
  },

  get: async (userId: string) => {
    const preference = await preferenceRepo.getPreferenceByUserId(userId);

    // Guard check: Throw a clean 404 if no preferences exist for this user yet
    if (!preference) {
      throw new NotFoundError(`Preferences for user ${userId} not found.`);
    }

    return preference;
  },
};
