import { Redis } from "@upstash/redis";
import { logger } from "./logger";

type RedisValue =
  | string
  | number
  | boolean
  | null
  | Record<string, any>
  | any[];

type RedisClientWrapper = {
  get: <T = any>(key: string) => Promise<T | null>;
  set: (key: string, value: RedisValue) => Promise<void>;
  setWithTtl: (
    key: string,
    value: RedisValue,
    ttlInSeconds: number,
  ) => Promise<void>;
  del: (key: string) => Promise<void>;
};

let instance: Redis | null = null;

const getRedis = (): Redis => {
  if (!instance) {
    instance = Redis.fromEnv();
  }
  return instance;
};

export const redisClient: RedisClientWrapper = {
  get: async <T = any>(key: string): Promise<T | null> => {
    try {
      return await getRedis().get<T>(key);
    } catch (error) {
      logger.error({ err: error, key }, `[Redis] Get Error`);
      return null;
    }
  },

  set: async (key: string, value: RedisValue): Promise<void> => {
    try {
      await getRedis().set(key, value);
    } catch (error) {
      logger.error({ err: error, key }, `[Redis] Set Error`);
    }
  },

  setWithTtl: async (
    key: string,
    value: RedisValue,
    ttlInSeconds: number,
  ): Promise<void> => {
    try {
      await getRedis().set(key, value, { ex: ttlInSeconds });
    } catch (error) {
      logger.error({ err: error, key }, `[Redis] SetWithTtl Error`);
    }
  },

  del: async (key: string): Promise<void> => {
    try {
      await getRedis().del(key);
    } catch (error) {
      logger.error({ err: error, key }, `[Redis] Del Error`);
    }
  },
};

const redis = getRedis();
export default redis;
