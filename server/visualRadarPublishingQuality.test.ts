import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VisualRadarIssue } from "./visualRadarIssue";
import { publishWithRecord } from "./visualRadarPublishingService";
import { sendVisualRadarIssueToWeCom } from "./weComPublisher";

vi.mock("./visualRadarDelivery", async importOriginal => {
  const original = await importOriginal<typeof import("./visualRadarDelivery")>();
  return { ...original, sendIssueOnce: async ({ verify, send }: { verify: () => Promise<void>; send: () => Promise<unknown> }) => { await verify(); return send(); } };
});
vi.mock("./weComPublisher", () => ({ buildWeComMarkdownContent: () => "preview", sendVisualRadarIssueToWeCom: vi.fn() }));

describe("publication quality enforcement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "radar-send-quality-"));
  const issue: VisualRadarIssue = { id: "2026-10-27", issueDate: "2026-10-27", generatedAt: "2026-10-27T01:00:00Z", title: "测试", stories: [], featuredStoryIds: [], skipped: [], metadata: { selectionPolicy: "editorial-v2", models: [], promptVersion: "visual-daily-v1" }, stats: { storyCount: 0, byTopic: {}, bySource: {} } };
  it("blocks before the sender or git/deployment verification when content fails", async () => {
    await expect(publishWithRecord(root, issue, false)).rejects.toThrow("质量检查未通过");
    expect(sendVisualRadarIssueToWeCom).not.toHaveBeenCalled();
  });
  it("keeps preview read-only and refuses to send legacy-policy issues", async () => {
    expect(await publishWithRecord(root, issue, true)).toMatchObject({ sent: false, quality: { canPublish: false } });
    const legacy = structuredClone(issue); delete legacy.metadata.selectionPolicy;
    await expect(publishWithRecord(root, legacy, false)).rejects.toThrow("editorial-v2");
    expect(sendVisualRadarIssueToWeCom).not.toHaveBeenCalled();
  });
});
