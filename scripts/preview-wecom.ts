import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import {
  createVisualRadarIssueStore,
  type VisualRadarIssue,
} from "../server/visualRadarIssue";
import { buildWeComMarkdownContent } from "../server/weComPublisher";

export function previewWeComIssue({
  getIssue,
  issueId,
  publicUrl,
}: {
  getIssue: (issueId: string) => VisualRadarIssue | null;
  issueId: string;
  publicUrl: string | null | undefined;
}) {
  const normalizedIssueId = issueId.trim();
  if (!isRealIssueDate(normalizedIssueId)) {
    throw new Error("Issue ID must be a real YYYY-MM-DD date");
  }
  const normalizedPublicUrl = normalizePublicUrl(publicUrl);
  const issue = getIssue(normalizedIssueId);
  if (!issue) {
    throw new Error(`Visual Radar issue not found: ${normalizedIssueId}`);
  }
  return {
    markdown: buildWeComMarkdownContent(issue, normalizedPublicUrl),
    sent: false as const,
  };
}

function normalizePublicUrl(value: string | null | undefined) {
  let url: URL;
  try {
    url = new URL(value?.trim() || "");
  } catch {
    throw new Error("VISUAL_RADAR_PUBLIC_URL must be a valid HTTP or HTTPS URL");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("VISUAL_RADAR_PUBLIC_URL must be a valid HTTP or HTTPS URL");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}`;
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

function main() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  loadProjectEnv(projectRoot);
  const files = resolveProjectPaths(projectRoot);
  const issueStore = createVisualRadarIssueStore(files.issues);
  const result = previewWeComIssue({
    getIssue: (issueId) => issueStore.getIssue(issueId),
    issueId: process.argv[2] || "",
    publicUrl: process.env.VISUAL_RADAR_PUBLIC_URL,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
