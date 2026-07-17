import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { normalizeVisualRadarAnalysis } from "./visualRadarAnalysis";
import { createVisualRadarIssueStore } from "./visualRadarIssue";
import {
  VisualRadarConfigurationError,
  analyzeVisualRadarArtifact,
  generateVisualRadarIssueFromArtifacts,
  getVisualRadarIssueDetail,
} from "./visualRadarWorkflow";

const item = createIntelItem({
  capturedAt: "2026-07-16T07:00:00.000Z",
  hashtags: [],
  id: "visual-1",
  keywords: ["photography"],
  lang: "en",
  market: "EU",
  mediaUrls: [],
  metrics: emptyIntelMetrics(),
  postedAt: "2026-07-16T06:00:00.000Z",
  provenance: {
    authenticity: "live",
    collector: "visual-radar-rss",
    evidenceUrl: "https://example.com/feed",
    label: "真实采集",
  },
  signalType: "inspiration_signal",
  source: "website",
  sourceAccount: "Independent Magazine",
  sourceType: "inspiration",
  sourceUrl: "https://example.com/story",
  text: "A visual culture story.",
  thumbnailUrl: null,
  title: "Visual story",
});

const rawArtifact = {
  failures: [],
  generatedAt: "2026-07-16T07:00:00.000Z",
  items: [item],
  schemaVersion: "1" as const,
};

const emptyAnalysisArtifact = {
  analyses: [],
  failures: [],
  generatedAt: "2026-07-16T07:00:00.000Z",
  promptVersion: "visual-daily-v1",
};

describe("analyzeVisualRadarArtifact", () => {
  it("rejects analysis when no server-side provider is configured", async () => {
    await expect(
      analyzeVisualRadarArtifact({
        analysisArtifact: emptyAnalysisArtifact,
        itemsArtifact: rawArtifact,
        now: "2026-07-16T08:00:00.000Z",
        provider: null,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<VisualRadarConfigurationError>>({
        statusCode: 503,
      })
    );
  });

  it("analyzes uncached items once and reports cache hits on the next run", async () => {
    const provider = vi.fn(async (items: typeof rawArtifact.items) =>
      items.map((sourceItem) =>
        normalizeVisualRadarAnalysis(
          {
            chineseSummary: "中文摘要",
            chineseTitle: "中文标题",
            primaryTopic: "photography",
            scoreBreakdown: {
              informationSpecificity: 12,
              novelty: 16,
              professionalRelevance: 16,
              sourceQuality: 8,
              timeliness: 5,
              visualInspiration: 24,
            },
            selectionRationale: "值得关注",
            trendKeywords: ["摄影"],
          },
          {
            analyzedAt: "2026-07-16T08:00:00.000Z",
            contentHash: sourceItem.contentHash,
            itemId: sourceItem.id,
            model: "gpt-test",
          }
        )
      )
    );
    const first = await analyzeVisualRadarArtifact({
      analysisArtifact: emptyAnalysisArtifact,
      itemsArtifact: rawArtifact,
      now: "2026-07-16T08:00:00.000Z",
      provider,
    });
    const second = await analyzeVisualRadarArtifact({
      analysisArtifact: first.artifact,
      itemsArtifact: rawArtifact,
      now: "2026-07-16T08:05:00.000Z",
      provider,
    });

    expect(first.summary).toEqual({ analyzed: 1, cached: 0, failed: 0, totalEligible: 1 });
    expect(second.summary).toEqual({ analyzed: 0, cached: 1, failed: 0, totalEligible: 1 });
    expect(provider).toHaveBeenCalledTimes(1);
  });
});

describe("generateVisualRadarIssueFromArtifacts", () => {
  it("blocks issue generation when no successful analysis is available", () => {
    const store = createVisualRadarIssueStore(tempFile());
    expect(() =>
      generateVisualRadarIssueFromArtifacts({
        analysisArtifact: emptyAnalysisArtifact,
        issueStore: store,
        itemsArtifact: rawArtifact,
        now: "2026-07-16T08:00:00.000Z",
      })
    ).toThrow("No analyzed Visual Radar stories are eligible");
  });

  it("saves an issue and returns stable adjacent navigation metadata", () => {
    const store = createVisualRadarIssueStore(tempFile());
    const analysis = normalizeVisualRadarAnalysis(
      {
        chineseSummary: "中文摘要",
        chineseTitle: "中文标题",
        primaryTopic: "photography",
        scoreBreakdown: {
          informationSpecificity: 12,
          novelty: 16,
          professionalRelevance: 16,
          sourceQuality: 8,
          timeliness: 5,
          visualInspiration: 24,
        },
        selectionRationale: "值得关注",
        trendKeywords: ["摄影"],
      },
      {
        analyzedAt: "2026-07-16T07:30:00.000Z",
        contentHash: item.contentHash,
        itemId: item.id,
        model: "gpt-test",
      }
    );
    const issue = generateVisualRadarIssueFromArtifacts({
      analysisArtifact: {
        ...emptyAnalysisArtifact,
        analyses: [analysis],
      },
      issueStore: store,
      itemsArtifact: rawArtifact,
      now: "2026-07-16T08:00:00.000Z",
    });

    expect(issue.stories).toHaveLength(1);
    expect(getVisualRadarIssueDetail(store, issue.id)).toMatchObject({
      issue: { id: "2026-07-16" },
      navigation: { nextId: null, previousId: null },
    });
  });

  it("keeps same-day interpreted stories when a later collection window drops them", () => {
    const store = createVisualRadarIssueStore(tempFile());
    const olderItem = buildItem("older-story", "2026-07-16T05:00:00.000Z");
    const newerItem = buildItem("newer-story", "2026-07-16T09:00:00.000Z");
    const analyses = [olderItem, newerItem].map((sourceItem) =>
      normalizeVisualRadarAnalysis(
        {
          chineseSummary: `中文摘要 ${sourceItem.id}`,
          chineseTitle: `中文标题 ${sourceItem.id}`,
          primaryTopic: "photography",
          scoreBreakdown: {
            informationSpecificity: 12,
            novelty: 16,
            professionalRelevance: 16,
            sourceQuality: 8,
            timeliness: 5,
            visualInspiration: 24,
          },
          selectionRationale: "值得关注",
          trendKeywords: ["摄影"],
        },
        {
          analyzedAt: "2026-07-16T10:00:00.000Z",
          contentHash: sourceItem.contentHash,
          itemId: sourceItem.id,
          model: "gpt-test",
        }
      )
    );
    const analysisArtifact = { ...emptyAnalysisArtifact, analyses };

    generateVisualRadarIssueFromArtifacts({
      analysisArtifact,
      issueStore: store,
      itemsArtifact: { ...rawArtifact, items: [olderItem] },
      now: "2026-07-16T08:00:00.000Z",
    });
    const refreshed = generateVisualRadarIssueFromArtifacts({
      analysisArtifact,
      issueStore: store,
      itemsArtifact: { ...rawArtifact, items: [newerItem] },
      now: "2026-07-16T12:00:00.000Z",
    });

    expect(refreshed.stories.map((story) => story.item.id).sort()).toEqual([
      "newer-story",
      "older-story",
    ]);
  });
});

function buildItem(id: string, postedAt: string) {
  return createIntelItem({
    capturedAt: postedAt,
    hashtags: [],
    id,
    keywords: ["photography"],
    lang: "en",
    market: "EU",
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt,
    provenance: {
      authenticity: "live",
      collector: "visual-radar-rss",
      evidenceUrl: "https://example.com/feed",
      label: "真实采集",
    },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount: "Independent Magazine",
    sourceType: "inspiration",
    sourceUrl: `https://example.com/${id}`,
    text: `Story ${id}`,
    thumbnailUrl: null,
    title: `Story ${id}`,
  });
}

function tempFile() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-api-")),
    "issues.json"
  );
}
