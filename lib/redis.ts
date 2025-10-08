import { Redis } from "@upstash/redis";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  return (await redis.get<T>(key)) ?? null;
}
export async function kvSet<T>(key: string, value: T, ttlSec?: number) {
  if (!redis) return;
  if (ttlSec) await redis.set(key, value as any, { ex: ttlSec });
  else await redis.set(key, value as any);
}