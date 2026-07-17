import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics, type IntelItem } from "./intelItem";
import type { VisualRadarAnalysis } from "./visualRadarAnalysis";
import { selectVisualRadarDailyStories } from "./visualRadarDailySelector";

describe("selectVisualRadarDailyStories", () => {
  it("prefers the last 24 hours and uses the 72-hour window only as fallback", () => {
    const recent = Array.from({ length: 8 }, (_, index) =>
      buildPair(`recent-${index}`, {
        postedAt: `2026-07-16T0${index}:00:00.000Z`,
        sourceAccount: `Recent ${index}`,
      })
    );
    const older = Array.from({ length: 4 }, (_, index) =>
      buildPair(`older-${index}`, {
        postedAt: `2026-07-14T1${index}:00:00.000Z`,
        sourceAccount: `Older ${index}`,
      })
    );
    const result = selectVisualRadarDailyStories({
      analyses: [...recent, ...older].map((pair) => pair.analysis),
      items: [...recent, ...older].map((pair) => pair.item),
      now: "2026-07-16T12:00:00.000Z",
      previouslySelectedItemIds: new Set(),
    });

    expect(result.selected).toHaveLength(10);
    expect(result.selected.filter((entry) => entry.window === "24h")).toHaveLength(8);
    expect(result.selected.filter((entry) => entry.window === "72h")).toHaveLength(2);
  });

  it("excludes low scores, previous issues, duplicate content, and excess same-source stories", () => {
    const pairs = [
      buildPair("source-1", { sourceAccount: "One Source" }, { score: 95 }),
      buildPair("source-2", { sourceAccount: "One Source" }, { score: 94 }),
      buildPair("source-3", { sourceAccount: "One Source" }, { score: 93 }),
      buildPair("previous", { sourceAccount: "Other" }, { score: 92 }),
      buildPair("low", { sourceAccount: "Other 2" }, { score: 59 }),
      buildPair("duplicate-a", { sourceAccount: "Other 3" }, { score: 91 }),
      buildPair(
        "duplicate-b",
        { contentHash: "sha1:duplicate-a", sourceAccount: "Other 4" },
        { contentHash: "sha1:duplicate-a", score: 90 }
      ),
    ];
    const result = selectVisualRadarDailyStories({
      analyses: pairs.map((pair) => pair.analysis),
      items: pairs.map((pair) => pair.item),
      now: "2026-07-16T12:00:00.000Z",
      previouslySelectedItemIds: new Set(["previous"]),
    });

    expect(result.selected.map((entry) => entry.item.id)).toEqual([
      "source-1",
      "source-2",
      "duplicate-a",
    ]);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { itemId: "source-3", reason: "source_limit" },
        { itemId: "previous", reason: "previous_issue" },
        { itemId: "low", reason: "score_below_60" },
        { itemId: "duplicate-b", reason: "duplicate_content" },
      ])
    );
  });

  it("prefers at least four topics before filling remaining slots", () => {
    const topicPairs = [
      buildPair("photo-1", {}, { primaryTopic: "photography", score: 98 }),
      buildPair("photo-2", {}, { primaryTopic: "photography", score: 97 }),
      buildPair("photo-3", {}, { primaryTopic: "photography", score: 96 }),
      buildPair("style", {}, { primaryTopic: "styling", score: 80 }),
      buildPair("culture", {}, { primaryTopic: "fashion_culture", score: 79 }),
      buildPair("tool", {}, { primaryTopic: "tool", score: 78 }),
    ];
    const result = selectVisualRadarDailyStories({
      analyses: topicPairs.map((pair) => pair.analysis),
      items: topicPairs.map((pair) => pair.item),
      limit: 4,
      now: "2026-07-16T12:00:00.000Z",
      previouslySelectedItemIds: new Set(),
    });

    expect(new Set(result.selected.map((entry) => entry.analysis.primaryTopic)).size).toBe(4);
  });

  it("keeps every valuable story for the webpage while featuring only ten", () => {
    const pairs = Array.from({ length: 30 }, (_, index) =>
      buildPair(`valuable-${index}`, {
        sourceAccount: `Source ${index}`,
      }, {
        score: 90 - (index % 10),
      })
    );
    const result = selectVisualRadarDailyStories({
      analyses: pairs.map((pair) => pair.analysis),
      items: pairs.map((pair) => pair.item),
      now: "2026-07-16T12:00:00.000Z",
      previouslySelectedItemIds: new Set(),
    });

    expect(result.eligible).toHaveLength(30);
    expect(result.selected).toHaveLength(10);
    expect(result.selected.every((story) =>
      result.eligible.some((eligible) => eligible.item.id === story.item.id)
    )).toBe(true);
  });
});

function buildPair(
  id: string,
  itemOverrides: Partial<IntelItem> = {},
  analysisOverrides: Partial<VisualRadarAnalysis> = {}
) {
  const contentHash = itemOverrides.contentHash || `sha1:${id}`;
  const item = createIntelItem({
    capturedAt: "2026-07-16T10:00:00.000Z",
    contentHash,
    hashtags: [],
    id,
    keywords: ["photography"],
    lang: "en",
    market: "EU",
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt: "2026-07-16T10:00:00.000Z",
    provenance: {
      authenticity: "live",
      collector: "visual-radar-rss",
      evidenceUrl: `https://example.com/${id}/feed`,
      label: "真实采集",
    },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount: `Source ${id}`,
    sourceType: "inspiration",
    sourceUrl: `https://example.com/${id}`,
    text: `Summary ${id}`,
    thumbnailUrl: null,
    title: `Title ${id}`,
    ...itemOverrides,
  });
  const analysis: VisualRadarAnalysis = {
    analyzedAt: "2026-07-16T11:00:00.000Z",
    chineseSummary: `摘要 ${id}`,
    chineseTitle: `标题 ${id}`,
    contentHash,
    itemId: id,
    model: "gpt-test",
    primaryTopic: "photography",
    promptVersion: "visual-daily-v1",
    score: 80,
    scoreBreakdown: {
      informationSpecificity: 12,
      novelty: 16,
      professionalRelevance: 16,
      sourceQuality: 8,
      timeliness: 4,
      visualInspiration: 24,
    },
    selectionRationale: "值得关注",
    status: "success",
    trendKeywords: ["摄影"],
    ...analysisOverrides,
  };
  return { analysis, item };
}
