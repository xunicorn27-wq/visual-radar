import type { OpenAiVisualRadarProvider } from "./openAiVisualRadarProvider";
import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  getVisualAnalysisCacheKey,
  type VisualRadarAnalysisArtifact,
  type VisualRadarAnalysisFailure,
} from "./visualRadarAnalysis";
import { mergeVisualRadarAnalysisArtifact } from "./visualRadarAnalysisStore";
import type { VisualRadarArtifact } from "./visualRadarCollector";
import { selectVisualRadarDailyStories } from "./visualRadarDailySelector";
import {
  createVisualRadarIssue,
  getAdjacentVisualRadarIssueIds,
  type createVisualRadarIssueStore,
} from "./visualRadarIssue";

type VisualRadarIssueStore = ReturnType<typeof createVisualRadarIssueStore>;

export class VisualRadarConfigurationError extends Error {
  statusCode = 503;
}

export async function analyzeVisualRadarArtifact({
  analysisArtifact,
  batchSize = 12,
  itemsArtifact,
  now = new Date().toISOString(),
  provider,
}: {
  analysisArtifact: VisualRadarAnalysisArtifact;
  batchSize?: number;
  itemsArtifact: VisualRadarArtifact;
  now?: string;
  provider: OpenAiVisualRadarProvider | null;
}) {
  if (!provider) {
    throw new VisualRadarConfigurationError(
      "OpenAI API key is not configured for Visual Radar analysis"
    );
  }

  const eligibleItems = itemsArtifact.items.filter(
    (item) =>
      item.provenance.authenticity === "live" &&
      getAgeHours(item.postedAt || item.capturedAt, now) <= 72
  );
  const cachedKeys = new Set(
    analysisArtifact.analyses.map((analysis) =>
      getVisualAnalysisCacheKey(analysis.contentHash, analysis.promptVersion)
    )
  );
  const uncachedItems = eligibleItems.filter(
    (item) => !cachedKeys.has(getVisualAnalysisCacheKey(item.contentHash))
  );
  const analyses = [];
  const failures: VisualRadarAnalysisFailure[] = [];

  for (let index = 0; index < uncachedItems.length; index += batchSize) {
    const batch = uncachedItems.slice(index, index + batchSize);
    try {
      const batchAnalyses = await provider(batch, { analyzedAt: now });
      analyses.push(...batchAnalyses);
      const returnedIds = new Set(batchAnalyses.map((analysis) => analysis.itemId));
      for (const item of batch) {
        if (returnedIds.has(item.id)) continue;
        failures.push(buildFailure(item, now, batchAnalyses[0]?.model, "No analysis returned"));
      }
    } catch (error) {
      for (const item of batch) {
        failures.push(
          buildFailure(
            item,
            now,
            process.env.OPENAI_MODEL?.trim(),
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    }
  }

  const artifact = mergeVisualRadarAnalysisArtifact(analysisArtifact, {
    analyses,
    failures,
    generatedAt: now,
    promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
  });

  return {
    artifact,
    summary: {
      analyzed: analyses.length,
      cached: eligibleItems.length - uncachedItems.length,
      failed: failures.length,
      totalEligible: eligibleItems.length,
    },
  };
}

export function generateVisualRadarIssueFromArtifacts({
  analysisArtifact,
  issueStore,
  itemsArtifact,
  now = new Date().toISOString(),
}: {
  analysisArtifact: VisualRadarAnalysisArtifact;
  issueStore: VisualRadarIssueStore;
  itemsArtifact: VisualRadarArtifact;
  now?: string;
}) {
  const existingIssues = issueStore.listIssues();
  const issueDate = now.slice(0, 10);
  const existingToday = existingIssues.find((issue) => issue.issueDate === issueDate);
  const previouslySelectedItemIds = new Set(
    existingIssues
      .filter((issue) => issue.issueDate !== issueDate)
      .flatMap((issue) => issue.stories.map((story) => story.item.id))
  );
  const currentItems = new Map(itemsArtifact.items.map((item) => [item.id, item]));
  const currentAnalyses = new Map(
    analysisArtifact.analyses.map((analysis) => [analysis.itemId, analysis])
  );
  for (const story of existingToday?.stories || []) {
    const currentItem = currentItems.get(story.item.id);
    const currentAnalysis = currentAnalyses.get(story.item.id);
    if (
      !currentItem ||
      !currentAnalysis ||
      currentAnalysis.contentHash !== currentItem.contentHash
    ) {
      currentItems.set(story.item.id, story.item);
      currentAnalyses.set(story.item.id, story.analysis);
    }
  }
  const selection = selectVisualRadarDailyStories({
    analyses: Array.from(currentAnalyses.values()),
    items: Array.from(currentItems.values()),
    now,
    previouslySelectedItemIds,
  });
  if (selection.selected.length === 0) {
    throw new Error("No analyzed Visual Radar stories are eligible for an issue");
  }

  const issue = createVisualRadarIssue({
    eligible: selection.eligible,
    selected: selection.selected,
    skipped: selection.skipped,
  }, {
    existingIds: existingIssues.map((existing) => existing.id),
    now,
  });
  return issueStore.saveIssue(issue);
}

export function getVisualRadarIssueDetail(
  issueStore: VisualRadarIssueStore,
  issueId: string
) {
  const issue = issueStore.getIssue(issueId);
  if (!issue) return null;
  return {
    issue,
    navigation: getAdjacentVisualRadarIssueIds(issueStore.listIssues(), issueId),
  };
}

function buildFailure(
  item: VisualRadarArtifact["items"][number],
  analyzedAt: string,
  model: string | undefined,
  error: string
): VisualRadarAnalysisFailure {
  return {
    analyzedAt,
    contentHash: item.contentHash,
    error,
    itemId: item.id,
    model: model || "unknown",
    promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
    status: "failed",
  };
}

function getAgeHours(value: string, now: string) {
  const itemTime = new Date(value).getTime();
  const nowTime = new Date(now).getTime();
  if (Number.isNaN(itemTime) || Number.isNaN(nowTime)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowTime - itemTime) / 3_600_000;
}
