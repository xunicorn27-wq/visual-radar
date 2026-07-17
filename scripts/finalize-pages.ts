import fs from "node:fs";
import path from "node:path";

export function finalizePagesBuild({
  distDir,
  issueIds,
}: {
  distDir: string;
  issueIds: string[];
}) {
  const resolvedDistDir = path.resolve(distDir);
  const routes = ["issues"];
  const seen = new Set<string>();

  for (const issueId of issueIds) {
    if (!isCalendarDateId(issueId)) {
      throw new Error(`Invalid Visual Radar issue id: ${JSON.stringify(issueId)}`);
    }
    if (seen.has(issueId)) {
      throw new Error(`Duplicate Visual Radar issue id: ${JSON.stringify(issueId)}`);
    }
    seen.add(issueId);
    routes.push(path.join("issues", issueId));
  }

  const routeDirs = routes.map((route) => resolveWithin(resolvedDistDir, route));
  const html = fs.readFileSync(resolveWithin(resolvedDistDir, "index.html"), "utf-8");

  for (const routeDir of routeDirs) {
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(resolveWithin(routeDir, "index.html"), html, "utf-8");
  }
}

function isCalendarDateId(issueId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueId)) return false;
  const parsed = new Date(`${issueId}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === issueId;
}

function resolveWithin(parentDir: string, childPath: string) {
  const resolvedParent = path.resolve(parentDir);
  const target = path.resolve(resolvedParent, childPath);
  const relative = path.relative(resolvedParent, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Path escapes Pages build directory: ${JSON.stringify(childPath)}`);
  }
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const summaries = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, ".pages-public", "public-data", "issues", "index.json"),
      "utf-8"
    )
  ) as Array<{ id: string }>;
  finalizePagesBuild({
    distDir: path.join(projectRoot, "dist", "public"),
    issueIds: summaries.map((issue) => issue.id),
  });
}
