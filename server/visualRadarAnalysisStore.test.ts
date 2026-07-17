import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type {
  VisualRadarAnalysis,
  VisualRadarAnalysisFailure,
} from "./visualRadarAnalysis";
import {
  mergeVisualRadarAnalysisArtifact,
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifactAtomic,
} from "./visualRadarAnalysisStore";

const analysis: VisualRadarAnalysis = {
  analyzedAt: "2026-07-16T02:00:00.000Z",
  chineseSummary: "中文摘要",
  chineseTitle: "中文标题",
  contentHash: "sha1:item",
  itemId: "visual-1",
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
  selectionRationale: "值得关注",
  status: "success",
  trendKeywords: ["摄影"],
};

const failure: VisualRadarAnalysisFailure = {
  analyzedAt: "2026-07-16T02:05:00.000Z",
  contentHash: "sha1:item",
  error: "temporary provider failure",
  itemId: "visual-1",
  model: "gpt-test",
  promptVersion: "visual-daily-v1",
  status: "failed",
};

describe("visualRadarAnalysisStore", () => {
  it("persists and reads a versioned analysis artifact", () => {
    const filePath = tempFile();
    writeVisualRadarAnalysisArtifact(filePath, {
      analyses: [analysis],
      failures: [],
      generatedAt: analysis.analyzedAt,
      promptVersion: analysis.promptVersion,
    });

    expect(readVisualRadarAnalysisArtifact(filePath)).toMatchObject({
      analyses: [{ itemId: "visual-1", score: 80 }],
      failures: [],
      promptVersion: "visual-daily-v1",
    });
  });

  it("does not replace a successful cached analysis with a later failure", () => {
    const merged = mergeVisualRadarAnalysisArtifact(
      {
        analyses: [analysis],
        failures: [],
        generatedAt: analysis.analyzedAt,
        promptVersion: analysis.promptVersion,
      },
      {
        analyses: [],
        failures: [failure],
        generatedAt: failure.analyzedAt,
        promptVersion: failure.promptVersion,
      }
    );

    expect(merged.analyses).toEqual([analysis]);
    expect(merged.failures).toEqual([]);
  });

  it("atomically replaces an existing analysis artifact", () => {
    const filePath = tempFile();
    writeVisualRadarAnalysisArtifact(filePath, {
      analyses: [],
      failures: [],
      generatedAt: "2026-07-16T01:00:00.000Z",
      promptVersion: "visual-daily-v1",
    });

    writeVisualRadarAnalysisArtifactAtomic(filePath, {
      analyses: [analysis],
      failures: [],
      generatedAt: analysis.analyzedAt,
      promptVersion: analysis.promptVersion,
    });

    expect(readVisualRadarAnalysisArtifact(filePath).analyses).toEqual([analysis]);
    expect(fs.readdirSync(path.dirname(filePath))).toEqual(["analysis.json"]);
  });

  it("preserves the old artifact and cleans up when atomic replacement fails", () => {
    const filePath = tempFile();
    const original = {
      analyses: [],
      failures: [],
      generatedAt: "2026-07-16T01:00:00.000Z",
      promptVersion: "visual-daily-v1",
    };
    writeVisualRadarAnalysisArtifact(filePath, original);
    const rename = vi
      .spyOn(fs, "renameSync")
      .mockImplementationOnce(() => {
        throw new Error("rename failed");
      });

    try {
      expect(() =>
        writeVisualRadarAnalysisArtifactAtomic(filePath, {
          ...original,
          analyses: [analysis],
        })
      ).toThrow("rename failed");
    } finally {
      rename.mockRestore();
    }

    expect(readVisualRadarAnalysisArtifact(filePath)).toEqual(original);
    expect(fs.readdirSync(path.dirname(filePath))).toEqual(["analysis.json"]);
  });
});

function tempFile() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-analysis-")),
    "analysis.json"
  );
}
