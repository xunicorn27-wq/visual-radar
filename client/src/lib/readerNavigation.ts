export interface ReaderReturn {
  href: string;
  label: string;
  anchor: string;
  shown: number;
}

export function readReaderReturn(value: unknown): ReaderReturn | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<ReaderReturn>;
  if (typeof data.href !== "string" || data.href.length > 4000 || !/^\/(issues|saved)(\?[^#]*)?$/.test(data.href)) return null;
  if (typeof data.anchor !== "string" || !/^archive-[a-zA-Z0-9_%.-]+$/.test(data.anchor)) return null;
  if (typeof data.shown !== "number" || !Number.isInteger(data.shown) || data.shown < 24 || data.shown > 10000) return null;
  return { href: data.href, label: data.href.startsWith("/saved") ? "返回我的收藏" : "返回浏览结果", anchor: data.anchor, shown: data.shown };
}

export function archiveCardAnchor(issueId: string, itemId?: string) {
  return `archive-${issueId}${itemId ? `-${encodeURIComponent(itemId)}` : ""}`;
}

export function buildIssueShareUrl(origin: string, baseUrl: string, issueId: string, storyId?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueId)) throw new Error("无效的日报日期");
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/issues/${issueId}/`, origin);
  // Deliberately rebuild the URL: browser return state and personal searches are not shared.
  if (storyId) url.hash = `story-${encodeURIComponent(storyId)}`;
  return url.href;
}

export function readingPercentage(scrollY: number, start: number, height: number, viewport: number) {
  const distance = Math.max(0, height - viewport);
  if (distance === 0) return scrollY >= start ? 100 : 0;
  return Math.round(Math.min(1, Math.max(0, (scrollY - start) / distance)) * 100);
}

export async function copyReaderLink(value: string, writeText: ((value: string) => Promise<void>) | undefined) {
  if (!writeText) return false;
  try { await writeText(value); return true; } catch { return false; }
}
