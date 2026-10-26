import path from "node:path";
import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { collectVisualRadarItems, DEFAULT_VISUAL_RADAR_FEEDS } from "../server/visualRadarCollector";
import { recordSourceHealth } from "../server/visualRadarSourceHealth";
import { atomicJson } from "../server/visualRadarRunStore";

const root = path.resolve(import.meta.dirname, ".."); loadProjectEnv(root);
const files = resolveProjectPaths(root);
const ids = process.argv.slice(2);
if (!ids.length || ids.some((id) => !DEFAULT_VISUAL_RADAR_FEEDS.some((s) => s.sourceId === id))) throw new Error("用法：pnpm sources:probe <已配置来源ID...>");
const sources = DEFAULT_VISUAL_RADAR_FEEDS.filter((s) => ids.includes(s.sourceId));
const result = await collectVisualRadarItems({ sources, limitPerSource: 3, sourceConcurrency: 2 });
const health = recordSourceHealth(files.sourceHealth, result);
const report = { generatedAt: result.generatedAt, targetedProbe: true, primaryItemsUnchanged: true,
  sources: health.sources.filter((s) => ids.includes(s.sourceId)), summary: health.summary,
  samples: result.items.map((i) => ({ source: i.sourceAccount, title: i.title, url: i.sourceUrl, publishedAt: i.postedAt || null })) };
atomicJson(path.join(files.dataDir, "visual_radar_source_probe.json"), report);
console.log(JSON.stringify(report, null, 2));
