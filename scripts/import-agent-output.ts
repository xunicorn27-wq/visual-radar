import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { importVisualRadarAgentOutputFiles } from "../server/visualRadarAgentOutputFile";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const files = resolveProjectPaths(projectRoot);
const result = importVisualRadarAgentOutputFiles({
  analysis: files.analysis,
  batch: files.agentBatch,
  output: files.agentOutput,
});

console.log(JSON.stringify(result.summary, null, 2));
