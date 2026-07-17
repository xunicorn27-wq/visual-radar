import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowsDir = path.resolve(process.cwd(), ".github/workflows");
const dailyWorkflowPath = path.join(workflowsDir, "daily.yml");
const pagesWorkflowPath = path.join(workflowsDir, "pages.yml");
const pagesWorkflow = fs.existsSync(pagesWorkflowPath)
  ? fs.readFileSync(pagesWorkflowPath, "utf-8")
  : "";

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
