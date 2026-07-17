import fs from "node:fs";
import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import type { VisualRadarAgentBatch } from "../server/visualRadarAgentBatch";
import {
  importVisualRadarAgentOutput,
  type VisualRadarAgentOutput,
} from "../server/visualRadarAgentOutput";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifact,
} from "../server/visualRadarAnalysisStore";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const files = resolveProjectPaths(projectRoot);
const batch = JSON.parse(
  fs.readFileSync(files.agentBatch, "utf-8")
) as VisualRadarAgentBatch;
const output = JSON.parse(
  fs.readFileSync(files.agentOutput, "utf-8")
) as VisualRadarAgentOutput;
const result = importVisualRadarAgentOutput({
  batch,
  current: readVisualRadarAnalysisArtifact(files.analysis),
  output,
});

writeVisualRadarAnalysisArtifact(files.analysis, result.artifact);
console.log(JSON.stringify(result.summary, null, 2));
