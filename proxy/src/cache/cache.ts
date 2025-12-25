import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "cache.json");

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

// 简单的内存 + 文件持久化实现
let storage: Record<string, CacheItem> = {};
let lastModifiedTime: number | null = null;

// 初始化：从文件加载数据
function initSync() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      storage = JSON.parse(data);
      lastModifiedTime = fs.statSync(CACHE_FILE).mtimeMs;
      console.log("Cache loaded from file", CACHE_FILE);
    } catch (e) {
      console.error("Failed to load cache file, starting fresh", e);
      storage = {};
      lastModifiedTime = null;
    }
  }
}

// 检查文件是否被外部修改
function checkExternalChanges(): boolean {
  if (!fs.existsSync(CACHE_FILE)) return false;

  try {
    const currentModifiedTime = fs.statSync(CACHE_FILE).mtimeMs;
    if (lastModifiedTime !== null && currentModifiedTime > lastModifiedTime) {
      console.log("Detected external changes to cache file, reloading...");
      initSync();
      return true;
    }
    lastModifiedTime = currentModifiedTime;
    return false;
  } catch (e) {
    console.error("Failed to check file modification time", e);
    return false;
  }
}

// 保存到文件
function saveSync() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(storage, null, 2));
    lastModifiedTime = fs.statSync(CACHE_FILE).mtimeMs;
    console.log("Cache saved to file", CACHE_FILE);
  } catch (e) {
    console.error("Failed to save cache file", e);
  }
}

// 异步保存（防抖/延迟执行，避免高频写入）
let saveTimer: NodeJS.Timeout | null = null;
function saveAsync() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveSync();
    saveTimer = null;
  }, 1000);
}

// 初始化加载
initSync();

// 设置缓存
export async function setCache(key: string, value: unknown, ttl?: number) {
  // 检查是否有外部修改
  checkExternalChanges();

  storage[key] = {
    item: value,
    timestamp: Date.now(),
    ttl: ttl,
  };
  saveAsync();
}

// 获取缓存，自动处理过期
export async function getCache(key: string): Promise<CacheItem | null> {
  // 检查是否有外部修改
  checkExternalChanges();

  const row = storage[key];

  if (!row) return null;

  const currentTime = Date.now();

  // 过期判断
  const isExpired =
    typeof row.ttl === "number" && row.timestamp + row.ttl < currentTime;

  if (isExpired) {
    await deleteCache(key);
    return null;
  }

  return row;
}

// 删除缓存
export async function deleteCache(key: string) {
  // 检查是否有外部修改
  checkExternalChanges();

  Reflect.deleteProperty(storage, key);
  saveAsync();
}

// 清理过期缓存（仅清理有ttl的缓存）
export async function clearExpiredCache(): Promise<void> {
  // 检查是否有外部修改
  checkExternalChanges();

  const currentTime = Date.now();
  let changed = false;
  for (const key in storage) {
    const row = storage[key];
    if (typeof row.ttl === "number" && row.timestamp + row.ttl < currentTime) {
      Reflect.deleteProperty(storage, key);
      changed = true;
    }
  }
  if (changed) saveSync();
  console.log("Expired cache entries removed:", changed);
}

// 手动重新加载缓存文件
export async function reloadCache(): Promise<void> {
  console.log("Manually reloading cache file...");
  initSync();
}

// 启动时清理过期缓存
await clearExpiredCache();
