import type { IntelItem } from "./intelItem";
import type { VisualRadarAnalysis } from "./visualRadarAnalysis";
import { classifyFreshness, isCandidateInWindow, QUALITY_VERSION } from "../shared/visualRadarQuality";

export type VisualRadarSelectionWindow = "24h" | "72h" | "upcoming" | "reference" | "unknown";

export interface VisualRadarSelectedStory {
  analysis: VisualRadarAnalysis;
  item: IntelItem;
  window: VisualRadarSelectionWindow;
}

export interface VisualRadarSkippedStory {
  itemId: string;
  reason:
    | "daily_limit"
    | "duplicate_content"
    | "missing_analysis"
    | "missing_evidence"
    | "reference_limit"
    | "outside_72h"
    | "previous_issue"
    | "score_below_60"
    | "source_limit"
    | "source_not_live";
// Legacy issues remain readable; newly generated issues must pass the quality gate.
}

export function selectVisualRadarDailyStories({
  analyses,
  items,
  limit = 10,
  now = new Date().toISOString(),
  previouslySelectedItemIds,
}: {
  analyses: readonly VisualRadarAnalysis[];
  items: readonly IntelItem[];
  limit?: number;
  now?: string;
  previouslySelectedItemIds: ReadonlySet<string>;
}) {
  const skipped: VisualRadarSkippedStory[] = [];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const analysisByItemId = new Map(analyses.map((analysis) => {
    const item = itemsById.get(analysis.itemId);
    if (!item || analysis.editorial?.status !== "verified") return [analysis.itemId, analysis];
    const timeliness = classifyFreshness(item, now).timeliness;
    return [analysis.itemId, { ...analysis, score: analysis.score - analysis.scoreBreakdown.timeliness + timeliness,
      scoreBreakdown: { ...analysis.scoreBreakdown, timeliness } }];
  }));
  const seenContentHashes = new Set<string>();
  const nowTime = new Date(now).getTime();

  const candidates = items
    .toSorted((left, right) => {
      const scoreDifference =
        (analysisByItemId.get(right.id)?.score || 0) -
        (analysisByItemId.get(left.id)?.score || 0);
      if (scoreDifference !== 0) return scoreDifference;
      const dateDifference = getItemTime(right) - getItemTime(left);
      return dateDifference !== 0 ? dateDifference : left.id.localeCompare(right.id);
    })
    .flatMap((item): VisualRadarSelectedStory[] => {
      const analysis = analysisByItemId.get(item.id);
      if (!analysis || analysis.contentHash !== item.contentHash) {
        skipped.push({ itemId: item.id, reason: "missing_analysis" });
        return [];
      }
      if (analysis.editorial?.version !== QUALITY_VERSION || analysis.editorial.status !== "verified") {
        skipped.push({ itemId: item.id, reason: "missing_evidence" });
        return [];
      }
      if (item.provenance.authenticity !== "live") {
        skipped.push({ itemId: item.id, reason: "source_not_live" });
        return [];
      }
      if (previouslySelectedItemIds.has(item.id)) {
        skipped.push({ itemId: item.id, reason: "previous_issue" });
        return [];
      }
      if (analysis.score < 60) {
        skipped.push({ itemId: item.id, reason: "score_below_60" });
        return [];
      }
      if (seenContentHashes.has(item.contentHash)) {
        skipped.push({ itemId: item.id, reason: "duplicate_content" });
        return [];
      }

      const freshness = classifyFreshness(item, now);
      const ageHours = (nowTime - getItemTime(item)) / 3_600_000;
      if (!isCandidateInWindow(item, now)) {
        skipped.push({ itemId: item.id, reason: "outside_72h" });
        return [];
      }

      seenContentHashes.add(item.contentHash);
      return [
        {
          analysis,
          item,
          window: freshness.kind === "latest" ? (ageHours <= 24 ? "24h" : "72h") : freshness.kind,
        },
      ];
    });

  const recentCandidates = candidates.filter((entry) => entry.window === "24h");
  const selectionPool = [...recentCandidates, ...candidates.filter((entry) => entry.window !== "24h")];
  const selected: VisualRadarSelectedStory[] = [];
  const selectedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const distinctTopicTarget = Math.min(
    4,
    limit,
    new Set(selectionPool.map((entry) => entry.analysis.primaryTopic)).size
  );

  for (const candidate of selectionPool) {
    if (new Set(selected.map((entry) => entry.analysis.primaryTopic)).size >= distinctTopicTarget) {
      break;
    }
    if (selected.some((entry) => entry.analysis.primaryTopic === candidate.analysis.primaryTopic)) {
      continue;
    }
    trySelect(candidate, selected, selectedIds, sourceCounts, limit);
  }

  for (const candidate of selectionPool) {
    if (selected.length >= limit) break;
    trySelect(candidate, selected, selectedIds, sourceCounts, limit);
  }

  for (const candidate of selectionPool) {
    if (selectedIds.has(candidate.item.id)) continue;
    const sourceKey = getSourceKey(candidate.item);
    skipped.push({
      itemId: candidate.item.id,
      reason: (sourceCounts.get(sourceKey) || 0) >= 2 ? "source_limit" : !["24h", "72h"].includes(candidate.window) && selected.filter((entry) => !["24h", "72h"].includes(entry.window)).length >= 3 ? "reference_limit" : "daily_limit",
    });
  }

  return { eligible: candidates, selected, skipped };
}

function trySelect(
  candidate: VisualRadarSelectedStory,
  selected: VisualRadarSelectedStory[],
  selectedIds: Set<string>,
  sourceCounts: Map<string, number>,
  limit: number
) {
  if (selected.length >= limit || selectedIds.has(candidate.item.id)) return false;
  if (!["24h", "72h"].includes(candidate.window) && selected.filter((entry) => !["24h", "72h"].includes(entry.window)).length >= 3) return false;
  const sourceKey = getSourceKey(candidate.item);
  const sourceCount = sourceCounts.get(sourceKey) || 0;
  if (sourceCount >= 2) return false;

  selected.push(candidate);
  selectedIds.add(candidate.item.id);
  sourceCounts.set(sourceKey, sourceCount + 1);
  return true;
}

function getSourceKey(item: IntelItem) {
  return item.sourceAccount?.trim() || item.provenance.evidenceUrl || item.sourceUrl;
}

function getItemTime(item: IntelItem) {
  const date = new Date(item.postedAt || "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
