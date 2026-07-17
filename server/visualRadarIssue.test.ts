import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import type { VisualRadarAnalysis } from "./visualRadarAnalysis";
import type { VisualRadarSelectedStory } from "./visualRadarDailySelector";
import {
  createVisualRadarIssue,
  createVisualRadarIssueStore,
  getAdjacentVisualRadarIssueIds,
  type VisualRadarIssue,
} from "./visualRadarIssue";

describe("visualRadarIssue", () => {
  it("creates a dated immutable issue snapshot with source and topic stats", () => {
    const selected = [buildSelected("one", "photography", "Source A")];
    const issue = createVisualRadarIssue(
      { selected, skipped: [] },
      {
        existingIds: [],
        now: "2026-07-16T08:00:00.000Z",
      }
    );

    expect(issue).toMatchObject({
      id: "2026-07-16",
      issueDate: "2026-07-16",
      title: "Visual Radar Daily — 2026.07.16",
      stats: {
        bySource: { "Source A": 1 },
        byTopic: { photography: 1 },
        storyCount: 1,
      },
    });
    expect(issue.stories[0].analysis.chineseTitle).toBe("中文标题 one");
    expect(issue.featuredStoryIds).toEqual(["one"]);
  });

  it("persists issues newest first and returns adjacent issue ids", () => {
    const store = createVisualRadarIssueStore(tempFile());
    const older = createVisualRadarIssue(
      { selected: [buildSelected("older")], skipped: [] },
      { existingIds: [], now: "2026-07-15T08:00:00.000Z" }
    );
    const newer = createVisualRadarIssue(
      { selected: [buildSelected("newer")], skipped: [] },
      { existingIds: [older.id], now: "2026-07-16T08:00:00.000Z" }
    );
    store.saveIssue(older);
    store.saveIssue(newer);

    expect(store.listIssues().map((issue) => issue.id)).toEqual([
      "2026-07-16",
      "2026-07-15",
    ]);
    expect(getAdjacentVisualRadarIssueIds(store.listIssues(), newer.id)).toEqual({
      nextId: null,
      previousId: older.id,
    });
    expect(getAdjacentVisualRadarIssueIds(store.listIssues(), older.id)).toEqual({
      nextId: newer.id,
      previousId: null,
    });
  });

  it("keeps saved story data unchanged when caller objects mutate later", () => {
    const store = createVisualRadarIssueStore(tempFile());
    const issue = createVisualRadarIssue(
      { selected: [buildSelected("stable")], skipped: [] },
      { existingIds: [], now: "2026-07-16T08:00:00.000Z" }
    );
    store.saveIssue(issue);
    issue.stories[0].analysis.chineseTitle = "被调用方修改";

    expect(store.getIssue(issue.id)?.stories[0].analysis.chineseTitle).toBe(
      "中文标题 stable"
    );
  });

  it("replaces same-day snapshots with one full issue", () => {
    const archivePath = tempFile();
    const store = createVisualRadarIssueStore(archivePath);
    const first = createVisualRadarIssue(
      { selected: [buildSelected("old")], skipped: [] },
      { existingIds: [], now: "2026-07-16T08:00:00.000Z" }
    );
    const eligible = Array.from({ length: 30 }, (_, index) =>
      buildSelected(`full-${index}`)
    );
    const refreshed = createVisualRadarIssue(
      { eligible, selected: eligible.slice(0, 10), skipped: [] },
      { existingIds: [first.id], now: "2026-07-16T12:00:00.000Z" }
    );

    store.saveIssue(first);
    store.saveIssue(refreshed);

    expect(store.listIssues()).toHaveLength(1);
    expect(store.listIssues()[0]).toMatchObject({
      id: "2026-07-16",
      featuredStoryIds: eligible.slice(0, 10).map((story) => story.item.id),
      stats: { storyCount: 30 },
    });
    expect(store.listIssues()[0].stories).toHaveLength(30);
  });

  it("normalizes legacy issues without featured ids", () => {
    const archivePath = tempFile();
    const legacy = createVisualRadarIssue(
      { selected: Array.from({ length: 12 }, (_, index) => buildSelected(`legacy-${index}`)), skipped: [] },
      { existingIds: [], now: "2026-07-15T08:00:00.000Z" }
    ) as VisualRadarIssue & { featuredStoryIds?: string[] };
    delete (legacy as { featuredStoryIds?: string[] }).featuredStoryIds;
    fs.writeFileSync(archivePath, JSON.stringify({ issues: [legacy] }), "utf-8");

    expect(createVisualRadarIssueStore(archivePath).listIssues()[0].featuredStoryIds).toEqual(
      legacy.stories.slice(0, 10).map((story) => story.item.id)
    );
  });
});

function buildSelected(
  id: string,
  primaryTopic: VisualRadarAnalysis["primaryTopic"] = "photography",
  sourceAccount = `Source ${id}`
): VisualRadarSelectedStory {
  const item = createIntelItem({
    capturedAt: "2026-07-16T07:00:00.000Z",
    contentHash: `sha1:${id}`,
    hashtags: [],
    id,
    keywords: [primaryTopic],
    lang: "en",
    market: "EU",
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt: "2026-07-16T06:00:00.000Z",
    provenance: {
      authenticity: "live",
      collector: "visual-radar-rss",
      evidenceUrl: `https://example.com/${id}/feed`,
      label: "真实采集",
    },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount,
    sourceType: "inspiration",
    sourceUrl: `https://example.com/${id}`,
    text: `Summary ${id}`,
    thumbnailUrl: null,
    title: `Title ${id}`,
  });
  return {
    analysis: {
      analyzedAt: "2026-07-16T07:30:00.000Z",
      chineseSummary: `中文摘要 ${id}`,
      chineseTitle: `中文标题 ${id}`,
      contentHash: item.contentHash,
      itemId: item.id,
      model: "gpt-test",
      primaryTopic,
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
    },
    item,
    window: "24h",
  };
}

function tempFile() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-issues-")),
    "issues.json"
  );
}
