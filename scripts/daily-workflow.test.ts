import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/daily.yml");
const workflow = fs.existsSync(workflowPath)
  ? fs.readFileSync(workflowPath, "utf-8")
  : "";
const triggerJob = withoutYamlComments(yamlBlock(workflow, "trigger", 2));

describe("manual daily dry-run workflow", () => {
  it("has only a parameter-free manual trigger", () => {
    expect(workflow).not.toBe("");
    expect(workflow).toContain("name: Visual Radar Manual Dry Run");
    expect(yamlBlock(workflow, "on", 0)).toBe("  workflow_dispatch:");
    expect(workflow).not.toMatch(/\bschedule:|\bcron:|\binputs:/);
  });

  it("uses read-only permissions and non-cancelling concurrency", () => {
    expect(yamlBlock(workflow, "permissions", 0).trim()).toBe("contents: read");
    expect(yamlBlock(workflow, "concurrency", 0)).toBe(
      "  group: visual-radar-daily\n  cancel-in-progress: false"
    );
  });

  it("always posts the deployed daily endpoint as a dry-run", () => {
    expect(triggerJob).toContain("- name: Manual Dry Run deployed Visual Radar");
    expect(triggerJob).toContain("--request POST");
    expect(triggerJob).toContain('--header "x-cron-secret: $CRON_SECRET"');
    expect(triggerJob).toContain(
      '"$DEPLOYED_URL/api/automation/daily?dryRun=1"'
    );

    const dailyEndpoints = workflow.match(/\/api\/automation\/daily[^\s"']*/g) ?? [];
    expect(dailyEndpoints).toEqual(["/api/automation/daily?dryRun=1"]);
  });

  it.each([/send-wecom/i, /WECOM/, /OPENAI/, /MANUAL_DRY_RUN|inputs\.dry_run/])(
    "does not contain a formal-send capability %s",
    (forbidden) => {
      expect(workflow).not.toMatch(forbidden);
    }
  );
});

function yamlBlock(contents: string, key: string, indent: number) {
  const lines = contents.split("\n");
  const header = `${" ".repeat(indent)}${key}:`;
  const start = lines.findIndex((line) => line === header);

  if (start === -1) return "";

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      body.push(line);
      continue;
    }

    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent <= indent) break;
    body.push(line);
  }

  return body.join("\n").trimEnd();
}

function withoutYamlComments(contents: string) {
  return contents
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .map((line) => line.replace(/\s+#.*$/, ""))
    .join("\n");
}
