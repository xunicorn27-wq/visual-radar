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
  type VisualRadarIssue,
} from "./visualRadarIssue";
import {
  type VisualRadarStaticSiteFileSystem,
  writeVisualRadarStaticSite,
} from "./visualRadarStaticSite";

describe("writeVisualRadarStaticSite", () => {
  it("writes one consistent snapshot after listing issues exactly once", () => {
    const root = tempDir("visual-radar-static-");
    const archivePath = path.join(root, "issues-source.json");
    const outputDir = path.join(root, "public-data");
    const sourceStore = createVisualRadarIssueStore(archivePath);
    const older = buildIssue("older", "2026-07-15T08:00:00.000Z");
    const newer = buildIssue("newer", "2026-07-16T08:00:00.000Z");
    sourceStore.saveIssue(older);
    sourceStore.saveIssue(newer);
    const snapshot = sourceStore.listIssues();
    const sourceBefore = fs.readFileSync(archivePath);
    let listCalls = 0;

    const result = writeVisualRadarStaticSite({
      issueStore: {
        listIssues() {
          listCalls += 1;
          return snapshot;
        },
      },
      now: "2026-07-17T01:02:03.000Z",
      outputDir,
    });

    expect(listCalls).toBe(1);
    expect(result).toEqual({ issues: 2, latestIssueId: "2026-07-16" });
    const index = readJson(path.join(outputDir, "issues", "index.json")) as Array<{
      id: string;
      storyCount: number;
      topStories: string[];
    }>;
    expect(index).toEqual([
      {
        generatedAt: "2026-07-16T08:00:00.000Z",
        id: "2026-07-16",
        issueDate: "2026-07-16",
        storyCount: 1,
        title: "Visual Radar Daily — 2026.07.16",
        topStories: ["Chinese title newer"],
      },
      {
        generatedAt: "2026-07-15T08:00:00.000Z",
        id: "2026-07-15",
        issueDate: "2026-07-15",
        storyCount: 1,
        title: "Visual Radar Daily — 2026.07.15",
        topStories: ["Chinese title older"],
      },
    ]);
    const newerDetail = readJson(
      path.join(outputDir, "issues", "2026-07-16.json")
    ) as IssueDetail;
    const olderDetail = readJson(
      path.join(outputDir, "issues", "2026-07-15.json")
    ) as IssueDetail;
    expect(newerDetail).toEqual({
      issue: {
        featuredStoryIds: ["newer"],
        generatedAt: "2026-07-16T08:00:00.000Z",
        id: "2026-07-16",
        issueDate: "2026-07-16",
        metadata: {
          models: ["gpt-test"],
          promptVersion: "visual-daily-v1",
        },
        skipped: [],
        stats: {
          bySource: { "Source newer": 1 },
          byTopic: { photography: 1 },
          storyCount: 1,
        },
        stories: [
          {
            analysis: {
              analyzedAt: "2026-07-16T07:30:00.000Z",
              chineseSummary: "Summary newer",
              chineseTitle: "Chinese title newer",
              contentHash: "sha1:newer",
              itemId: "newer",
              model: "gpt-test",
              primaryTopic: "photography",
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
            item: {
              capturedAt: "2026-07-16T07:00:00.000Z",
              contentHash: "sha1:newer",
              dedupKey: "example.com/newer",
              hashtags: [],
              id: "newer",
              interpretation: null,
              keywords: ["photography"],
              lang: "en",
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
              provenance: {
                authenticity: "live",
                collector: "visual-radar-rss",
                evidenceUrl: "https://example.com/newer/feed",
                label: "real collection",
              },
              schemaVersion: "1",
              signalType: "inspiration_signal",
              source: "website",
              sourceAccount: "Source newer",
              sourceType: "inspiration",
              sourceUrl: "https://example.com/newer",
              text: "Summary newer",
              thumbnailUrl: null,
              tier: null,
              title: "Title newer",
              viviaScore: null,
            },
            window: "24h",
          },
        ],
        title: "Visual Radar Daily — 2026.07.16",
      },
      navigation: { nextId: null, previousId: "2026-07-15" },
    });
    expect(olderDetail).toMatchObject({
      issue: { id: "2026-07-15", stats: { storyCount: 1 } },
      navigation: { nextId: "2026-07-16", previousId: null },
    });
    expect(newerDetail.issue.stories.map((story) => story.item.id)).toEqual(["newer"]);
    expect(index[0].id).toBe(newerDetail.issue.id);
    expect(index[0].storyCount).toBe(newerDetail.issue.stories.length);
    expect(index[0].topStories[0]).toBe(
      newerDetail.issue.stories[0].analysis.chineseTitle
    );
    expect(readJson(path.join(outputDir, "site.json"))).toEqual({
      generatedAt: "2026-07-17T01:02:03.000Z",
      latestIssueId: "2026-07-16",
    });
    expect(fs.readFileSync(path.join(outputDir, "site.json"), "utf-8")).toMatch(/\n$/);
    expect(fs.readFileSync(archivePath)).toEqual(sourceBefore);
  });

  it("writes an empty site with no latest issue", () => {
    const root = tempDir("visual-radar-static-empty-");
    const outputDir = path.join(root, "public-data");

    expect(
      writeVisualRadarStaticSite({
        issueStore: { listIssues: () => [] },
        now: "2026-07-17T01:02:03.000Z",
        outputDir,
      })
    ).toEqual({ issues: 0, latestIssueId: null });
    expect(readJson(path.join(outputDir, "issues", "index.json"))).toEqual([]);
    expect(readJson(path.join(outputDir, "site.json"))).toEqual({
      generatedAt: "2026-07-17T01:02:03.000Z",
      latestIssueId: null,
    });
  });

  it("rejects an unsafe issue id before it can write outside the issues directory", () => {
    const root = tempDir("visual-radar-static-path-");
    const outputDir = path.join(root, "public-data");
    const unsafe = {
      ...buildIssue("unsafe", "2026-07-16T08:00:00.000Z"),
      id: "../../escape",
    };

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: { listIssues: () => [unsafe] },
        outputDir,
      })
    ).toThrow('Invalid Visual Radar issue id: "../../escape"');
    expect(fs.existsSync(path.join(root, "escape.json"))).toBe(false);
    expect(fs.existsSync(outputDir)).toBe(false);
  });

  it.each(["2026-99-99", "2026-02-30"])(
    "rejects invalid calendar issue id %s",
    (issueId) => {
      const root = tempDir("visual-radar-static-date-");
      const outputDir = path.join(root, "public-data");
      const invalid = {
        ...buildIssue("invalid", "2026-07-16T08:00:00.000Z"),
        id: issueId,
      };

      expect(() =>
        writeVisualRadarStaticSite({
          issueStore: { listIssues: () => [invalid] },
          outputDir,
        })
      ).toThrow(`Invalid Visual Radar issue id: ${JSON.stringify(issueId)}`);
      expect(fs.existsSync(outputDir)).toBe(false);
    }
  );

  it("removes only stale directories with the output-specific temp prefix", () => {
    const root = tempDir("visual-radar-static-stale-");
    const outputDir = path.join(root, "public-data");
    const staleDir = path.join(root, ".public-data-tmp-abandoned");
    const similarDir = path.join(root, ".public-data-tmp");
    const otherDir = path.join(root, ".other-output-tmp-abandoned");
    const matchingFile = path.join(root, ".public-data-tmp-file");
    fs.mkdirSync(staleDir);
    fs.mkdirSync(similarDir);
    fs.mkdirSync(otherDir);
    fs.writeFileSync(matchingFile, "not a directory\n", "utf-8");

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: {
          listIssues: () => {
            throw new Error("stop after stale cleanup");
          },
        },
        outputDir,
      })
    ).toThrow("stop after stale cleanup");
    expect(fs.existsSync(staleDir)).toBe(false);
    expect(fs.existsSync(similarDir)).toBe(true);
    expect(fs.existsSync(otherDir)).toBe(true);
    expect(fs.existsSync(matchingFile)).toBe(true);
  });

  it("fails clearly before publishing when stale temp cleanup fails", () => {
    const root = tempDir("visual-radar-static-stale-error-");
    const outputDir = path.join(root, "public-data");
    const backupDir = path.join(root, ".public-data.backup");
    const staleDir = path.join(root, ".public-data-tmp-abandoned");
    fs.mkdirSync(backupDir);
    fs.mkdirSync(staleDir);
    fs.writeFileSync(path.join(backupDir, "existing.txt"), "old\n", "utf-8");
    let listCalls = 0;
    const fileSystem = createFileSystem({
      rmSync(target, options) {
        if (path.resolve(String(target)) === staleDir) {
          throw new Error("permission denied");
        }
        fs.rmSync(target, options);
      },
    });

    expect(() =>
      writeVisualRadarStaticSite({
        fileSystem,
        issueStore: {
          listIssues: () => {
            listCalls += 1;
            return [];
          },
        },
        outputDir,
      })
    ).toThrow(`Failed to clean stale Visual Radar temp directory: ${staleDir}`);
    expect(listCalls).toBe(0);
    expect(fs.readFileSync(path.join(outputDir, "existing.txt"), "utf-8")).toBe("old\n");
    expect(fs.existsSync(backupDir)).toBe(false);
  });

  it("keeps existing output and removes temporary files when snapshot creation fails", () => {
    const root = tempDir("visual-radar-static-error-");
    const outputDir = path.join(root, "public-data");
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, "existing.txt"), "keep me\n", "utf-8");

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: {
          listIssues: () => {
            throw new Error("read failed");
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

  it("restores old output and preserves the publish error when the second rename fails", () => {
    const root = tempDir("visual-radar-static-rename-");
    const outputDir = path.join(root, "public-data");
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, "existing.txt"), "old\n", "utf-8");
    const publishError = new Error("publish rename failed");
    let renameCalls = 0;
    const fileSystem = createFileSystem({
      renameSync(source, destination) {
        renameCalls += 1;
        if (renameCalls === 2) throw publishError;
        fs.renameSync(source, destination);
      },
    });

    expect(() =>
      writeVisualRadarStaticSite({
        fileSystem,
        issueStore: { listIssues: () => [buildIssue("new", "2026-07-16T08:00:00.000Z")] },
        outputDir,
      })
    ).toThrow(publishError);
    expect(renameCalls).toBe(3);
    expect(fs.readFileSync(path.join(outputDir, "existing.txt"), "utf-8")).toBe("old\n");
    expect(fs.readdirSync(root)).toEqual(["public-data"]);
  });

  it("reports a successful publish even when old-output cleanup fails", () => {
    const root = tempDir("visual-radar-static-cleanup-");
    const outputDir = path.join(root, "public-data");
    const backupDir = path.join(root, ".public-data.backup");
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, "existing.txt"), "old\n", "utf-8");
    const fileSystem = createFileSystem({
      rmSync(target, options) {
        if (path.resolve(String(target)) === backupDir) {
          throw new Error("cleanup failed");
        }
        fs.rmSync(target, options);
      },
    });

    expect(
      writeVisualRadarStaticSite({
        fileSystem,
        issueStore: { listIssues: () => [buildIssue("new", "2026-07-16T08:00:00.000Z")] },
        outputDir,
      })
    ).toEqual({ issues: 1, latestIssueId: "2026-07-16" });
    expect(fs.existsSync(path.join(outputDir, "site.json"))).toBe(true);
    expect(fs.readFileSync(path.join(backupDir, "existing.txt"), "utf-8")).toBe("old\n");

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: {
          listIssues: () => {
            throw new Error("stop after cleanup");
          },
        },
        outputDir,
      })
    ).toThrow("stop after cleanup");
    expect(fs.existsSync(backupDir)).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "site.json"))).toBe(true);
  });

  it("restores a leftover backup before reading the next snapshot", () => {
    const root = tempDir("visual-radar-static-recovery-");
    const outputDir = path.join(root, "public-data");
    const backupDir = path.join(root, ".public-data.backup");
    fs.mkdirSync(backupDir);
    fs.writeFileSync(path.join(backupDir, "existing.txt"), "recover me\n", "utf-8");

    expect(() =>
      writeVisualRadarStaticSite({
        issueStore: {
          listIssues: () => {
            throw new Error("stop after recovery");
          },
        },
        outputDir,
      })
    ).toThrow("stop after recovery");
    expect(fs.readFileSync(path.join(outputDir, "existing.txt"), "utf-8")).toBe(
      "recover me\n"
    );
    expect(fs.existsSync(backupDir)).toBe(false);
  });
});

interface IssueDetail {
  issue: VisualRadarIssue;
  navigation: { nextId: string | null; previousId: string | null };
}

function createFileSystem(
  overrides: Partial<VisualRadarStaticSiteFileSystem>
): VisualRadarStaticSiteFileSystem {
  return {
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync,
    mkdtempSync: fs.mkdtempSync,
    readdirSync: fs.readdirSync,
    renameSync: fs.renameSync,
    rmSync: fs.rmSync,
    writeFileSync: fs.writeFileSync,
    ...overrides,
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildIssue(id: string, generatedAt: string) {
  return createVisualRadarIssue(
    { selected: [buildSelected(id)], skipped: [] },
    { existingIds: [], now: generatedAt }
  );
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
