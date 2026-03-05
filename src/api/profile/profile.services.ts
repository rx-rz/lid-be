import { locationRepo } from "../../repo/location.repo";
import { profileRepo } from "../../repo/profile.repo";
import { getCountryFromCoordinates } from "../../utils/location";

export const profileService = {
  createProfile: async (userId: string, bio: string, interests: string[]) => {
    return await profileRepo.upsertProfile(userId, bio, interests);
  },

  getProfile: async (userId: string) => {
    const profile = await profileRepo.getProfileWithDetails(userId);
    const l = await locationRepo.getLocationByUserId(userId);
    const location = l
      ? await getCountryFromCoordinates(
          parseFloat(l.latitude),
          parseFloat(l.longitude),
        )
      : null;
    return { ...profile, location: location ?? null };
  },

  updateProfile: async (userId: string, bio?: string, interests?: string[]) => {
    return await profileRepo.updateProfile(userId, { bio, interests });
  },

  deleteProfile: async (userId: string) => {
    return await profileRepo.deleteProfile(userId);
  },
};
