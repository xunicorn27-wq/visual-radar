import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  VISUAL_SCORE_LIMITS,
  normalizeVisualRadarAnalysis,
  type RawVisualRadarAnalysis,
  type VisualRadarAnalysisArtifact,
  type VisualRadarScoreBreakdown,
} from "./visualRadarAnalysis";
import { mergeVisualRadarAnalysisArtifact } from "./visualRadarAnalysisStore";

const VISUAL_TOPICS = new Set([
  "creator",
  "exhibition",
  "fashion_culture",
  "magazine",
  "outfit",
  "photography",
  "styling",
  "tool",
]);

export interface VisualRadarAgentOutput {
  analyses: Array<
    RawVisualRadarAnalysis & {
      contentHash: string;
      itemId: string;
    }
  >;
  generatedAt: string;
  model: "codex-agent";
  promptVersion: string;
  schemaVersion: "1";
}

export function importVisualRadarAgentOutput({
  batch,
  current,
  output,
}: {
  batch: unknown;
  current: VisualRadarAnalysisArtifact;
  output: unknown;
}) {
  const parsedBatch = parseAgentBatch(batch);
  const parsedOutput = parseAgentOutput(output);

  const candidates = new Map(
    parsedBatch.candidates.map((item) => [item.id, item])
  );
  const seenItemIds = new Set<string>();
  const analyses = parsedOutput.analyses.map((raw) => {
    const item = candidates.get(raw.itemId);
    if (!item) {
      throw new Error(`Agent output contains unknown candidate: ${raw.itemId}`);
    }
    if (item.contentHash !== raw.contentHash) {
      throw new Error(`Agent output content hash mismatch: ${raw.itemId}`);
    }
    if (seenItemIds.has(raw.itemId)) {
      throw new Error(`Agent output contains duplicate candidate: ${raw.itemId}`);
    }
    seenItemIds.add(raw.itemId);

    return normalizeVisualRadarAnalysis(raw, {
      analyzedAt: parsedOutput.generatedAt,
      contentHash: item.contentHash,
      itemId: item.id,
      model: parsedOutput.model,
      promptVersion: parsedOutput.promptVersion,
    });
  });

  return {
    artifact: mergeVisualRadarAnalysisArtifact(current, {
      analyses,
      failures: [],
      generatedAt: parsedOutput.generatedAt,
      promptVersion: parsedOutput.promptVersion,
    }),
    summary: {
      imported: analyses.length,
      submitted: parsedOutput.analyses.length,
    },
  };
}

function parseAgentOutput(value: unknown): VisualRadarAgentOutput {
  if (!isRecord(value)) {
    throw new Error("Agent output must be an object");
  }
  if (value.schemaVersion !== "1") {
    throw new Error("Agent output schema is unsupported");
  }
  if (value.promptVersion !== VISUAL_ANALYSIS_PROMPT_VERSION) {
    throw new Error("Agent output prompt version mismatch");
  }
  if (value.model !== "codex-agent") {
    throw new Error("Agent output model is unsupported");
  }
  if (!isValidIsoTimestamp(value.generatedAt)) {
    throw new Error("Agent output generatedAt must be a valid ISO timestamp");
  }
  if (!Array.isArray(value.analyses)) {
    throw new Error("Agent output analyses must be an array");
  }

  const analyses = value.analyses.map((analysis, index) => {
    if (!isRecord(analysis)) {
      throw new Error(`Agent output analysis at index ${index} must be an object`);
    }
    if (!isNonEmptyString(analysis.itemId)) {
      throw new Error(`Agent output analysis at index ${index} has an invalid itemId`);
    }
    if (!isNonEmptyString(analysis.contentHash)) {
      throw new Error(
        `Agent output analysis at index ${index} has an invalid contentHash`
      );
    }
    for (const field of [
      "chineseTitle",
      "chineseSummary",
      "selectionRationale",
    ] as const) {
      if (!isNonEmptyString(analysis[field])) {
        throw new Error(
          `Agent output analysis at index ${index} has an invalid ${field}`
        );
      }
    }
    if (
      !isNonEmptyString(analysis.primaryTopic) ||
      !VISUAL_TOPICS.has(analysis.primaryTopic)
    ) {
      throw new Error(
        `Agent output analysis at index ${index} has an invalid primaryTopic`
      );
    }
    if (!isValidScoreBreakdown(analysis.scoreBreakdown)) {
      throw new Error(
        `Agent output analysis at index ${index} has an invalid scoreBreakdown`
      );
    }
    if (!isValidTrendKeywords(analysis.trendKeywords)) {
      throw new Error(
        `Agent output analysis at index ${index} has invalid trendKeywords`
      );
    }
    return {
      chineseSummary: analysis.chineseSummary,
      chineseTitle: analysis.chineseTitle,
      contentHash: analysis.contentHash,
      itemId: analysis.itemId,
      primaryTopic: analysis.primaryTopic,
      scoreBreakdown: analysis.scoreBreakdown,
      selectionRationale: analysis.selectionRationale,
      trendKeywords: analysis.trendKeywords,
    };
  });

  return {
    analyses,
    generatedAt: value.generatedAt,
    model: "codex-agent",
    promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
    schemaVersion: "1",
  };
}

function parseAgentBatch(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Agent batch must be an object");
  }
  if (value.status !== "prepared") {
    throw new Error("Agent batch is not prepared");
  }
  if (value.stage !== "value_screening") {
    throw new Error("Agent batch stage is unsupported");
  }
  if (!Array.isArray(value.candidates)) {
    throw new Error("Agent batch candidates must be an array");
  }

  const candidates = value.candidates.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Agent batch candidate at index ${index} must be an object`);
    }
    if (!isNonEmptyString(candidate.id)) {
      throw new Error(`Agent batch candidate at index ${index} has an invalid id`);
    }
    if (!isNonEmptyString(candidate.contentHash)) {
      throw new Error(
        `Agent batch candidate at index ${index} has an invalid contentHash`
      );
    }
    return { contentHash: candidate.contentHash, id: candidate.id };
  });

  return { candidates };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidScoreBreakdown(
  value: unknown
): value is VisualRadarScoreBreakdown {
  if (!isRecord(value)) return false;

  return Object.entries(VISUAL_SCORE_LIMITS).every(([key, maximum]) => {
    const score = value[key];
    return (
      typeof score === "number" &&
      Number.isFinite(score) &&
      score >= 0 &&
      score <= maximum
    );
  });
}

function isValidTrendKeywords(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString)
  );
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match) return false;

  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] =
    match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const daysInMonth = new Date(Date.UTC(numericYear, numericMonth, 0)).getUTCDate();

  return (
    numericMonth >= 1 &&
    numericMonth <= 12 &&
    numericDay >= 1 &&
    numericDay <= daysInMonth &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    (offsetHour === undefined ||
      (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59)) &&
    !Number.isNaN(Date.parse(value))
  );
}
