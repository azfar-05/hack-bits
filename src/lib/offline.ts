export interface CachedGuide {
  content: string;
  savedAt: number;
}

export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

export function cacheGuide(disaster: string, content: string): void {
  if (typeof window === "undefined") return;

  const cached: CachedGuide = {
    content,
    savedAt: Date.now(),
  };

  localStorage.setItem(`guide-${disaster}`, JSON.stringify(cached));
}

export function getCachedGuide(disaster: string): CachedGuide | null {
  if (typeof window === "undefined") return null;

  const data = localStorage.getItem(`guide-${disaster}`);
  if (!data) return null;

  try {
    return JSON.parse(data) as CachedGuide;
  } catch {
    return null;
  }
}

export function saveGuideToCache(disaster: string, content: string): void {
  cacheGuide(disaster, content);
}

export function getGuideFromCache(disaster: string): string | null {
  const cached = getCachedGuide(disaster);
  return cached ? cached.content : null;
}

export function clearCache(): void {
  if (typeof window === "undefined") return;

  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith("guide-")) {
      localStorage.removeItem(key);
    }
  });
}

export function getCacheSize(): number {
  if (typeof window === "undefined") return 0;

  const keys = Object.keys(localStorage);
  return keys.filter((key) => key.startsWith("guide-")).length;
}
