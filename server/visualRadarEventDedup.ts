import { normalizeDedupUrl, type IntelItem } from "./intelItem";
import type { VisualRadarSelectedStory } from "./visualRadarDailySelector";

export interface EventSource {
  itemId: string; issueId?: string; sourceUrl: string; title: string; source: string;
}
export interface EventGroup {
  key: string; label: string; representative: EventSource; related: EventSource[];
  disposition: "merged" | "previous" | "development";
}
export interface PastEventStory { issueId: string; story: VisualRadarSelectedStory }
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function confirmedSameEvent(a: VisualRadarSelectedStory, b: VisualRadarSelectedStory) {
  if (a.item.contentHash === b.item.contentHash) return "content";
  if (a.item.id === b.item.id) return "id";
  if (a.item.sourceUrl && normalizeDedupUrl(a.item.sourceUrl) === normalizeDedupUrl(b.item.sourceUrl)) return "url";
  const key = a.analysis.editorial?.event?.key;
  if (key && key === (b.analysis.editorial?.event?.key || `legacy-${b.item.id}`)) return "event";
  if (b.analysis.editorial?.event?.key === `legacy-${a.item.id}`) return "event";
  return null;
}

const COMMON = new Set("The This That With From Inside Fashion Photography Photo Photos Design Studio Collection Campaign Spring Summer Fall Winter July October New Interview Review Read Look Meet Awards London Paris Tokyo Vogue Runway Museum Gallery Exhibition Exhibitions Display Event Special South Kensington East Storehouse First Best Guide How For And Are His Her Its On Into More".toLowerCase().split(" "));
export function extractEventEntities(item: Pick<IntelItem, "title">) {
  return new Set((item.title.match(/\b[A-Z][A-Za-z’'-]{2,}\b/g) || []).map(normalize).filter(t => !COMMON.has(t)));
}
// Heuristic matches are warnings only. They must never merge or delete a story.
export function areLikelySameVisualEvent(a: IntelItem, b: IntelItem) {
  const left = Date.parse(a.postedAt || a.capturedAt), right = Date.parse(b.postedAt || b.capturedAt);
  if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left - right) > 14 * 86400_000) return false;
  const x = extractEventEntities(a), y = extractEventEntities(b);
  return [...x].filter(t => y.has(t)).length >= 2;
}

export function hasNewEventDevelopment(story: VisualRadarSelectedStory, previous: readonly VisualRadarSelectedStory[]) {
  const e = story.analysis.editorial, d = e?.event?.development;
  if (e?.status !== "verified" || !d || d.summary.trim().length < 8 || !d.factIndexes.length || d.factIndexes.some(i => !Number.isInteger(i) || i < 0 || i >= e.facts.length)) return false;
  if (previous.some(p => p.analysis.editorial?.status !== "verified")) return false; // No baseline to compare.
  const oldFacts = previous.flatMap(p => p.analysis.editorial?.facts || []);
  // This minimum traceability check does not prove semantic novelty.
  return d.factIndexes.every(index => {
    const fact = e.facts[index];
    return fact && !oldFacts.some(old => normalize(old.quote) === normalize(fact.quote) || normalize(old.statement) === normalize(fact.statement));
  }) && previous.every(p => p.item.contentHash !== story.item.contentHash);
}

function source(story: VisualRadarSelectedStory, issueId?: string): EventSource {
  return { itemId: story.item.id, sourceUrl: story.item.sourceUrl, title: story.analysis.chineseTitle || story.item.title,
    source: story.item.sourceAccount || "Visual Radar", ...(issueId ? { issueId } : {}) };
}

export function groupVisualRadarEvents(candidates: readonly VisualRadarSelectedStory[], history: readonly PastEventStory[] = []) {
  const buckets: VisualRadarSelectedStory[][] = [];
  for (const story of candidates) {
    const bucket = buckets.find(group => group.some(other => confirmedSameEvent(story, other)));
    if (bucket) {
      bucket.push(story);
      // Join connected groups so a bridging URL/event identity cannot leave two representatives.
      for (let i = buckets.length - 1; i >= 0; i--) {
        const other = buckets[i];
        if (other !== bucket && other.some(a => bucket.some(b => confirmedSameEvent(a, b)))) { bucket.push(...other); buckets.splice(i, 1); }
      }
    } else buckets.push([story]);
  }
  const eligible: VisualRadarSelectedStory[] = [];
  const skipped: Array<{ itemId: string; reason: "same_event" | "previous_event" | "duplicate_content" }> = [];
  const groups: EventGroup[] = [];
  for (const bucket of buckets) {
    const previous = history.filter(p => bucket.some(s => confirmedSameEvent(s, p.story)));
    const representative = previous.length ? bucket.find(s => hasNewEventDevelopment(s, previous.map(p => p.story))) : bucket[0];
    if (representative) eligible.push(representative);
    for (const s of bucket) if (s !== representative) skipped.push({ itemId: s.item.id, reason: representative ? (s.item.contentHash === representative.item.contentHash ? "duplicate_content" : "same_event") : "previous_event" });
    if (previous.length || bucket.length > 1) {
      const head = representative || previous[0].story;
      groups.push({ key: head.analysis.editorial?.event?.key || head.item.dedupKey || head.item.contentHash,
        label: head.analysis.editorial?.event?.label || head.analysis.chineseTitle || head.item.title,
        representative: source(head, representative ? undefined : previous[0].issueId),
        related: [...bucket.filter(s => s !== representative).map(s => source(s)), ...previous.filter(p => representative || p !== previous[0]).map(p => source(p.story, p.issueId))],
        disposition: previous.length ? (representative ? "development" : "previous") : "merged" });
    }
  }
  return { eligible, skipped, groups };
}
