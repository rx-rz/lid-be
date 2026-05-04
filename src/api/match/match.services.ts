import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { NotFoundError } from "../../middleware/error";

export const matchService = {
  getMatches: async (userId: string) => {
    const userExists = await userRepo.checkUserExists(userId);
    if (!userExists) {
      throw new NotFoundError("User not found.", { code: "USER_NOT_FOUND" });
    }
    return await matchRepo.getMatchesByUserId(userId);
  },
};
