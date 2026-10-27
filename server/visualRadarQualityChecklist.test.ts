import { describe, expect, it } from "vitest";
import { buildVisualRadarQualityChecklist, assertPublishableQuality } from "./visualRadarQualityChecklist";
import type { VisualRadarIssue } from "./visualRadarIssue";

const issue = (verified = true): VisualRadarIssue => ({ id: "2026-10-27", issueDate: "2026-10-27", generatedAt: "2026-10-27T01:00:00Z", featuredStoryIds: ["x"], skipped: [], title: "test", metadata: { models: ["codex"], promptVersion: "visual-daily-v1", selectionPolicy: "editorial-v2" }, stats: { storyCount: 1, bySource: {}, byTopic: {} }, stories: [{ item: { id: "x", contentHash: "sha1:x", title: "x", text: "x", sourceUrl: "https://example.com/x", sourceAccount: "Test", provenance: { authenticity: "live", label: "live" }, thumbnailUrl: null, postedAt: null, capturedAt: "2026-10-27T00:00:00Z" } as any, analysis: { itemId: "x", contentHash: "sha1:x", analyzedAt: "2026-10-27T00:00:00Z", model: "codex", promptVersion: "visual-daily-v1", status: "success", chineseTitle: "x", chineseSummary: "x", primaryTopic: "photography", score: 80, scoreBreakdown: { informationSpecificity: 12, novelty: 16, professionalRelevance: 16, sourceQuality: 8, timeliness: 4, visualInspiration: 24 }, selectionRationale: "x", trendKeywords: ["x"], editorial: verified ? { version: "evidence-v1", status: "verified", sourceUrl: "https://example.com/x", snapshotHash: "hash", facts: [{ statement: "x", quote: "evidence" }], visualMethod: "x", application: "x", visualTags: ["叙事"], limitation: "x", assessment: { contentKind: "production_case", methodEvidence: "specific", rationale: "原文提供了明确的制作方法" }, event: { key: "event-test", label: "test event" } } : undefined }, window: "24h" } as any] });

describe("quality checklist", () => {
  it("flags cross-edition Prada coverage even when a rolling article has a newer metadata date", () => {
    const today = issue(true); today.stories[0].item.title = "Barry Jenkins on directing Prada";
    const previous = structuredClone(today); previous.id = previous.issueDate = "2026-10-26";
    previous.stories[0].item.id = "previous"; previous.stories[0].item.contentHash = "previous-hash";
    previous.stories[0].item.sourceUrl = "https://another.example/rolling";
    previous.stories[0].item.title = "Barry Jenkins directs Prada campaign";
    previous.stories[0].item.postedAt = "2027-01-01";
    delete previous.stories[0].analysis.editorial!.event;
    delete today.stories[0].analysis.editorial!.event;
    const report = buildVisualRadarQualityChecklist({ issue: today, history: [previous] });
    expect(report.duplicates).toContainEqual({ itemId: "x", otherItemId: "previous", otherIssueId: previous.id, confidence: "possible" });
    expect(report.blockers.map(b => b.code)).not.toContain("previous_event");
  });
  it("blocks invalid dates, links, hashes, duplicate events and weak featured stories", () => {
    const broken = issue(true);
    broken.stories[0].item.eventStartsAt = "2026-12-01"; broken.stories[0].item.eventEndsAt = "2026-11-01";
    broken.stories[0].item.sourceUrl = "javascript:alert(1)";
    broken.stories[0].analysis.contentHash = "wrong";
    broken.stories[0].analysis.editorial!.assessment!.contentKind = "product_roundup";
    broken.stories.push(structuredClone(broken.stories[0]));
    const codes = buildVisualRadarQualityChecklist({ issue: broken }).blockers.map(b => b.code);
    for (const code of ["invalid_date", "invalid_link", "unverified", "weak_featured", "duplicate_id", "duplicate_event"]) expect(codes).toContain(code);
  });
  it("reports missing images and unknown dates as warnings without changing the issue", () => {
    const original = issue(true); const before = JSON.stringify(original);
    const report = buildVisualRadarQualityChecklist({ issue: original });
    expect(report.canPublish).toBe(true);
    expect(report.warnings.map(w => w.code)).toContain("unknown_date");
    expect(report.warnings.map(w => w.code)).toContain("missing_image");
    expect(JSON.stringify(original)).toBe(before);
  });
  it("separates historical source coverage from today's health", () => {
    const health = { generatedAt: "2026-10-23T01:00:00Z", sources: [], summary: { attempted: 3, healthy: 0, failed: 3, empty: 0, coreHealthy: 0, coreTotal: 3, alerts: [] } };
    const report = buildVisualRadarQualityChecklist({ issue: issue(true), health, now: "2026-10-27T02:00:00Z" });
    expect(report.sourceCoverage).toMatchObject({ checkedAt: health.generatedAt, appliesToIssue: false, attempted: 3 });
    expect(report.warnings.map(w => w.code)).toContain("core_sources");
    expect(report.canPublish).toBe(true);
  });
  it("separates blockers from warnings and reports score bands", () => {
    const report = buildVisualRadarQualityChecklist({ issue: issue(false), now: "2026-10-27T02:00:00Z" });
    expect(report.canPublish).toBe(false); expect(report.blockers.some(e => e.code === "unverified")).toBe(true); expect(report.warnings.some(e => e.code === "missing_image")).toBe(true); expect(report.scoreDistribution).toBeDefined();
    expect(() => assertPublishableQuality(report)).toThrow("质量检查未通过");
  });
  it("does not treat heuristic event overlap as a blocker", () => {
    const valid = issue(true); valid.stories[0].analysis.score = 80;
    valid.stories[0].analysis.scoreBreakdown.visualInspiration = 24;
    const report = buildVisualRadarQualityChecklist({ issue: valid, now: "2026-10-27T02:00:00Z" });
    expect(report.blockers).toEqual([]); expect(report.warnings.some(e => e.code === "health_not_current")).toBe(true);
  });
});
