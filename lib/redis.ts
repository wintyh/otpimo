// ./lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

/**
 * Get a value from Redis and parse it as T
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const result = await redis.get<string>(key); // get returns string | null
  if (!result) return null;

  try {
    return JSON.parse(result) as T; // parse JSON string to T
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis. Automatically stringifies objects.
 */
export async function kvSet<T>(key: string, value: T, ttlSec?: number) {
  if (!redis) return;

  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value);

  if (ttlSec) {
    await redis.set(key, stringValue, { ex: ttlSec });
  } else {
    await redis.set(key, stringValue);
  }
}
