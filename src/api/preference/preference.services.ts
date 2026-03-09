import { preferenceRepo } from "../../repo/preference.repo";

export const preferenceService = {
  create: async (userId: string, lookingToDate: string[]) => {
    return await preferenceRepo.upsertPreference(userId, lookingToDate);
  },
  
  update: async (id: number, userId: string, data: any) => {
    const existingPreference = await preferenceRepo.getPreferenceByIdOrUserId(
      id,
      userId,
    );

    const mergedData = {
      ...existingPreference,
      ...data,
      updatedAt: new Date(),
      createdAt: existingPreference?.createdAt,
    };

    return await preferenceRepo.updatePreference(id, userId, mergedData);
  },

  get: async (userId: string) => {
    return await preferenceRepo.getPreferenceByUserId(userId);
  },
};
