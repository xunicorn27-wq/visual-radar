import path from "node:path";
import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { checkedIssueId } from "../server/visualRadarRunStore";
import { inspectIssueQuality } from "../server/visualRadarQualityService";

const root = path.resolve(import.meta.dirname, "..");
const id = checkedIssueId(process.argv[2] || "");
const issue = createVisualRadarIssueStore(resolveProjectPaths(root).issues).getIssue(id);
if (!issue) throw new Error("日报不存在");
const report = inspectIssueQuality(root, issue);
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--strict") && !report.canPublish) process.exitCode = 1;
