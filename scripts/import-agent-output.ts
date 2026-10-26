import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { importVisualRadarAgentOutputFiles } from "../server/visualRadarAgentOutputFile";
import fs from "node:fs";
import { checkpoint, stableHash } from "../server/visualRadarRunStore";
import { singaporeIssueDate } from "../shared/visualRadarQuality";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const files = resolveProjectPaths(projectRoot);
const result = importVisualRadarAgentOutputFiles({
  analysis: files.analysis,
  batch: files.agentBatch,
  output: files.agentOutput,
});
const batch = JSON.parse(fs.readFileSync(files.agentBatch, "utf8"));
checkpoint(files.runs, singaporeIssueDate(batch.generatedAt), "imported", stableHash({ batch, analysis: result.artifact }));

console.log(JSON.stringify(result.summary, null, 2));
