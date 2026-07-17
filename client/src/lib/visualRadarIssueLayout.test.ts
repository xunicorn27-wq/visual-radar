import { describe, expect, it } from "vitest";

import type { VisualRadarIssue, VisualRadarSelectedStory } from "./api";
import { buildVisualRadarIssueLayout } from "./visualRadarIssueLayout";

describe("buildVisualRadarIssueLayout", () => {
  it("chooses the highest-scoring story with an image as lead", () => {
    const issue = buildIssue([
      buildStory("highest-text", "photography", 98, null),
      buildStory("image-lead", "styling", 92, "https://images.example.com/lead.jpg"),
      buildStory("tool", "tool", 88, null),
    ]);

    expect(buildVisualRadarIssueLayout(issue).lead?.item.id).toBe("image-lead");
  });

  it("groups supporting stories into the four stable editorial sections", () => {
    const issue = buildIssue([
      buildStory("lead", "photography", 99, "https://images.example.com/lead.jpg"),
      buildStory("styling", "styling", 90, null),
      buildStory("outfit", "outfit", 89, null),
      buildStory("creator", "creator", 88, null),
      buildStory("exhibition", "exhibition", 87, null),
      buildStory("magazine", "magazine", 86, null),
      buildStory("tool", "tool", 85, null),
    ]);
    const layout = buildVisualRadarIssueLayout(issue);

    expect(layout.sections.map((section) => section.id)).toEqual([
      "styling",
      "photography",
      "culture",
      "tools",
    ]);
    expect(layout.sections.map((section) => section.stories.length)).toEqual([
      2,
      1,
      2,
      1,
    ]);
    expect(layout.topStories).toHaveLength(5);
    expect(layout.readingMinutes).toBeGreaterThan(0);
  });

  it("returns a stable empty layout", () => {
    expect(buildVisualRadarIssueLayout(null)).toEqual({
      featuredStories: [],
      lead: null,
      readingMinutes: 0,
      sections: [],
      topStories: [],
    });
  });

  it("renders all thirty stories while keeping ten featured stories", () => {
    const stories = Array.from({ length: 30 }, (_, index) =>
      buildStory(
        `story-${index}`,
        index % 2 === 0 ? "photography" : "styling",
        100 - index,
        index === 0 ? "https://images.example.com/lead.jpg" : null
      )
    );
    const issue = buildIssue(stories, stories.slice(0, 10).map((story) => story.item.id));
    const layout = buildVisualRadarIssueLayout(issue);

    expect(layout.featuredStories).toHaveLength(10);
    expect([layout.lead, ...layout.sections.flatMap((section) => section.stories)]).toHaveLength(30);
  });
});

function buildIssue(
  stories: VisualRadarSelectedStory[],
  featuredStoryIds = stories.slice(0, 10).map((story) => story.item.id)
): VisualRadarIssue {
  return {
    featuredStoryIds,
    generatedAt: "2026-07-16T08:00:00.000Z",
    id: "2026-07-16",
    issueDate: "2026-07-16",
    metadata: { models: ["gpt-test"], promptVersion: "visual-daily-v1" },
    skipped: [],
    stats: { bySource: {}, byTopic: {}, storyCount: stories.length },
    stories,
    title: "Visual Radar Daily — 2026.07.16",
  };
}

function buildStory(
  id: string,
  primaryTopic: VisualRadarSelectedStory["analysis"]["primaryTopic"],
  score: number,
  thumbnailUrl: string | null
): VisualRadarSelectedStory {
  return {
    analysis: {
      analyzedAt: "2026-07-16T07:30:00.000Z",
      chineseSummary: "这是用于验证视觉日报布局的中文摘要。",
      chineseTitle: `中文标题 ${id}`,
      contentHash: `sha1:${id}`,
      itemId: id,
      model: "gpt-test",
      primaryTopic,
      promptVersion: "visual-daily-v1",
      score,
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
      trendKeywords: ["视觉文化"],
    },
    item: {
      capturedAt: "2026-07-16T07:00:00.000Z",
      contentHash: `sha1:${id}`,
      dedupKey: `example.com/${id}`,
      id,
      interpretation: null,
      market: "EU",
      mediaUrls: [],
      metrics: {
        comments: null,
        growthPct: null,
        inStock: null,
        isNew: null,
        likes: null,
        postCount: null,
        previousPrice: null,
        price: null,
        rankChange: null,
        saves: null,
        searchIndex: null,
        shares: null,
      },
      postedAt: "2026-07-16T06:00:00.000Z",
      provenance: { authenticity: "live", label: "真实采集" },
      schemaVersion: "1",
      signalType: "inspiration_signal",
      source: "website",
      sourceAccount: `Source ${id}`,
      sourceType: "inspiration",
      sourceUrl: `https://example.com/${id}`,
      text: `Summary ${id}`,
      thumbnailUrl,
      tier: null,
      title: `Title ${id}`,
      viviaScore: null,
    },
    window: "24h",
  };
}
