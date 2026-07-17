import { describe, expect, it } from "vitest";

import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  getVisualAnalysisCacheKey,
  normalizeVisualRadarAnalysis,
} from "./visualRadarAnalysis";

describe("normalizeVisualRadarAnalysis", () => {
  it("clamps score components and computes the trusted total", () => {
    const result = normalizeVisualRadarAnalysis(
      {
        chineseSummary: "一组关注夜间公共空间与青年身份的摄影作品。",
        chineseTitle: "青年摄影重新观察夜间公共空间",
        primaryTopic: "photography",
        scoreBreakdown: {
          informationSpecificity: 14,
          novelty: 19,
          professionalRelevance: 18,
          sourceQuality: 12,
          timeliness: 7,
          visualInspiration: 40,
        },
        selectionRationale: "视觉方法明确，兼具青年文化观察。",
        trendKeywords: ["夜间摄影", "青年身份"],
      },
      {
        analyzedAt: "2026-07-16T02:00:00.000Z",
        contentHash: "sha1:item",
        itemId: "visual-1",
        model: "gpt-test",
      }
    );

    expect(result.scoreBreakdown).toEqual({
      informationSpecificity: 14,
      novelty: 19,
      professionalRelevance: 18,
      sourceQuality: 10,
      timeliness: 5,
      visualInspiration: 30,
    });
    expect(result.score).toBe(96);
    expect(result.promptVersion).toBe(VISUAL_ANALYSIS_PROMPT_VERSION);
  });

  it("normalizes unsupported topics and empty text without inventing content", () => {
    const result = normalizeVisualRadarAnalysis(
      {
        chineseSummary: " ",
        chineseTitle: "有效标题",
        primaryTopic: "unsupported",
        scoreBreakdown: {},
        selectionRationale: " ",
        trendKeywords: [" 造型 ", "", "造型"],
      },
      {
        analyzedAt: "2026-07-16T02:00:00.000Z",
        contentHash: "sha1:item",
        itemId: "visual-1",
        model: "gpt-test",
      }
    );

    expect(result.chineseSummary).toBeNull();
    expect(result.primaryTopic).toBe("fashion_culture");
    expect(result.selectionRationale).toBeNull();
    expect(result.trendKeywords).toEqual(["造型"]);
    expect(result.score).toBe(0);
  });
});

describe("getVisualAnalysisCacheKey", () => {
  it("includes the prompt version so prompt changes invalidate old analysis", () => {
    expect(getVisualAnalysisCacheKey("sha1:item")).toBe(
      `sha1:item:${VISUAL_ANALYSIS_PROMPT_VERSION}`
    );
  });
});
