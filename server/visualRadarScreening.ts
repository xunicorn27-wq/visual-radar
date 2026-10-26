import type { IntelItem } from "./intelItem";
import { VISUAL_CULTURE_SOURCES } from "./visualCultureSourceCatalog";
import { classifyFreshness } from "../shared/visualRadarQuality";
export const SCREENING_GROUPS = ["photography", "exhibition", "design", "tool", "fashion"] as const;
export type ScreeningGroup = typeof SCREENING_GROUPS[number];
export function screenCandidate(item: IntelItem): { group: ScreeningGroup; relevance: number; rejected: boolean } {
  const source = VISUAL_CULTURE_SOURCES.find((s) => s.label === item.sourceAccount);
  const title = item.title.toLowerCase();
  const text = `${title} ${item.text.slice(0, 1400)}`.toLowerCase();
  const groups: Array<[ScreeningGroup, RegExp]> = [
    ["photography", /photograph|photo\b|portrait|写真|摄影|사진|포토/],
    ["exhibition", /exhibition|museum|curator|gallery|展覧|展览|美術館|전시|미술관/],
    ["design", /typograph|graphic|architecture|architect|visual identity|typeface|design studio|设计|建築|디자인|건축/],
    ["tool", /lighting|pixel|camera|world model|generative|software|布光|工具|相机|照明|조명/],
    ["fashion", /runway|collection|couture|styling|fashion|时装|造型|コレクション|패션|컬렉션/],
  ];
  let group = groups.find(([, pattern]) => pattern.test(text))?.[0];
  if (source?.role === "tool_vendor") group = "tool";
  if (source?.role === "photography") group = "photography";
  if (source?.role === "institution") group = "exhibition";
  group ||= item.keywords?.includes("photography") ? "photography" : "fashion";
  const lowValue = /horoscope|zodiac|blood sugar|weight loss|best gifts|best shampoos|best cleansers|运势|减肥|星座|血糖|星占|운세|혈당|연애 조언|寿命/.test(title);
  const shopping = /add to cart|best .*(buy|shop)|おすすめ\d+選|购物清单/.test(title);
  const strong = groups.filter(([, pattern]) => pattern.test(text)).length;
  return { group, rejected: lowValue || shopping, relevance: (source?.role === "institution" || source?.role === "photography" ? 35 : 0)
    + (source?.role === "tool_vendor" ? 20 : 0) + Math.min(30, strong * 10) + Math.min(15, Math.floor(item.text.length / 80))
    + (/project|process|interview|technique|making|archive|craft|工艺|制作|访谈|取材/.test(text) ? 15 : 0) };
}

export function balanceCandidates(items: readonly IntelItem[], limit: number, now = new Date().toISOString()) {
  const pools = SCREENING_GROUPS.map((group) => items.filter((item) => screenCandidate(item).group === group).sort((a, b) =>
    Number(classifyFreshness(b, now).kind === "latest") - Number(classifyFreshness(a, now).kind === "latest") || screenCandidate(b).relevance - screenCandidate(a).relevance || (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0) || a.id.localeCompare(b.id)));
  const selected: IntelItem[] = []; const sourceCounts = new Map<string, number>();
  const cap = Math.max(1, Math.ceil(limit / 10));
  const referenceCap = Math.floor(limit * 0.25);
  let referenceCount = 0;
  let added = true;
  while (selected.length < limit && added) {
    added = false;
    for (const pool of pools) {
      const index = pool.findIndex((item) => (sourceCounts.get(item.sourceAccount || item.sourceUrl) || 0) < cap && (classifyFreshness(item, now).kind === "latest" || referenceCount < referenceCap));
      if (index < 0 || selected.length >= limit) continue;
      const [item] = pool.splice(index, 1); selected.push(item); added = true;
      if (classifyFreshness(item, now).kind !== "latest") referenceCount += 1;
      const key = item.sourceAccount || item.sourceUrl; sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    }
  }
  return selected;
}
