import { favoriteRepo } from "../../repo/favorite.repo";
import { userRepo } from "../../repo/user.repo";


export const favoriteService = {
  add: async (userId: string, favoriteUserId: string) => {
    if (userId === favoriteUserId) throw new Error("Cannot favorite yourself");

    const [u1, u2] = await Promise.all([
      userRepo.checkUserExists(userId),
      userRepo.checkUserExists(favoriteUserId)
    ]);

    if (!u1 || !u2) throw new Error("User not found");

    const exists = await favoriteRepo.checkExists(userId, favoriteUserId);
    if (exists) throw new Error("Already in favorites");

    return await favoriteRepo.addFavorite(userId, favoriteUserId);
  },

  remove: async (userId: string, favoriteUserId: string) => {
    const deleted = await favoriteRepo.removeFavorite(userId, favoriteUserId);
    if (!deleted) throw new Error("Favorite not found");
    return { success: true };
  },

  get: async (userId: string) => {
    return await favoriteRepo.getFavoritesByUserId(userId);
  }
};