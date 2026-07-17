import fs from "node:fs";
import path from "node:path";

import {
  type createVisualRadarIssueStore,
  summarizeVisualRadarIssue,
} from "./visualRadarIssue";
import { getVisualRadarIssueDetail } from "./visualRadarWorkflow";

type VisualRadarIssueStore = ReturnType<typeof createVisualRadarIssueStore>;

export function writeVisualRadarStaticSite(options: {
  issueStore: VisualRadarIssueStore;
  now?: string;
  outputDir: string;
}) {
  const outputDir = path.resolve(options.outputDir);
  const parentDir = path.dirname(outputDir);
  const outputName = path.basename(outputDir);
  fs.mkdirSync(parentDir, { recursive: true });
  const temporaryDir = fs.mkdtempSync(path.join(parentDir, `.${outputName}-tmp-`));
  let backupDir: string | null = null;

  try {
    const issues = options.issueStore.listIssues();
    const latestIssueId = issues[0]?.id || null;
    const issuesDir = path.join(temporaryDir, "issues");
    fs.mkdirSync(issuesDir, { recursive: true });
    writeJson(
      path.join(issuesDir, "index.json"),
      issues.map(summarizeVisualRadarIssue)
    );
    for (const issue of issues) {
      writeJson(
        path.join(issuesDir, `${issue.id}.json`),
        getVisualRadarIssueDetail(options.issueStore, issue.id)
      );
    }
    writeJson(path.join(temporaryDir, "site.json"), {
      generatedAt: options.now || new Date().toISOString(),
      latestIssueId,
    });

    if (fs.existsSync(outputDir)) {
      backupDir = `${temporaryDir}-previous`;
      fs.renameSync(outputDir, backupDir);
    }
    try {
      fs.renameSync(temporaryDir, outputDir);
    } catch (error) {
      if (backupDir && fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, outputDir);
        backupDir = null;
      }
      throw error;
    }
    if (backupDir) {
      fs.rmSync(backupDir, { force: true, recursive: true });
      backupDir = null;
    }
    return { issueCount: issues.length, latestIssueId };
  } finally {
    fs.rmSync(temporaryDir, { force: true, recursive: true });
    if (backupDir && fs.existsSync(backupDir) && !fs.existsSync(outputDir)) {
      fs.renameSync(backupDir, outputDir);
    }
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
