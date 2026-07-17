import fs from "node:fs";
import path from "node:path";

import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  getVisualAnalysisCacheKey,
  type VisualRadarAnalysisArtifact,
} from "./visualRadarAnalysis";

export function readVisualRadarAnalysisArtifact(
  filePath: string
): VisualRadarAnalysisArtifact {
  if (!fs.existsSync(filePath)) return emptyArtifact();

  const payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Partial<
    VisualRadarAnalysisArtifact
  >;
  return {
    analyses: Array.isArray(payload.analyses) ? payload.analyses : [],
    failures: Array.isArray(payload.failures) ? payload.failures : [],
    generatedAt:
      typeof payload.generatedAt === "string"
        ? payload.generatedAt
        : new Date().toISOString(),
    promptVersion:
      typeof payload.promptVersion === "string"
        ? payload.promptVersion
        : VISUAL_ANALYSIS_PROMPT_VERSION,
  };
}

export function writeVisualRadarAnalysisArtifact(
  filePath: string,
  artifact: VisualRadarAnalysisArtifact
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
}

export function mergeVisualRadarAnalysisArtifact(
  current: VisualRadarAnalysisArtifact,
  incoming: VisualRadarAnalysisArtifact
): VisualRadarAnalysisArtifact {
  const analysisByKey = new Map(
    current.analyses.map((analysis) => [
      getVisualAnalysisCacheKey(analysis.contentHash, analysis.promptVersion),
      analysis,
    ])
  );
  for (const analysis of incoming.analyses) {
    analysisByKey.set(
      getVisualAnalysisCacheKey(analysis.contentHash, analysis.promptVersion),
      analysis
    );
  }

  const failureByKey = new Map(
    current.failures.map((failure) => [
      getVisualAnalysisCacheKey(failure.contentHash, failure.promptVersion),
      failure,
    ])
  );
  for (const failure of incoming.failures) {
    const key = getVisualAnalysisCacheKey(
      failure.contentHash,
      failure.promptVersion
    );
    if (!analysisByKey.has(key)) failureByKey.set(key, failure);
  }
  for (const key of Array.from(analysisByKey.keys())) failureByKey.delete(key);

  return {
    analyses: Array.from(analysisByKey.values()),
    failures: Array.from(failureByKey.values()),
    generatedAt: incoming.generatedAt,
    promptVersion: incoming.promptVersion,
  };
}

function emptyArtifact(): VisualRadarAnalysisArtifact {
  return {
    analyses: [],
    failures: [],
    generatedAt: new Date().toISOString(),
    promptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
  };
}
