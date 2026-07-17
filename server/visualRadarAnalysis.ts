import type { VisualCultureTopic } from "./visualCultureSources";

export const VISUAL_ANALYSIS_PROMPT_VERSION = "visual-daily-v1";

export const VISUAL_SCORE_LIMITS = {
  informationSpecificity: 15,
  novelty: 20,
  professionalRelevance: 20,
  sourceQuality: 10,
  timeliness: 5,
  visualInspiration: 30,
} as const;

export interface VisualRadarScoreBreakdown {
  informationSpecificity: number;
  novelty: number;
  professionalRelevance: number;
  sourceQuality: number;
  timeliness: number;
  visualInspiration: number;
}

export interface VisualRadarAnalysis {
  analyzedAt: string;
  chineseSummary: string | null;
  chineseTitle: string | null;
  contentHash: string;
  itemId: string;
  model: string;
  primaryTopic: VisualCultureTopic;
  promptVersion: string;
  score: number;
  scoreBreakdown: VisualRadarScoreBreakdown;
  selectionRationale: string | null;
  status: "success";
  trendKeywords: string[];
}

export interface VisualRadarAnalysisFailure {
  analyzedAt: string;
  contentHash: string;
  error: string;
  itemId: string;
  model: string;
  promptVersion: string;
  status: "failed";
}

export interface VisualRadarAnalysisArtifact {
  analyses: VisualRadarAnalysis[];
  failures: VisualRadarAnalysisFailure[];
  generatedAt: string;
  promptVersion: string;
}

export interface RawVisualRadarAnalysis {
  chineseSummary?: unknown;
  chineseTitle?: unknown;
  primaryTopic?: unknown;
  scoreBreakdown?: Partial<Record<keyof VisualRadarScoreBreakdown, unknown>>;
  selectionRationale?: unknown;
  trendKeywords?: unknown;
}

const VISUAL_TOPICS = new Set<VisualCultureTopic>([
  "creator",
  "exhibition",
  "fashion_culture",
  "magazine",
  "outfit",
  "photography",
  "styling",
  "tool",
]);

export function normalizeVisualRadarAnalysis(
  value: RawVisualRadarAnalysis,
  metadata: {
    analyzedAt: string;
    contentHash: string;
    itemId: string;
    model: string;
    promptVersion?: string;
  }
): VisualRadarAnalysis {
  const scoreBreakdown = Object.fromEntries(
    Object.entries(VISUAL_SCORE_LIMITS).map(([key, maximum]) => [
      key,
      clampScore(value.scoreBreakdown?.[key as keyof VisualRadarScoreBreakdown], maximum),
    ])
  ) as unknown as VisualRadarScoreBreakdown;

  return {
    analyzedAt: metadata.analyzedAt,
    chineseSummary: textOrNull(value.chineseSummary),
    chineseTitle: textOrNull(value.chineseTitle),
    contentHash: metadata.contentHash,
    itemId: metadata.itemId,
    model: metadata.model,
    primaryTopic: normalizeTopic(value.primaryTopic),
    promptVersion: metadata.promptVersion || VISUAL_ANALYSIS_PROMPT_VERSION,
    score: Object.values(scoreBreakdown).reduce((total, score) => total + score, 0),
    scoreBreakdown,
    selectionRationale: textOrNull(value.selectionRationale),
    status: "success",
    trendKeywords: normalizeTextList(value.trendKeywords),
  };
}

export function getVisualAnalysisCacheKey(
  contentHash: string,
  promptVersion = VISUAL_ANALYSIS_PROMPT_VERSION
) {
  return `${contentHash}:${promptVersion}`;
}

function clampScore(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

function normalizeTopic(value: unknown): VisualCultureTopic {
  return typeof value === "string" && VISUAL_TOPICS.has(value as VisualCultureTopic)
    ? (value as VisualCultureTopic)
    : "fashion_culture";
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(textOrNull).filter((entry): entry is string => Boolean(entry)))
  ).slice(0, 8);
}

function textOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text || null;
}
