import { blockRepo } from "../../repo/block.repo";
import { cacheUtils } from "../../utils/cache.utils";
import { BadRequestError, ConflictError } from "../../middleware/error";


export const blockService = {
  blockUser: async (blockerId: string, blockedId: string) => {
    if (blockerId === blockedId) {
      throw new BadRequestError("Cannot block yourself.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const existing = await blockRepo.getExistingBlock(blockerId, blockedId);
    if (existing) {
      throw new ConflictError("User already blocked.", {
        code: "USER_ALREADY_BLOCKED",
      });
    }

    const block = await blockRepo.createBlock(blockerId, blockedId);

    await cacheUtils.invalidateUserDiscoveryCache(blockerId);

    return block;
  },

  getBlockedIds: async (userId: string) => {
    return await blockRepo.getBlockedUserIds(userId);
  },
};
