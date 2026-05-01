import type { Context } from "elysia-rate-limit";
import redis from "./redis";

export class RedisRateLimitContext implements Context {
  private durationInMs: number;
  private prefix: string;

  constructor(durationInMs: number, prefix = "rl:") {
    this.durationInMs = durationInMs;
    this.prefix = prefix;
  }

  // Called when the plugin starts. Upstash doesn't need setup, so we do nothing.
  init(): void {}

  // Called when the server shuts down. Upstash doesn't hold connections, so we do nothing.
  kill(): void {}

  async increment(key: string): Promise<{ count: number; nextReset: Date }> {
    const redisKey = this.prefix + key;

    // 1. Atomically increment the counter
    const count = await redis.incr(redisKey);
    let ttlMs: number;

    // 2. If it's the first hit, set the expiration
    if (count === 1) {
      await redis.pexpire(redisKey, this.durationInMs);
      ttlMs = this.durationInMs;
    } else {
      // 3. If it already exists, find out how much time is left
      ttlMs = await redis.pttl(redisKey);

      // Fallback: If for some reason the key lost its expiration (returns -1)
      if (ttlMs < 0) {
        await redis.pexpire(redisKey, this.durationInMs);
        ttlMs = this.durationInMs;
      }
    }

    // 4. Return the format Elysia requires
    return {
      count,
      nextReset: new Date(Date.now() + ttlMs),
    };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.prefix + key;
    await redis.decr(redisKey);
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await redis.del(this.prefix + key);
    }
  }
}
