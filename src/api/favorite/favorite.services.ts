import { favoriteRepo } from "../../repo/favorite.repo";
import { userRepo } from "../../repo/user.repo";
import { BadRequestError, ConflictError, NotFoundError } from "../../middleware/error";


export const favoriteService = {
  add: async (userId: string, favoriteUserId: string) => {
    if (userId === favoriteUserId) {
      throw new BadRequestError("Cannot favorite yourself.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const [u1, u2] = await Promise.all([
      userRepo.checkUserExists(userId),
      userRepo.checkUserExists(favoriteUserId)
    ]);

    if (!u1 || !u2) {
      throw new NotFoundError("User not found.", { code: "USER_NOT_FOUND" });
    }

    const exists = await favoriteRepo.checkExists(userId, favoriteUserId);
    if (exists) {
      throw new ConflictError("Already in favorites.", {
        code: "FAVORITE_ALREADY_EXISTS",
      });
    }

    return await favoriteRepo.addFavorite(userId, favoriteUserId);
  },

  remove: async (userId: string, favoriteUserId: string) => {
    const deleted = await favoriteRepo.removeFavorite(userId, favoriteUserId);
    if (!deleted) {
      throw new NotFoundError("Favorite not found.", {
        code: "FAVORITE_NOT_FOUND",
      });
    }
    return { success: true };
  },

  get: async (userId: string) => {
    return await favoriteRepo.getFavoritesByUserId(userId);
  }
};
