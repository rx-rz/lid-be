import { profileRepo } from "../../repo/profile.repo";

export const profileService = {
  createProfile: async (userId: string, bio: string, interests: string[]) => {
    return await profileRepo.upsertProfile(userId, bio, interests);
  },

  getProfile: async (userId: string) => {
    return await profileRepo.getProfileWithDetails(userId);
  },

  updateProfile: async (userId: string, bio?: string, interests?: string[]) => {
    return await profileRepo.updateProfile(userId, { bio, interests });
  },

  deleteProfile: async (userId: string) => {
    return await profileRepo.deleteProfile(userId);
  },
};
