import fs from "node:fs";
import { describe, expect, it } from "vitest";

import type { VisualRadarIssue } from "../server/visualRadarIssue";
import { previewWeComIssue } from "./preview-wecom";

describe("previewWeComIssue", () => {
  it("builds Markdown from a local issue without requiring CRON_SECRET", () => {
    expect(
      previewWeComIssue({
        getIssue: () => issue(),
        issueId: "2026-07-16",
        publicUrl: "https://pages.example.test/visual-radar/",
      })
    ).toEqual({
      markdown: expect.stringContaining(
        "https://pages.example.test/visual-radar/issues/2026-07-16"
      ),
      sent: false,
    });
  });

  it("rejects an issue that is not in the local archive", () => {
    expect(() =>
      previewWeComIssue({
        getIssue: () => null,
        issueId: "2026-07-16",
        publicUrl: "https://pages.example.test/visual-radar",
      })
    ).toThrow("Visual Radar issue not found: 2026-07-16");
  });

  it.each(["2026-02-30", "2026-7-16", "../2026-07-16", ""])(
    "rejects invalid issue id %s",
    (issueId) => {
      expect(() =>
        previewWeComIssue({
          getIssue: () => issue(),
          issueId,
          publicUrl: "https://pages.example.test/visual-radar",
        })
      ).toThrow("Issue ID must be a real YYYY-MM-DD date");
    }
  );

  it.each(["", "not-a-url", "ftp://pages.example.test/visual-radar"])(
    "rejects invalid Pages URL %s",
    (publicUrl) => {
      expect(() =>
        previewWeComIssue({
          getIssue: () => issue(),
          issueId: "2026-07-16",
          publicUrl,
        })
      ).toThrow("VISUAL_RADAR_PUBLIC_URL must be a valid HTTP or HTTPS URL");
    }
  );

  it("contains no network or enterprise WeCom secret path", () => {
    const source = fs.readFileSync(
      new URL("./preview-wecom.ts", import.meta.url),
      "utf-8"
    );

    expect(source).toContain("loadProjectEnv");
    expect(source).toContain("resolveProjectPaths");
    expect(source).toContain("createVisualRadarIssueStore");
    expect(source).not.toMatch(/\bfetch\b/);
    expect(source).not.toContain("CRON_SECRET");
    expect(source).not.toContain("WECOM_BOT_WEBHOOK");
    expect(source).not.toContain("sendVisualRadarIssueToWeCom");
  });
});

function issue(): VisualRadarIssue {
  return {
    featuredStoryIds: [],
    generatedAt: "2026-07-16T08:00:00.000Z",
    id: "2026-07-16",
    issueDate: "2026-07-16",
    metadata: { models: ["codex-agent"], promptVersion: "visual-daily-v1" },
    skipped: [],
    stats: { bySource: {}, byTopic: {}, storyCount: 0 },
    stories: [],
    title: "Visual Radar Daily — 2026.07.16",
  };
}
