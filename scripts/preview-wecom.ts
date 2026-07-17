import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../server/env";

export interface PreviewRequestOptions {
  automationUrl?: string | null;
  cronSecret: string | null | undefined;
  issueId: string;
}

export function buildPreviewRequest(options: PreviewRequestOptions) {
  const issueId = options.issueId.trim();
  if (!isRealIssueDate(issueId)) {
    throw new Error("Issue ID must be a real YYYY-MM-DD date");
  }

  const cronSecret = options.cronSecret?.trim();
  if (!cronSecret) throw new Error("CRON_SECRET is required");

  const configuredBase = options.automationUrl?.trim() || "http://localhost:3099";
  const base = new URL(configuredBase);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("VISUAL_RADAR_AUTOMATION_URL must use HTTP or HTTPS");
  }

  const url = new URL(
    `/api/visual-radar/issues/${encodeURIComponent(issueId)}/send-wecom?dryRun=1`,
    base
  );
  return {
    init: {
      headers: { "x-cron-secret": cronSecret },
      method: "POST" as const,
    },
    url: url.toString(),
  };
}

export async function previewWeComIssue({
  env = process.env,
  fetchImpl = fetch,
  issueId,
}: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  issueId: string;
}) {
  const request = buildPreviewRequest({
    automationUrl: env.VISUAL_RADAR_AUTOMATION_URL,
    cronSecret: env.CRON_SECRET,
    issueId,
  });
  const response = await fetchImpl(request.url, request.init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`WeCom preview failed: HTTP ${response.status} ${detail}`.trim());
  }

  const payload = await response.json() as { markdown?: unknown; sent?: unknown };
  if (typeof payload.markdown !== "string" || payload.sent !== false) {
    throw new Error("WeCom preview returned an invalid dry-run response");
  }
  return { markdown: payload.markdown, sent: false as const };
}

function isRealIssueDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

async function main() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  loadProjectEnv(projectRoot);
  const result = await previewWeComIssue({ issueId: process.argv[2] || "" });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
