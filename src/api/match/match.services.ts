import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";

export const matchService = {
  getMatches: async (userId: string) => {
    const userExists = await userRepo.checkUserExists(userId);
    if (!userExists) throw new Error("User not found");
    return await matchRepo.getMatchesByUserId(userId);
  },
};
