import fs from "node:fs";
import path from "node:path";

import {
  summarizeVisualRadarIssue,
  type VisualRadarIssue,
} from "./visualRadarIssue";

export type VisualRadarStaticSiteFileSystem = Pick<
  typeof fs,
  | "existsSync"
  | "mkdirSync"
  | "mkdtempSync"
  | "readdirSync"
  | "renameSync"
  | "rmSync"
  | "writeFileSync"
>;

export interface VisualRadarStaticIssueStore {
  listIssues(): readonly VisualRadarIssue[];
}

export function writeVisualRadarStaticSite(options: {
  fileSystem?: VisualRadarStaticSiteFileSystem;
  issueStore: VisualRadarStaticIssueStore;
  now?: string;
  outputDir: string;
}) {
  const fileSystem = options.fileSystem || fs;
  const outputDir = path.resolve(options.outputDir);
  const parentDir = path.dirname(outputDir);
  const outputName = path.basename(outputDir);
  const backupDir = path.join(parentDir, `.${outputName}.backup`);
  const temporaryPrefix = `.${outputName}-tmp-`;
  fileSystem.mkdirSync(parentDir, { recursive: true });
  recoverPreviousPublish(fileSystem, outputDir, backupDir);
  cleanupStaleTemporaryDirectories(fileSystem, parentDir, temporaryPrefix);

  const issues = [...structuredClone(options.issueStore.listIssues())].sort(
    (left, right) => right.generatedAt.localeCompare(left.generatedAt)
  );
  validateIssueIds(issues);

  const temporaryDir = fileSystem.mkdtempSync(
    path.join(parentDir, temporaryPrefix)
  );
  try {
    writeSnapshot(fileSystem, temporaryDir, issues, options.now);
    replaceOutputRecoverably(fileSystem, temporaryDir, outputDir, backupDir);
    return { issues: issues.length, latestIssueId: issues[0]?.id || null };
  } finally {
    tryRemove(fileSystem, temporaryDir);
  }
}

function cleanupStaleTemporaryDirectories(
  fileSystem: VisualRadarStaticSiteFileSystem,
  parentDir: string,
  temporaryPrefix: string
) {
  const entries = fileSystem.readdirSync(parentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(temporaryPrefix)) continue;
    const staleDirectory = path.resolve(parentDir, entry.name);
    if (path.dirname(staleDirectory) !== parentDir) continue;
    try {
      fileSystem.rmSync(staleDirectory, { force: true, recursive: true });
    } catch (cause) {
      throw new Error(
        `Failed to clean stale Visual Radar temp directory: ${staleDirectory}`,
        { cause }
      );
    }
  }
}

function recoverPreviousPublish(
  fileSystem: VisualRadarStaticSiteFileSystem,
  outputDir: string,
  backupDir: string
) {
  if (!fileSystem.existsSync(backupDir)) return;
  if (fileSystem.existsSync(outputDir)) {
    fileSystem.rmSync(backupDir, { force: true, recursive: true });
    return;
  }
  fileSystem.renameSync(backupDir, outputDir);
}

function writeSnapshot(
  fileSystem: VisualRadarStaticSiteFileSystem,
  temporaryDir: string,
  issues: VisualRadarIssue[],
  now: string | undefined
) {
  const issuesDir = path.resolve(temporaryDir, "issues");
  fileSystem.mkdirSync(issuesDir, { recursive: true });
  writeJson(
    fileSystem,
    path.join(issuesDir, "index.json"),
    issues.map(summarizeVisualRadarIssue)
  );
  issues.forEach((issue, index) => {
    writeJson(fileSystem, resolveIssueFilePath(issuesDir, issue.id), {
      issue,
      navigation: {
        nextId: index > 0 ? issues[index - 1].id : null,
        previousId: index < issues.length - 1 ? issues[index + 1].id : null,
      },
    });
  });
  writeJson(fileSystem, path.join(temporaryDir, "site.json"), {
    generatedAt: now || new Date().toISOString(),
    latestIssueId: issues[0]?.id || null,
  });
}

// This build-time replacement is recoverable, but it is not an OS-level atomic directory exchange.
function replaceOutputRecoverably(
  fileSystem: VisualRadarStaticSiteFileSystem,
  temporaryDir: string,
  outputDir: string,
  backupDir: string
) {
  const hadOutput = fileSystem.existsSync(outputDir);
  if (hadOutput) fileSystem.renameSync(outputDir, backupDir);
  try {
    fileSystem.renameSync(temporaryDir, outputDir);
  } catch (publishError) {
    if (hadOutput && fileSystem.existsSync(backupDir) && !fileSystem.existsSync(outputDir)) {
      try {
        fileSystem.renameSync(backupDir, outputDir);
      } catch {
        // Preserve the original publish error; the backup remains recoverable next run.
      }
    }
    throw publishError;
  }
  if (hadOutput) tryRemove(fileSystem, backupDir);
}

function validateIssueIds(issues: readonly VisualRadarIssue[]) {
  const seen = new Set<string>();
  for (const issue of issues) {
    if (!isCalendarDateId(issue.id) || seen.has(issue.id)) {
      throw new Error(`Invalid Visual Radar issue id: ${JSON.stringify(issue.id)}`);
    }
    seen.add(issue.id);
  }
}

function isCalendarDateId(issueId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueId)) return false;
  const parsed = new Date(`${issueId}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === issueId;
}

function resolveIssueFilePath(issuesDir: string, issueId: string) {
  const target = path.resolve(issuesDir, `${issueId}.json`);
  const relative = path.relative(issuesDir, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Invalid Visual Radar issue id: ${JSON.stringify(issueId)}`);
  }
  return target;
}

function tryRemove(fileSystem: VisualRadarStaticSiteFileSystem, target: string) {
  try {
    fileSystem.rmSync(target, { force: true, recursive: true });
  } catch {
    // The next run reports stale temp cleanup failures and retries backup recovery.
  }
}

function writeJson(
  fileSystem: VisualRadarStaticSiteFileSystem,
  filePath: string,
  value: unknown
) {
  fileSystem.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
