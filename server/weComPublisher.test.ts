import { describe, expect, it, vi } from "vitest";

import type { VisualRadarIssue } from "./visualRadarIssue";
import {
  buildWeComMarkdownContent,
  getWeComStatus,
  sendVisualRadarIssueToWeCom,
} from "./weComPublisher";

describe("weComPublisher", () => {
  it("publishes only the ten featured stories and links the full report", () => {
    const markdown = buildWeComMarkdownContent(issue(), "https://visual.example.com");

    expect(markdown).toContain("本期网页共 12 条");
    expect(markdown).toContain("精选标题 10");
    expect(markdown).not.toContain("精选标题 11");
    expect(markdown).toContain("https://visual.example.com/issues/2026-07-16");
  });

  it("links a report below the GitHub Pages project path", () => {
    const markdown = buildWeComMarkdownContent(
      issue(),
      "https://visual-radar-owner.github.io/visual-radar/"
    );

    expect(markdown).toContain(
      "https://visual-radar-owner.github.io/visual-radar/issues/2026-07-16"
    );
    expect(markdown).not.toContain(
      "https://visual-radar-owner.github.io/visual-radar//issues/2026-07-16"
    );
    expect(markdown).toContain("精选标题 10");
    expect(markdown).not.toContain("精选标题 11");
  });

  it("returns status without exposing the webhook", () => {
    expect(getWeComStatus({
      publicUrl: "https://visual.example.com",
      webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret",
    })).toEqual({ configured: true, publicUrl: "https://visual.example.com" });
  });

  it("sends markdown through an HTTPS webhook", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: "ok" }),
      text: async () => "",
    });

    await sendVisualRadarIssueToWeCom(issue(), {
      fetchImpl: fetchImpl as typeof fetch,
      publicUrl: "https://visual.example.com",
      webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("qyapi.weixin.qq.com"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

function issue(): VisualRadarIssue {
  const stories = Array.from({ length: 12 }, (_, index) => ({
    analysis: {
      analyzedAt: "2026-07-16T08:00:00.000Z",
      chineseSummary: `这是精选摘要 ${index + 1}，用于验证企业微信只发送精选内容。`,
      chineseTitle: `精选标题 ${index + 1}`,
      contentHash: `sha1:${index}`,
      itemId: `story-${index + 1}`,
      model: "test",
      primaryTopic: "photography" as const,
      promptVersion: "visual-daily-v1",
      score: 90 - index,
      scoreBreakdown: {
        informationSpecificity: 12,
        novelty: 16,
        professionalRelevance: 16,
        sourceQuality: 8,
        timeliness: 4,
        visualInspiration: 24,
      },
      selectionRationale: "值得关注",
      status: "success" as const,
      trendKeywords: ["摄影"],
    },
    item: {
      capturedAt: "2026-07-16T07:00:00.000Z",
      contentHash: `sha1:${index}`,
      dedupKey: `example.com/${index}`,
      id: `story-${index + 1}`,
      interpretation: null,
      market: "EU" as const,
      mediaUrls: [],
      metrics: {
        comments: null, growthPct: null, inStock: null, isNew: null,
        likes: null, postCount: null, previousPrice: null, price: null,
        rankChange: null, saves: null, searchIndex: null, shares: null,
      },
      provenance: { authenticity: "live" as const, label: "真实采集" },
      schemaVersion: "1" as const,
      signalType: "inspiration_signal" as const,
      source: "website" as const,
      sourceAccount: `Source ${index % 3}`,
      sourceType: "inspiration" as const,
      sourceUrl: `https://example.com/${index}`,
      text: `Story ${index}`,
      tier: null,
      title: `Story ${index}`,
      viviaScore: null,
    },
    window: "24h" as const,
  }));
  return {
    featuredStoryIds: stories.slice(0, 10).map((story) => story.item.id),
    generatedAt: "2026-07-16T08:00:00.000Z",
    id: "2026-07-16",
    issueDate: "2026-07-16",
    metadata: { models: ["test"], promptVersion: "visual-daily-v1" },
    skipped: [],
    stats: {
      bySource: { "Source 0": 4, "Source 1": 4, "Source 2": 4 },
      byTopic: { photography: 12 },
      storyCount: 12,
    },
    stories,
    title: "Visual Radar Daily — 2026.07.16",
  };
}
