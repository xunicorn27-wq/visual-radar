import path from "node:path";
import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { buildReviewQueue } from "../server/visualRadarReviewQueue";
import { atomicJson } from "../server/visualRadarRunStore";

const root = path.resolve(import.meta.dirname, ".."); loadProjectEnv(root);
const files = resolveProjectPaths(root);
const queue = buildReviewQueue(createVisualRadarIssueStore(files.issues).listIssues());
const target = path.join(files.dataDir, "visual_radar_review_queue.json");
atomicJson(target, queue);
console.log(JSON.stringify({ ...queue.summary, queue: "data/visual_radar_review_queue.json", next: queue.entries.slice(0, 5).map(({ issueId, itemId, title, reasons }) => ({ issueId, itemId, title, reasons })) }, null, 2));
