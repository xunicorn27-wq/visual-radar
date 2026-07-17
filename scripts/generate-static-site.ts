import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { writeVisualRadarStaticSite } from "../server/visualRadarStaticSite";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const files = resolveProjectPaths(projectRoot);
const summary = writeVisualRadarStaticSite({
  issueStore: createVisualRadarIssueStore(files.issues),
  outputDir: path.join(projectRoot, ".pages-public", "public-data"),
});

console.log(JSON.stringify(summary, null, 2));
