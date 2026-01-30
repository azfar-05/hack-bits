export function saveGuideToCache(disaster: string, content: string) {
  localStorage.setItem(
    `guide-${disaster}`,
    JSON.stringify({ content, savedAt: Date.now() })
  );
}

export function getGuideFromCache(disaster: string) {
  const data = localStorage.getItem(`guide-${disaster}`);
  if (!data) return null;
  return JSON.parse(data).content as string;
}
