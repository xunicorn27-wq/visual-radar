import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowsDir = path.resolve(process.cwd(), ".github/workflows");
const dailyWorkflowPath = path.join(workflowsDir, "daily.yml");
const pagesWorkflowPath = path.join(workflowsDir, "pages.yml");
const pagesWorkflow = fs.existsSync(pagesWorkflowPath)
  ? fs.readFileSync(pagesWorkflowPath, "utf-8")
  : "";
const jobs = yamlBlock(pagesWorkflow, "jobs", 0);

describe("GitHub automation boundary", () => {
  it("removes the API-dependent daily workflow", () => {
    expect(fs.existsSync(dailyWorkflowPath)).toBe(false);
  });

  it("keeps GitHub automation limited to static Pages deployment", () => {
    const workflows = fs
      .readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
      .sort();

    expect(workflows).toEqual(["pages.yml"]);
    expect(pagesWorkflow).toContain("name: Deploy Visual Radar Pages");
    expect(pagesWorkflow).toContain("actions/upload-pages-artifact@");
    expect(pagesWorkflow).toContain("actions/deploy-pages@");
  });

  it("allows only the static Pages build and deploy jobs", () => {
    expect(yamlKeys(jobs, 2)).toEqual(["build", "deploy"]);
  });

  it("allows only the reviewed Pages actions", () => {
    expect(yamlValues(pagesWorkflow, "uses")).toEqual([
      "actions/checkout@v6",
      "pnpm/action-setup@v4",
      "actions/setup-node@v4",
      "actions/configure-pages@v5",
      "actions/upload-pages-artifact@v4",
      "actions/deploy-pages@v4",
    ]);
  });

  it("allows only install, test, typecheck and Pages build commands", () => {
    expect(yamlValues(pagesWorkflow, "run")).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm test",
      "pnpm check",
      "pnpm build:pages",
    ]);
  });

  it("does not expose an environment-variable channel", () => {
    expect(pagesWorkflow).not.toMatch(/^\s*env:/m);
  });

  it.each([
    /\/api\/automation\/daily/i,
    /send-wecom/i,
    /\bsecrets\b/i,
    /CRON_SECRET/i,
    /DEPLOYED_URL/i,
    /OPENAI/i,
    /WECOM/i,
  ])("keeps the Pages workflow free of runtime automation dependency %s", (forbidden) => {
    expect(pagesWorkflow).not.toMatch(forbidden);
  });
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

function yamlKeys(contents: string, indent: number) {
  const prefix = " ".repeat(indent);
  return contents
    .split("\n")
    .filter((line) => line.startsWith(prefix) && !line.startsWith(`${prefix} `))
    .map((line) => line.slice(indent).match(/^([A-Za-z0-9_-]+):/)?.[1])
    .filter((key): key is string => Boolean(key));
}

function yamlValues(contents: string, key: string) {
  const pattern = new RegExp(`^\\s+${key}:\\s+([^#\\n]+?)\\s*$`, "gm");
  return Array.from(contents.matchAll(pattern), (match) => match[1].trim());
}
