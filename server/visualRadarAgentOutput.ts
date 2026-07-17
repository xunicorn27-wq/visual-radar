import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  normalizeVisualRadarAnalysis,
  type RawVisualRadarAnalysis,
  type VisualRadarAnalysisArtifact,
} from "./visualRadarAnalysis";
import type { VisualRadarAgentBatch } from "./visualRadarAgentBatch";
import { mergeVisualRadarAnalysisArtifact } from "./visualRadarAnalysisStore";

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
  batch: VisualRadarAgentBatch;
  current: VisualRadarAnalysisArtifact;
  output: VisualRadarAgentOutput;
}) {
  if (output.schemaVersion !== "1") {
    throw new Error("Agent output schema is unsupported");
  }
  if (output.promptVersion !== VISUAL_ANALYSIS_PROMPT_VERSION) {
    throw new Error("Agent output prompt version mismatch");
  }
  if (output.model !== "codex-agent") {
    throw new Error("Agent output model is unsupported");
  }

  const candidates = new Map(batch.candidates.map((item) => [item.id, item]));
  const seenItemIds = new Set<string>();
  const analyses = output.analyses.map((raw) => {
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
      analyzedAt: output.generatedAt,
      contentHash: item.contentHash,
      itemId: item.id,
      model: output.model,
      promptVersion: output.promptVersion,
    });
  });

  return {
    artifact: mergeVisualRadarAnalysisArtifact(current, {
      analyses,
      failures: [],
      generatedAt: output.generatedAt,
      promptVersion: output.promptVersion,
    }),
    summary: { imported: analyses.length, submitted: output.analyses.length },
  };
}
