import { blockRepo } from "../../repo/block.repo";
import { cacheUtils } from "../../utils/cache.utils";


export const blockService = {
  blockUser: async (blockerId: string, blockedId: string) => {
    if (blockerId === blockedId) throw new Error("Cannot block yourself");

    const existing = await blockRepo.getExistingBlock(blockerId, blockedId);
    if (existing) throw new Error("User already blocked");

    const block = await blockRepo.createBlock(blockerId, blockedId);

    // Invalidate discovery cache so the blocked user disappears immediately
    await cacheUtils.invalidateUserDiscoveryCache(blockerId);

    return block;
  },

  getBlockedIds: async (userId: string) => {
    return await blockRepo.getBlockedUserIds(userId);
  },
};
