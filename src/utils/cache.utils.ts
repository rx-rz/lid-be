import redis from "./redis"; 
import { logger } from "./logger";

export const cacheUtils = {
  invalidateUserDiscoveryCache: async (userId: string) => {
    try {
      const pattern = `user_results:${userId}:*`;
      let cursor = 0;
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: pattern,
          count: 100,
        });

        cursor = +nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== 0);

      if (keysToDelete.length > 0) {

        await redis.del(...keysToDelete);
        logger.info(
          `[Cache] Invalidated ${keysToDelete.length} keys for user ${userId}`,
        );
      }
    } catch (error) {
      logger.error({ err: error, userId }, `[Cache] Invalidation Error`);
    }
  },
  incrementCacheVersion: async (userId: string) => {
    await redis.incr(`user_cache_version:${userId}`);
  },
};
