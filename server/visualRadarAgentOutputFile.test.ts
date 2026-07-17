import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { VISUAL_ANALYSIS_PROMPT_VERSION } from "./visualRadarAnalysis";
import { importVisualRadarAgentOutputFiles } from "./visualRadarAgentOutputFile";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifact,
} from "./visualRadarAnalysisStore";

const candidate = { contentHash: "sha1:candidate-1", id: "candidate-1" };
const batch = {
  candidates: [candidate],
  generatedAt: "2026-07-17T01:00:00.000Z",
  instructions: [],
  stage: "value_screening",
  status: "prepared",
  summary: { cached: 0, candidates: 1, excluded: 0, total: 1 },
};
const output = {
  analyses: [
    {
      chineseSummary: "这是一条摄影文化摘要。",
      chineseTitle: "摄影文化标题",
      contentHash: candidate.contentHash,
      itemId: candidate.id,
      primaryTopic: "photography",
      scoreBreakdown: {
        informationSpecificity: 0,
        novelty: 0,
        professionalRelevance: 0,
        sourceQuality: 0,
        timeliness: 0,
        visualInspiration: 20,
      },
      selectionRationale: "具有明确的视觉参考价值。",
      trendKeywords: ["摄影", "视觉文化"],
    },
  ],
  generatedAt: "2026-07-17T02:00:00.000Z",
  model: "codex-agent",
  promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
  schemaVersion: "1",
};
const originalArtifact = {
  analyses: [],
  failures: [],
  generatedAt: "2026-07-17T01:00:00.000Z",
  promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
};

describe("importVisualRadarAgentOutputFiles", () => {
  it("does not change the analysis file when validation fails after a valid entry", () => {
    const files = tempFiles();
    writeJson(files.batch, batch);
    writeJson(files.output, {
      ...output,
      analyses: [output.analyses[0], null],
    });
    writeVisualRadarAnalysisArtifact(files.analysis, originalArtifact);
    const before = fs.readFileSync(files.analysis, "utf-8");

    expect(() => importVisualRadarAgentOutputFiles(files)).toThrow(
      "Agent output analysis at index 1 must be an object"
    );

    expect(fs.readFileSync(files.analysis, "utf-8")).toBe(before);
    expect(fs.readdirSync(path.dirname(files.analysis)).sort()).toEqual([
      "analysis.json",
      "batch.json",
      "output.json",
    ]);
  });

  it("atomically writes a validated analysis result", () => {
    const files = tempFiles();
    writeJson(files.batch, batch);
    writeJson(files.output, output);
    writeVisualRadarAnalysisArtifact(files.analysis, originalArtifact);

    const result = importVisualRadarAgentOutputFiles(files);

    expect(result.summary).toEqual({ imported: 1, submitted: 1 });
    expect(readVisualRadarAnalysisArtifact(files.analysis).analyses).toMatchObject([
      {
        contentHash: candidate.contentHash,
        itemId: candidate.id,
        model: "codex-agent",
        score: 20,
      },
    ]);
    expect(fs.readdirSync(path.dirname(files.analysis)).sort()).toEqual([
      "analysis.json",
      "batch.json",
      "output.json",
    ]);
  });
});

function tempFiles() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "visual-radar-agent-import-")
  );
  return {
    analysis: path.join(directory, "analysis.json"),
    batch: path.join(directory, "batch.json"),
    output: path.join(directory, "output.json"),
  };
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
