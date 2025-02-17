import path from "path";

import { open } from "sqlite";
import sqlite3 from "sqlite3";

interface CacheItem {
  item: unknown;
  timestamp: number;
  ttl?: number;
}

export const TIME_UNITS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

export const CACHE_TTL = 2 * TIME_UNITS.HOUR;

const db = await open({
  filename: path.join(process.cwd(), "cache.db"),
  driver: sqlite3.Database,
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    timestamp INTEGER,
    ttl INTEGER
  )
`);

// 设置缓存
export async function setCache(key: string, value: unknown, ttl?: number) {
  await db.run(
    "INSERT OR REPLACE INTO cache (key, value, timestamp, ttl) VALUES (?, ?, ?, ?)",
    [key, JSON.stringify(value), Date.now(), ttl],
  );
}

// 获取缓存，自动处理过期
export async function getCache(key: string): Promise<CacheItem | null> {
  const row = await db.get(
    "SELECT value, timestamp, ttl FROM cache WHERE key = ?",
    [key],
  );

  if (!row) return null;

  const currentTime = Date.now();

  // 过期判断：
  // 1. 如果ttl是数字且已过期
  // 2. 如果ttl是undefined，则永不过期
  const isExpired =
    typeof row.ttl === "number" && row.timestamp + row.ttl < currentTime;

  if (isExpired) {
    await deleteCache(key);
    return null;
  }

  return {
    item: JSON.parse(row.value),
    timestamp: row.timestamp,
    ttl: row.ttl,
  };
}

// 删除缓存
export async function deleteCache(key: string) {
  await db.run("DELETE FROM cache WHERE key = ?", [key]);
}

// 清理过期缓存（仅清理有ttl的缓存）
export async function clearExpiredCache(): Promise<void> {
  await db.run(
    "DELETE FROM cache WHERE ttl IS NOT NULL AND timestamp + ttl < ?",
    [Date.now()],
  );
}

// 启动时清理过期缓存
await clearExpiredCache();
