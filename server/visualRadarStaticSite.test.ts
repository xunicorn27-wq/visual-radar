import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import type { VisualRadarAnalysis } from "./visualRadarAnalysis";
import type { VisualRadarSelectedStory } from "./visualRadarDailySelector";
import {
  createVisualRadarIssue,
  createVisualRadarIssueStore,
  summarizeVisualRadarIssue,
} from "./visualRadarIssue";
import { writeVisualRadarStaticSite } from "./visualRadarStaticSite";
import { getVisualRadarIssueDetail } from "./visualRadarWorkflow";

describe("writeVisualRadarStaticSite", () => {
  it("writes summary, detail, and site JSON without changing the issue archive", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-static-"));
    const archivePath = path.join(root, "issues-source.json");
    const outputDir = path.join(root, "public-data");
    const issueStore = createVisualRadarIssueStore(archivePath);
    const older = createVisualRadarIssue(
      { selected: [buildSelected("older")], skipped: [] },
      { existingIds: [], now: "2026-07-15T08:00:00.000Z" }
    );
    const newer = createVisualRadarIssue(
      { selected: [buildSelected("newer")], skipped: [] },
      { existingIds: [older.id], now: "2026-07-16T08:00:00.000Z" }
    );
    issueStore.saveIssue(older);
    issueStore.saveIssue(newer);
    const sourceBefore = fs.readFileSync(archivePath);

    const result = writeVisualRadarStaticSite({
      issueStore,
      now: "2026-07-17T01:02:03.000Z",
      outputDir,
    });

    expect(result).toEqual({ issueCount: 2, latestIssueId: newer.id });
    expect(readJson(path.join(outputDir, "issues", "index.json"))).toEqual(
      issueStore.listIssues().map(summarizeVisualRadarIssue)
    );
    expect(readJson(path.join(outputDir, "issues", `${newer.id}.json`))).toEqual(
      getVisualRadarIssueDetail(issueStore, newer.id)
    );
    expect(readJson(path.join(outputDir, "issues", `${older.id}.json`))).toEqual(
      getVisualRadarIssueDetail(issueStore, older.id)
    );
    expect(readJson(path.join(outputDir, "issues", `${newer.id}.json`))).toMatchObject({
      navigation: { nextId: null, previousId: older.id },
    });
    expect(readJson(path.join(outputDir, "issues", `${older.id}.json`))).toMatchObject({
      navigation: { nextId: newer.id, previousId: null },
    });
    expect(readJson(path.join(outputDir, "site.json"))).toEqual({
      generatedAt: "2026-07-17T01:02:03.000Z",
      latestIssueId: newer.id,
    });
    expect(fs.readFileSync(path.join(outputDir, "site.json"), "utf-8")).toMatch(/\n$/);
    expect(fs.readFileSync(archivePath)).toEqual(sourceBefore);
  });

  it("writes an empty site with no latest issue", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-static-empty-"));
    const archivePath = path.join(root, "issues-source.json");
    const outputDir = path.join(root, "public-data");
    const issueStore = createVisualRadarIssueStore(archivePath);

    expect(
      writeVisualRadarStaticSite({
        issueStore,
        now: "2026-07-17T01:02:03.000Z",
        outputDir,
      })
    ).toEqual({ issueCount: 0, latestIssueId: null });
    expect(readJson(path.join(outputDir, "issues", "index.json"))).toEqual([]);
    expect(readJson(path.join(outputDir, "site.json"))).toEqual({
      generatedAt: "2026-07-17T01:02:03.000Z",
      latestIssueId: null,
    });
  });

  it("keeps existing output and removes temporary files when generation fails", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-static-error-"));
    const outputDir = path.join(root, "public-data");
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, "existing.txt"), "keep me\n", "utf-8");

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: {
          getIssue: () => null,
          listIssues: () => {
            throw new Error("read failed");
          },
          saveIssue: () => {
            throw new Error("unexpected write");
          },
        },
        outputDir,
      })
    ).toThrow("read failed");
    expect(fs.readFileSync(path.join(outputDir, "existing.txt"), "utf-8")).toBe(
      "keep me\n"
    );
    expect(fs.readdirSync(root)).toEqual(["public-data"]);
  });
});

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function buildSelected(
  id: string,
  primaryTopic: VisualRadarAnalysis["primaryTopic"] = "photography"
): VisualRadarSelectedStory {
  const item = createIntelItem({
    capturedAt: "2026-07-16T07:00:00.000Z",
    contentHash: `sha1:${id}`,
    hashtags: [],
    id,
    keywords: [primaryTopic],
    lang: "en",
    market: "EU",
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt: "2026-07-16T06:00:00.000Z",
    provenance: {
      authenticity: "live",
      collector: "visual-radar-rss",
      evidenceUrl: `https://example.com/${id}/feed`,
      label: "real collection",
    },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount: `Source ${id}`,
    sourceType: "inspiration",
    sourceUrl: `https://example.com/${id}`,
    text: `Summary ${id}`,
    thumbnailUrl: null,
    title: `Title ${id}`,
  });
  return {
    analysis: {
      analyzedAt: "2026-07-16T07:30:00.000Z",
      chineseSummary: `Summary ${id}`,
      chineseTitle: `Chinese title ${id}`,
      contentHash: item.contentHash,
      itemId: item.id,
      model: "gpt-test",
      primaryTopic,
      promptVersion: "visual-daily-v1",
      score: 80,
      scoreBreakdown: {
        informationSpecificity: 12,
        novelty: 16,
        professionalRelevance: 16,
        sourceQuality: 8,
        timeliness: 4,
        visualInspiration: 24,
      },
      selectionRationale: "Worth watching",
      status: "success",
      trendKeywords: ["photography"],
    },
    item,
    window: "24h",
  };
}
