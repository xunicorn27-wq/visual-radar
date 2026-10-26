import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectRecovery as inspectAtTime } from "./visualRadarRecovery";
import { resolveProjectPaths } from "./paths";
import { atomicJson, checkpoint, stableHash } from "./visualRadarRunStore";
import { createVisualRadarIssueStore, type VisualRadarIssue } from "./visualRadarIssue";
import { buildReviewQueue } from "./visualRadarReviewQueue";
const inspectRecovery = (files: ReturnType<typeof resolveProjectPaths>, id: string) => inspectAtTime(files, id, "2026-10-26T03:00:00Z");

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "radar-recovery-"));
  const files = resolveProjectPaths(directory);
  const issue: VisualRadarIssue = { id: "2026-10-26", issueDate: "2026-10-26", generatedAt: "2026-10-26T02:00:00Z", featuredStoryIds: [], stories: [], skipped: [], title: "Test", metadata: { models: [], promptVersion: "test" }, stats: { storyCount: 0, bySource: {}, byTopic: {} } };
  const items = { items: [], generatedAt: issue.generatedAt }; const batch = { candidates: [], generatedAt: issue.generatedAt }; const analysis = { analyses: [] };
  return { files, issue, items, batch, analysis };
}
describe("fingerprint-based recovery", () => {
  it("requires manual confirmation for a legacy issue without delivery history", () => {
    const { files, issue } = fixture(); createVisualRadarIssueStore(files.issues).saveIssue(issue);
    expect(inspectAtTime(files, issue.id, "2026-10-27T03:00:00Z")).toMatchObject({ next: "manual-check", legacyReceiptMissing: true });
  });
  it("resumes the first incomplete step and does not trust stale local artifacts", () => {
    const { files, issue, items, batch, analysis } = fixture();
    expect(inspectRecovery(files, issue.id).next).toBe("collect");
    atomicJson(files.items, items); checkpoint(files.runs, issue.id, "collected", stableHash(items));
    expect(inspectRecovery(files, issue.id).next).toBe("prepare");
    atomicJson(files.agentBatch, batch); checkpoint(files.runs, issue.id, "prepared", stableHash(batch));
    expect(inspectRecovery(files, issue.id).next).toBe("agent-import");
    atomicJson(files.analysis, analysis); checkpoint(files.runs, issue.id, "imported", stableHash({ batch, analysis }));
    expect(inspectRecovery(files, issue.id).next).toBe("generate");
    createVisualRadarIssueStore(files.issues).saveIssue(issue); checkpoint(files.runs, issue.id, "generated", stableHash(issue));
    expect(inspectRecovery(files, issue.id).next).toBe("verify-publication");
    atomicJson(files.agentBatch, { ...batch, changed: true });
    expect(inspectRecovery(files, issue.id).next).toBe("prepare");
  });
  it("keeps unknown deliveries blocked and notices changed content after a sent receipt", () => {
    const { files, issue } = fixture(); createVisualRadarIssueStore(files.issues).saveIssue(issue);
    const delivery = { version: 1, issueId: issue.id, issueHash: stableHash(issue), updatedAt: issue.generatedAt, attempts: 1, status: "unknown", history: [] };
    atomicJson(path.join(files.delivery, `${issue.id}.json`), delivery);
    expect(inspectRecovery(files, issue.id).next).toBe("manual-check");
    atomicJson(path.join(files.delivery, `${issue.id}.json`), { ...delivery, status: "sent" });
    expect(inspectRecovery(files, issue.id).next).toBe("complete");
    createVisualRadarIssueStore(files.issues).saveIssue({ ...issue, title: "Corrected" });
    expect(inspectRecovery(files, issue.id).next).toBe("manual-check");
  });
});

describe("historical review queue", () => {
  it("uses the published snapshot, prioritizes featured stories and leaves archives unchanged", () => {
    const issues = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/visual_radar_issues.json"), "utf8")).issues as VisualRadarIssue[];
    const before = JSON.stringify(issues);
    const queue = buildReviewQueue(issues, "2026-10-26T00:00:00Z");
    const total = issues.reduce((sum, issue) => sum + issue.stories.length, 0);
    expect(queue.summary.published).toBe(total);
    expect(queue.summary.pending + queue.summary.verified).toBe(total);
    expect(queue.entries.every((entry) => entry.status === "pending")).toBe(true);
    expect(queue.entries[0].featured).toBe(true);
    expect(queue.entries.some((entry) => entry.issueId === "2026-10-23" && entry.itemId === "visual-id-magazine-1lbis")).toBe(false);
    expect(JSON.stringify(issues)).toBe(before);
  });
});
