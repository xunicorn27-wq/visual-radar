export const QUALITY_VERSION = "evidence-v1" as const;
export const VISUAL_METHODS = ["布光", "构图", "材质", "色彩", "空间", "动态影像", "字体", "工艺", "叙事"] as const;
export type VisualMethod = typeof VISUAL_METHODS[number];
export interface SourceEvidence {
  status: "ready" | "unavailable";
  url: string;
  fetchedAt: string;
  snapshotHash?: string;
  characters?: number;
  reason?: string;
}
export interface EditorialEvidence {
  version: typeof QUALITY_VERSION;
  status: "verified" | "insufficient";
  sourceUrl: string;
  snapshotHash: string | null;
  facts: Array<{ statement: string; quote: string }>;
  visualMethod: string;
  application: string;
  visualTags: VisualMethod[];
  limitation: string;
}
export type FreshnessKind = "latest" | "upcoming" | "reference" | "unknown";
export interface DatedItem { postedAt?: string | null; eventStartsAt?: string | null; eventEndsAt?: string | null; capturedAt: string }
const time = (value?: string | null) => value ? Date.parse(value) : NaN;
export function singaporeIssueDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("无效日报时间");
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function classifyFreshness(item: DatedItem, now: string) {
  const current = time(now);
  const published = time(item.postedAt);
  const event = time(item.eventStartsAt);
  if (Number.isFinite(event) && event > current) return { kind: "upcoming" as const, label: "即将开展", timeliness: 2 };
  // Legacy event pages sometimes put event dates in postedAt. Never call them fresh news.
  if (Number.isFinite(published) && published > current) return { kind: "unknown" as const, label: "日期待核实", timeliness: 0 };
  if (!Number.isFinite(published) || !Number.isFinite(current)) return { kind: "unknown" as const, label: "发布日期未注明", timeliness: 0 };
  const hours = (current - published) / 3_600_000;
  if (hours <= 72) return { kind: "latest" as const, label: "近期发布", timeliness: hours <= 24 ? 5 : 3 };
  return { kind: "reference" as const, label: "长期参考", timeliness: 0 };
}
export function isCandidateInWindow(item: DatedItem, now: string) {
  const freshness = classifyFreshness(item, now);
  if (freshness.kind === "latest") return true;
  const captureAge = time(now) - time(item.capturedAt);
  if (!Number.isFinite(captureAge) || captureAge < 0 || captureAge > 72 * 3_600_000) return false;
  if (freshness.kind === "upcoming") return time(item.eventStartsAt) - time(now) <= 90 * 86400_000;
  if (Number.isFinite(time(item.eventEndsAt)) && time(item.eventEndsAt) < time(now)) return false;
  return true;
}
