import { describe, expect, it } from "vitest";
import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { areLikelySameVisualEvent, confirmedSameEvent, groupVisualRadarEvents, hasNewEventDevelopment } from "./visualRadarEventDedup";
import type { VisualRadarSelectedStory } from "./visualRadarDailySelector";

function story(id: string, url: string, title: string, key?: string, development?: { summary: string; factIndexes: number[] }): VisualRadarSelectedStory {
  const item = createIntelItem({ id, title, text: `${title} ${id}`, sourceUrl: url, sourceAccount: "Test", capturedAt: "2026-10-26T00:00:00Z", postedAt: "2026-10-25T00:00:00Z", market: "global", source: "website", sourceType: "inspiration", mediaUrls: [], metrics: emptyIntelMetrics(), signalType: "inspiration_signal", provenance: { authenticity: "live", label: "live" }, thumbnailUrl: null });
  return { item, window: "72h", analysis: { itemId: id, contentHash: item.contentHash, analyzedAt: "2026-10-26T01:00:00Z", model: "codex", promptVersion: "visual-daily-v1", status: "success", chineseTitle: title, chineseSummary: title, primaryTopic: "fashion_culture", score: 80, scoreBreakdown: { informationSpecificity: 12, novelty: 16, professionalRelevance: 16, sourceQuality: 8, timeliness: 4, visualInspiration: 24 }, selectionRationale: "明确方法", trendKeywords: ["视觉"], editorial: { version: "evidence-v1", status: "verified", sourceUrl: url, snapshotHash: "hash", facts: [{ statement: "事实", quote: "evidence" }], visualMethod: "方法", application: "建议", visualTags: ["叙事"], limitation: "限制", event: key ? { key, label: "Prada campaign", ...(development ? { development } : {}) } : undefined } } };
}

describe("visual event dedup", () => {
  it("does not confirm different Gabbriette projects just because they share people", () => {
    const wedding = story("wedding", "https://a.example/wedding", "Gabbriette Matières Fecales wedding fitting", "gabbriette-wedding-2026");
    const other = story("other", "https://b.example/new", "Gabbriette Matières Fecales new collection", "matieres-collection-2027");
    expect(areLikelySameVisualEvent(wedding.item, other.item)).toBe(true);
    expect(confirmedSameEvent(wedding, other)).toBeNull();
    expect(groupVisualRadarEvents([wedding, other]).eligible).toHaveLength(2);
  });
  it("recognizes tracked URLs and explicit legacy anchors without modifying old stories", () => {
    const a = story("old", "https://a.example/story/?utm_source=test", "Old title");
    const b = story("b", "https://a.example/story/", "New title");
    expect(confirmedSameEvent(a, b)).toBe("url");
    const c = story("c", "https://c.example/article", "Different source", "legacy-old");
    const before = JSON.stringify(a);
    expect(groupVisualRadarEvents([c], [{ issueId: "2026-10-25", story: a }]).eligible).toEqual([]);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("combines connected buckets and preserves all secondary links", () => {
    const a = story("a", "https://a.example/story", "A", "event-one");
    const b = story("b", "https://b.example/story", "B", "event-two");
    const bridge = story("bridge", "https://b.example/story?utm_medium=x", "C", "event-one");
    const result = groupVisualRadarEvents([a, b, bridge]);
    expect(result.eligible).toHaveLength(1); expect(result.groups[0].related).toHaveLength(2);
  });
  it("only confirms a duplicate with the same URL, content hash or explicit event key", () => {
    const a = story("a", "https://a.example/story", "Barry Jenkins Prada campaign", "prada-aw26");
    const b = story("b", "https://b.example/story", "Barry Jenkins Prada campaign", "prada-aw26");
    const c = story("c", "https://c.example/story", "Barry Jenkins Prada campaign", "other-event");
    expect(confirmedSameEvent(a, b)).toBe("event"); expect(confirmedSameEvent(a, c)).toBeNull();
    expect(areLikelySameVisualEvent(a.item, c.item)).toBe(true); // warning only
  });
  it("merges same-event candidates but keeps a new documented development", () => {
    const old = story("old", "https://old.example", "Prada campaign", "prada-aw26");
    const same = story("same", "https://new.example", "Prada campaign", "prada-aw26");
    const next = story("next", "https://next.example", "Prada campaign", "prada-aw26", { summary: "新增可核验的镜头制作方法", factIndexes: [0] });
    expect(hasNewEventDevelopment(next, [old])).toBe(false); // same fact, not a new development
    next.analysis.editorial!.facts = [{ statement: "公布了制作中使用的反射材料", quote: "Reflective boards controlled the lighting" }];
    const grouped = groupVisualRadarEvents([same, next], [{ issueId: "old-issue", story: old }]);
    expect(grouped.eligible.map(s => s.item.id)).toEqual([next.item.id]);
    expect(grouped.groups[0].disposition).toBe("development");
    expect(grouped.groups[0].related.map(s => s.sourceUrl)).toContain(old.item.sourceUrl);
    expect(grouped.skipped).toContainEqual({ itemId: same.item.id, reason: "same_event" });
  });
});
