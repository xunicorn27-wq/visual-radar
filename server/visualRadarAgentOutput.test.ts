import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  normalizeVisualRadarAnalysis,
} from "./visualRadarAnalysis";
import {
  importVisualRadarAgentOutput,
  type VisualRadarAgentOutput,
} from "./visualRadarAgentOutput";

const candidate = createIntelItem({
  capturedAt: "2026-07-17T01:00:00.000Z",
  hashtags: [],
  id: "candidate-1",
  keywords: ["photography"],
  lang: "en",
  market: "global",
  mediaUrls: [],
  metrics: emptyIntelMetrics(),
  postedAt: "2026-07-17T00:30:00.000Z",
  provenance: { authenticity: "live", label: "real collection" },
  signalType: "inspiration_signal",
  source: "website",
  sourceAccount: "Example",
  sourceType: "inspiration",
  sourceUrl: "https://example.com/story",
  text: "A photography story.",
  thumbnailUrl: null,
  title: "Photography story",
});

const batch = {
  candidates: [candidate],
  generatedAt: "2026-07-17T01:00:00.000Z",
  instructions: [],
  stage: "value_screening" as const,
  status: "prepared" as const,
  summary: { cached: 0, candidates: 1, excluded: 0, total: 1 },
};

const existingAnalysis = normalizeVisualRadarAnalysis(
  {
    chineseTitle: "Existing title",
    primaryTopic: "styling",
    scoreBreakdown: { visualInspiration: 10 },
  },
  {
    analyzedAt: "2026-07-16T02:00:00.000Z",
    contentHash: "sha1:existing",
    itemId: "existing-1",
    model: "existing-model",
  }
);

const current = {
  analyses: [existingAnalysis],
  failures: [],
  generatedAt: "2026-07-17T01:00:00.000Z",
  promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
};

const output: VisualRadarAgentOutput = {
  analyses: [
    {
      itemId: candidate.id,
      contentHash: candidate.contentHash,
      chineseSummary: "A photography culture summary.",
      chineseTitle: "Photography culture title",
      primaryTopic: "photography",
      scoreBreakdown: {
        informationSpecificity: 12.4,
        novelty: 16,
        professionalRelevance: 16,
        sourceQuality: 8,
        timeliness: 5,
        visualInspiration: 25,
      },
      selectionRationale: "Clear visual reference value.",
      trendKeywords: [" photography ", "visual culture", "photography"],
    },
  ],
  generatedAt: "2026-07-17T02:00:00.000Z",
  model: "codex-agent",
  promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
  schemaVersion: "1",
};

describe("importVisualRadarAgentOutput", () => {
  it("normalizes and merges analyses for prepared candidates", () => {
    const result = importVisualRadarAgentOutput({ batch, current, output });

    expect(result.summary).toEqual({ imported: 1, submitted: 1 });
    expect(result.artifact.analyses).toHaveLength(2);
    expect(result.artifact.analyses[0]).toBe(existingAnalysis);
    expect(result.artifact.analyses[1]).toMatchObject({
      analyzedAt: output.generatedAt,
      itemId: "candidate-1",
      model: "codex-agent",
      primaryTopic: "photography",
      promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      score: 82,
      status: "success",
      trendKeywords: ["photography", "visual culture"],
    });
    expect(result.artifact).not.toBe(current);
    expect(current.analyses).toEqual([existingAnalysis]);
  });

  it("rejects an item that is not in the prepared batch", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], itemId: "unknown" }],
        },
      })
    ).toThrow("Agent output contains unknown candidate: unknown");
  });

  it("rejects a stale content hash without mutating current data", () => {
    const before = structuredClone(current);

    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [
            { ...output.analyses[0], contentHash: "sha256:stale" },
          ],
        },
      })
    ).toThrow("Agent output content hash mismatch: candidate-1");
    expect(current).toEqual(before);
  });

  it("rejects duplicate item ids", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [output.analyses[0], { ...output.analyses[0] }],
        },
      })
    ).toThrow("Agent output contains duplicate candidate: candidate-1");
  });

  it.each([
    ["schemaVersion", { schemaVersion: "2" }, "Agent output schema is unsupported"],
    [
      "promptVersion",
      { promptVersion: "visual-daily-v0" },
      "Agent output prompt version mismatch",
    ],
    ["model", { model: "gpt-5" }, "Agent output model is unsupported"],
  ])("rejects an invalid runtime %s", (_field, override, message) => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: { ...output, ...override } as VisualRadarAgentOutput,
      })
    ).toThrow(message);
  });

  it("rejects a non-object output with a domain error", () => {
    expect(() =>
      importVisualRadarAgentOutput({ batch, current, output: null })
    ).toThrow("Agent output must be an object");
  });

  it.each([
    ["missing", undefined],
    ["invalid", "not-a-date"],
  ])("rejects a %s generatedAt", (_case, generatedAt) => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: { ...output, generatedAt },
      })
    ).toThrow("Agent output generatedAt must be a valid ISO timestamp");
  });

  it("rejects a non-array analyses value", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: { ...output, analyses: {} },
      })
    ).toThrow("Agent output analyses must be an array");
  });

  it("rejects a null analysis entry with a domain error", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: { ...output, analyses: [null] },
      })
    ).toThrow("Agent output analysis at index 0 must be an object");
  });

  it("rejects analysis entries without non-empty identity fields", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], itemId: " " }],
        },
      })
    ).toThrow("Agent output analysis at index 0 has an invalid itemId");

    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], contentHash: "" }],
        },
      })
    ).toThrow("Agent output analysis at index 0 has an invalid contentHash");
  });

  it.each([
    ["chineseTitle", { chineseTitle: " " }],
    ["chineseSummary", { chineseSummary: null }],
    ["selectionRationale", { selectionRationale: undefined }],
  ])("rejects an invalid required text field: %s", (field, override) => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], ...override }],
        },
      })
    ).toThrow(`Agent output analysis at index 0 has an invalid ${field}`);
  });

  it("rejects an unsupported primary topic", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], primaryTopic: "architecture" }],
        },
      })
    ).toThrow("Agent output analysis at index 0 has an invalid primaryTopic");
  });

  it.each([
    ["missing breakdown", undefined],
    ["missing score", { ...output.analyses[0].scoreBreakdown, novelty: undefined }],
    ["non-numeric score", { ...output.analyses[0].scoreBreakdown, novelty: "high" }],
    ["out-of-range score", { ...output.analyses[0].scoreBreakdown, novelty: 21 }],
  ])("rejects an invalid score breakdown: %s", (_case, scoreBreakdown) => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], scoreBreakdown }],
        },
      })
    ).toThrow("Agent output analysis at index 0 has an invalid scoreBreakdown");
  });

  it.each([
    ["non-array", "photography"],
    ["empty", []],
    ["blank entry", ["photography", " "]],
  ])("rejects invalid trend keywords: %s", (_case, trendKeywords) => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [{ ...output.analyses[0], trendKeywords }],
        },
      })
    ).toThrow("Agent output analysis at index 0 has invalid trendKeywords");
  });

  it("rejects a non-object batch with a domain error", () => {
    expect(() =>
      importVisualRadarAgentOutput({ batch: null, current, output })
    ).toThrow("Agent batch must be an object");
  });

  it("rejects a batch that is not prepared for value screening", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, status: "complete" },
        current,
        output,
      })
    ).toThrow("Agent batch is not prepared");

    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, stage: "translation" },
        current,
        output,
      })
    ).toThrow("Agent batch stage is unsupported");
  });

  it("rejects malformed batch candidates with domain errors", () => {
    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, candidates: null },
        current,
        output,
      })
    ).toThrow("Agent batch candidates must be an array");

    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, candidates: [null] },
        current,
        output,
      })
    ).toThrow("Agent batch candidate at index 0 must be an object");

    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, candidates: [{ id: "", contentHash: "sha1:x" }] },
        current,
        output,
      })
    ).toThrow("Agent batch candidate at index 0 has an invalid id");

    expect(() =>
      importVisualRadarAgentOutput({
        batch: { ...batch, candidates: [{ id: "candidate-1", contentHash: "" }] },
        current,
        output,
      })
    ).toThrow("Agent batch candidate at index 0 has an invalid contentHash");
  });

  it("leaves current unchanged when a later analysis is invalid", () => {
    const before = structuredClone(current);

    expect(() =>
      importVisualRadarAgentOutput({
        batch,
        current,
        output: {
          ...output,
          analyses: [
            output.analyses[0],
            { ...output.analyses[0], itemId: "unknown" },
          ],
        },
      })
    ).toThrow("Agent output contains unknown candidate: unknown");
    expect(current).toEqual(before);
  });
});
