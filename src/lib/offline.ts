/**
 * Offline caching utilities using localStorage
 */

const GUIDE_CACHE_KEY = "disaster_safety_guides";

export interface CachedGuide {
  disasterType: string;
  content: string;
  cachedAt: string;
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Save a guide to localStorage
 */
export function cacheGuide(disasterType: string, content: string): void {
  if (typeof window === "undefined") return;

  try {
    const existingCache = getGuideCache();
    const updatedCache = {
      ...existingCache,
      [disasterType]: {
        disasterType,
        content,
        cachedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(GUIDE_CACHE_KEY, JSON.stringify(updatedCache));
  } catch (error) {
    console.error("Failed to cache guide:", error);
  }
}

/**
 * Get all cached guides
 */
export function getGuideCache(): Record<string, CachedGuide> {
  if (typeof window === "undefined") return {};

  try {
    const cached = localStorage.getItem(GUIDE_CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached) as Record<string, CachedGuide>;
  } catch (error) {
    console.error("Failed to read guide cache:", error);
    return {};
  }
}

/**
 * Get a specific cached guide by disaster type
 */
export function getCachedGuide(disasterType: string): CachedGuide | null {
  const cache = getGuideCache();
  return cache[disasterType] ?? null;
}

/**
 * Clear all cached guides
 */
export function clearGuideCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(GUIDE_CACHE_KEY);
  } catch (error) {
    console.error("Failed to clear guide cache:", error);
  }
}
