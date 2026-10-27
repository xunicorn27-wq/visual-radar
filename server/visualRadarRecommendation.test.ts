import { describe, expect, it } from "vitest";
import { calibrateVisualRadarRecommendation } from "./visualRadarRecommendation";
import type { VisualRadarAnalysis } from "./visualRadarAnalysis";

const base: VisualRadarAnalysis = { itemId: "x", contentHash: "sha1:x", analyzedAt: "2026-10-26T00:00:00Z", model: "codex", promptVersion: "visual-daily-v1", status: "success", chineseTitle: "x", chineseSummary: "x", primaryTopic: "fashion_culture", score: 92, scoreBreakdown: { informationSpecificity: 14, novelty: 18, professionalRelevance: 18, sourceQuality: 8, timeliness: 4, visualInspiration: 30 }, selectionRationale: "x", trendKeywords: ["x"] };
describe("recommendation calibration", () => {
  it.each(["product_roundup", "trend_roundup", "announcement"] as const)("caps %s without changing the original score", (kind) => {
    const analysis: VisualRadarAnalysis = { ...base, editorial: { version: "evidence-v1", status: "verified", sourceUrl: "https://example.com", snapshotHash: "x", facts: [{ statement: "a", quote: "first quote" }, { statement: "b", quote: "second quote" }], visualMethod: "制作方法", application: "编辑建议", visualTags: ["叙事"], limitation: "测试", assessment: { contentKind: kind, methodEvidence: "specific", rationale: "原文具体方法有限" } } };
    expect(calibrateVisualRadarRecommendation(analysis)).toMatchObject({ score: 74, featuredEligible: false });
    analysis.editorial!.assessment!.contentKind = "vendor_case";
    expect(calibrateVisualRadarRecommendation(analysis).score).toBe(84);
    analysis.editorial!.assessment!.methodEvidence = "none";
    expect(calibrateVisualRadarRecommendation(analysis).score).toBe(59);
    expect(analysis.score).toBe(92);
  });
  it("caps announcements and vague methods while preserving legacy scores for read-only history", () => {
    expect(calibrateVisualRadarRecommendation({ ...base, editorial: { version: "evidence-v1", status: "verified", sourceUrl: "https://x", snapshotHash: "x", facts: [{ statement: "x", quote: "evidence" }, { statement: "y", quote: "evidence2" }], visualMethod: "方法", application: "建议", visualTags: ["叙事"], limitation: "x", assessment: { contentKind: "announcement", methodEvidence: "general", rationale: "仅为公告" } } }).score).toBeLessThanOrEqual(74);
    expect(calibrateVisualRadarRecommendation(base).score).toBe(25);
    expect(base.score).toBe(92); // No mutation of legacy scores.
  });
});
