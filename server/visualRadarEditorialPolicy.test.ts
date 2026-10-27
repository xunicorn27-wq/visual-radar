import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { evidenceHash, validateAssessment, validateEvent } from "./visualRadarEvidence";
import { importVisualRadarAgentOutput } from "./visualRadarAgentOutput";
import { createVisualRadarIssueStore } from "./visualRadarIssue";
import { generateVisualRadarIssueFromArtifacts } from "./visualRadarWorkflow";
import { inspectIssueQuality } from "./visualRadarQualityService";

const now = "2026-10-27T02:00:00Z";
const item = createIntelItem({ id: "example", title: "Production study", text: "A lighting experiment", sourceUrl: "https://example.com/story", capturedAt: now, postedAt: now, market: "global", source: "website", sourceType: "inspiration", mediaUrls: [], metrics: emptyIntelMetrics(), signalType: "inspiration_signal", provenance: { authenticity: "live", label: "真实" } });
const text = "The studio used translucent fabric to filter daylight. A second setup used reflective boards to redirect the light.";
const hash = evidenceHash(item.sourceUrl, text);
const snapshot = { url: item.sourceUrl, itemId: item.id, contentHash: item.contentHash, text, fetchedAt: now, hash };
const editorial = { version: "evidence-v1", status: "verified", sourceUrl: item.sourceUrl, snapshotHash: hash,
  facts: [{ statement: "透光布过滤日光", quote: "translucent fabric to filter daylight" }, { statement: "反射板改变光线方向", quote: "reflective boards to redirect the light" }],
  visualMethod: "通过不同材料改变光线方向", application: "用自有布料做小样对比", visualTags: ["布光"], limitation: "未实地测试",
  assessment: { contentKind: "production_case", methodEvidence: "specific", rationale: "正文提供两种实际布光方法" }, event: { key: "studio-light-study-2026", label: "布光研究" } };
const output = { schemaVersion: "1", model: "codex-agent", promptVersion: "visual-daily-v1", generatedAt: now, analyses: [{ itemId: item.id, contentHash: item.contentHash, chineseTitle: "布光研究", chineseSummary: "原文介绍两种布光研究", primaryTopic: "photography", scoreBreakdown: { informationSpecificity: 14, novelty: 16, professionalRelevance: 18, sourceQuality: 8, timeliness: 5, visualInspiration: 25 }, selectionRationale: "方法具体且有原文依据", trendKeywords: ["布光"], editorial }] };
const batch = { stage: "value_screening", status: "prepared", qualityPolicy: "evidence-v1", selectionPolicy: "editorial-v2", candidates: [{ ...item, sourceEvidence: { status: "ready", snapshotHash: hash } }] };
const current = { analyses: [], failures: [], generatedAt: now, promptVersion: "visual-daily-v1" };
const runImport = (value = output) => importVisualRadarAgentOutput({ batch, output: value, current, loadSnapshot: () => snapshot });

describe("editorial-v2 contract and persistence", () => {
  it("requires structured judgments, validates developments and projects away unknown fields", () => {
    const result = runImport();
    expect(result.artifact.analyses[0].editorial?.assessment).toEqual(editorial.assessment);
    expect(result.artifact.analyses[0].editorial?.event?.key).toBe(editorial.event.key);
    const missing = structuredClone(output); delete (missing.analyses[0].editorial as Partial<typeof editorial>).assessment;
    expect(() => runImport(missing)).toThrow("新批次");
    expect(() => validateAssessment({ ...editorial.assessment, contentKind: "invented" })).toThrow();
    for (const factIndexes of [[], [-1], [2], [0, 0], [0.5]]) expect(() => validateEvent({ ...editorial.event, development: { summary: "这里提供了新的制作证据", factIndexes } }, 2)).toThrow();
    expect(validateEvent({ ...editorial.event, injected: "omit", development: { summary: "这里提供了新的制作证据", factIndexes: [1], ignored: true } }, 2)).toEqual({ ...editorial.event, development: { summary: "这里提供了新的制作证据", factIndexes: [1] } });
  });
  it("persists only the chosen featured items, including after a reload and static-data read", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-policy-"));
    const store = createVisualRadarIssueStore(path.join(dir, "issues.json"));
    const analysis = runImport().artifact;
    const other = { ...item, id: "announcement", contentHash: "sha1:announcement", sourceUrl: "https://example.com/announcement" };
    const ref = structuredClone(analysis.analyses[0]);
    ref.itemId = other.id; ref.contentHash = other.contentHash;
    ref.editorial!.sourceUrl = other.sourceUrl; ref.editorial!.assessment!.contentKind = "announcement"; ref.editorial!.event!.key = "other-announcement";
    const generated = generateVisualRadarIssueFromArtifacts({ issueStore: store, analysisArtifact: { ...analysis, analyses: [...analysis.analyses, ref] }, itemsArtifact: { schemaVersion: "1", generatedAt: now, failures: [], items: [item, other] }, now });
    expect(generated.stories).toHaveLength(2); expect(generated.featuredStoryIds).toEqual([item.id]);
    expect(store.getIssue(generated.id)?.featuredStoryIds).toEqual([item.id]);
    expect(store.listIssues()[0].featuredStoryIds).toEqual([item.id]);
  });
  it("blocks generation before writing when evidence is missing and leaves the archive unchanged", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-policy-"));
    const file = path.join(dir, "issues.json"), store = createVisualRadarIssueStore(file);
    const analysis = runImport().artifact;
    generateVisualRadarIssueFromArtifacts({ issueStore: store, analysisArtifact: analysis, itemsArtifact: { schemaVersion: "1", generatedAt: now, failures: [], items: [item] }, now });
    const before = fs.readFileSync(file, "utf8");
    analysis.analyses[0].editorial!.sourceUrl = "https://example.com/wrong";
    expect(() => generateVisualRadarIssueFromArtifacts({ issueStore: store, analysisArtifact: analysis, itemsArtifact: { schemaVersion: "1", generatedAt: now, failures: [], items: [item] }, now })).toThrow("质量检查");
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });
  it("quality reports are read-only and use the published snapshot instead of newer analysis", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-quality-")); fs.mkdirSync(path.join(dir, "data"));
    const store = createVisualRadarIssueStore(path.join(dir, "data/visual_radar_issues.json"));
    const generated = generateVisualRadarIssueFromArtifacts({ issueStore: store, analysisArtifact: runImport().artifact, itemsArtifact: { schemaVersion: "1", generatedAt: now, failures: [], items: [item] }, now });
    fs.writeFileSync(path.join(dir, "data/visual_radar_items.json"), JSON.stringify({ schemaVersion: "1", generatedAt: now, failures: [], items: [item], attemptedSourceIds: [] }));
    const before = fs.readdirSync(path.join(dir, "data"));
    const report = inspectIssueQuality(dir, generated, now);
    expect(report.canPublish).toBe(true); expect(report.evidence.verified).toBe(1);
    expect(fs.readdirSync(path.join(dir, "data"))).toEqual(before);
  });
});
