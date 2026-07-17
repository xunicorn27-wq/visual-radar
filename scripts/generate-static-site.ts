import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { writeVisualRadarStaticSite } from "../server/visualRadarStaticSite";
import { copyPublicAssets } from "./public-assets";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const files = resolveProjectPaths(projectRoot);
const pagesPublicDir = path.join(projectRoot, ".pages-public");
copyPublicAssets({
  sourceDir: path.join(projectRoot, "client", "public"),
  outputDir: pagesPublicDir,
});
const summary = writeVisualRadarStaticSite({
  issueStore: createVisualRadarIssueStore(files.issues),
  outputDir: path.join(pagesPublicDir, "public-data"),
});

console.log(JSON.stringify(summary, null, 2));
