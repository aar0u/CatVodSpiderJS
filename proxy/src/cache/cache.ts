interface CacheItem {
  item: unknown;
  timestamp: number;
}

export const TIME_UNITS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

export const CACHE_TTL = 2 * TIME_UNITS.HOUR;

export const CACHE: Record<string, CacheItem> = {};
