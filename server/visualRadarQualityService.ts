import { createVisualRadarIssueStore } from "./visualRadarIssue";
import { readVisualRadarArtifact } from "./visualRadarStore";
import { updateSourceHealth } from "./visualRadarSourceHealth";
import { resolveProjectPaths } from "./paths";
import { buildVisualRadarQualityChecklist } from "./visualRadarQualityChecklist";
import type { VisualRadarIssue } from "./visualRadarIssue";

export function inspectIssueQuality(root: string, issue: VisualRadarIssue, now = new Date().toISOString()) {
  const files = resolveProjectPaths(root);
  // Derive coverage from collection, not a newer partial probe; never write health here.
  const health = updateSourceHealth(null, readVisualRadarArtifact(files.items));
  return buildVisualRadarQualityChecklist({ issue, health, history: createVisualRadarIssueStore(files.issues).listIssues(), now });
}
