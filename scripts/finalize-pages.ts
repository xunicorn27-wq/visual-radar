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
  const seen = new Set<string>();

  for (const issueId of issueIds) {
    if (!isCalendarDateId(issueId)) {
      throw new Error(`Invalid Visual Radar issue id: ${JSON.stringify(issueId)}`);
    }
    if (seen.has(issueId)) {
      throw new Error(`Duplicate Visual Radar issue id: ${JSON.stringify(issueId)}`);
    }
    seen.add(issueId);
  }

  const html = fs.readFileSync(resolveWithin(resolvedDistDir, "index.html"), "utf-8");
  const issuesDir = resolveWithin(resolvedDistDir, "issues");
  fs.rmSync(issuesDir, { force: true, recursive: true });
  fs.mkdirSync(issuesDir, { recursive: true });
  fs.writeFileSync(resolveWithin(issuesDir, "index.html"), withPageMeta(html, "往期日报", "按主题、月份和关键词探索 Visual Radar 往期摄影推送。"), "utf-8");
  const savedDir = resolveWithin(resolvedDistDir, "saved");
  fs.rmSync(savedDir, { force: true, recursive: true });
  fs.mkdirSync(savedDir, { recursive: true });
  fs.writeFileSync(resolveWithin(savedDir, "index.html"), withPageMeta(html, "我的收藏", "保存在本机的 Visual Radar 收藏与个人备注。"), "utf-8");

  for (const issueId of issueIds) {
    const routeDir = resolveWithin(issuesDir, issueId);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(resolveWithin(routeDir, "index.html"), withPageMeta(html, `${issueId} 摄影推送`, `${issueId} 的摄影、造型与创作观察，阅读本期精选与完整报道。`), "utf-8");
  }
}

function withPageMeta(html: string, title: string, description: string) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escape(title)} · Visual Radar</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(description)}" />`);
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
