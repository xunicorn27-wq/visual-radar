import path from "node:path";

import { loadProjectEnv } from "../server/env";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);

const baseUrl = (process.env.VISUAL_RADAR_AUTOMATION_URL || "http://localhost:3099").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET || "";
const dryRun = process.argv.includes("--dry-run");
if (!secret) throw new Error("CRON_SECRET 未配置");

const response = await fetch(`${baseUrl}/api/automation/daily${dryRun ? "?dryRun=1" : ""}`, {
  method: "POST",
  headers: { "x-cron-secret": secret },
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
console.log(JSON.stringify(payload, null, 2));
