import path from "node:path";
import { resolveProjectPaths } from "../server/paths";
import { loadProjectEnv } from "../server/env";
import { prepareVisualRadarAgentBatch } from "../server/visualRadarAgentBatch";
import { readVisualRadarAnalysisArtifact } from "../server/visualRadarAnalysisStore";
import { readVisualRadarArtifact } from "../server/visualRadarStore";
import { recordSourceHealth } from "../server/visualRadarSourceHealth";

const root = path.resolve(import.meta.dirname, ".."); loadProjectEnv(root);
const files = resolveProjectPaths(root);
const items = readVisualRadarArtifact(files.items);
const health = recordSourceHealth(files.sourceHealth, items);
const analyses = readVisualRadarAnalysisArtifact(files.analysis);
const batch = prepareVisualRadarAgentBatch({ itemsArtifact: items, analysisArtifact: analyses, now: items.generatedAt });
console.log(JSON.stringify({ collectionAt: items.generatedAt, health: health.summary, screening: batch.screening, summary: batch.summary,
  verifiedAnalyses: analyses.analyses.filter((a) => a.editorial?.status === "verified").length,
  legacyAnalyses: analyses.analyses.filter((a) => !a.editorial).length,
  note: "历史采集回放，不代表今天来源实时可用；同一采集不会重复累加失败。" }, null, 2));
