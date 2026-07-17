import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/pages.yml");
const workflow = fs.existsSync(workflowPath)
  ? fs.readFileSync(workflowPath, "utf-8")
  : "";

describe("GitHub Pages workflow", () => {
  it("exists with the expected triggers, permissions, and concurrency", () => {
    expect(workflow).not.toBe("");
    expect(workflow).toContain("name: Deploy Visual Radar Pages");
    expect(topLevelBlock("on")).toBe(
      "  push:\n    branches: [main]\n  workflow_dispatch:"
    );
    expect(topLevelBlock("permissions")).toBe(
      "  contents: read\n  pages: write\n  id-token: write"
    );
    expect(workflow).toMatch(
      /concurrency:\s*\n\s+group: visual-radar-pages\s*\n\s+cancel-in-progress: true/
    );
  });

  it("builds and uploads the Pages artifact in the required order", () => {
    expect(workflow).toMatch(/build:\s*\n\s+runs-on: ubuntu-latest/);

    expectInOrder(workflow, [
      "uses: actions/checkout@v6",
      "uses: pnpm/action-setup@v4",
      "version: 11.9.0",
      "uses: actions/setup-node@v4",
      "node-version: 22",
      "cache: pnpm",
      "run: pnpm install --frozen-lockfile",
      "run: pnpm test",
      "run: pnpm check",
      "run: pnpm build:pages",
      "uses: actions/configure-pages@v5",
      "uses: actions/upload-pages-artifact@v4",
      "path: dist/public",
    ]);
  });

  it("deploys only after the build job completes", () => {
    expect(workflow).toMatch(
      /deploy:\s*\n\s+needs: build\s*\n\s+runs-on: ubuntu-latest\s*\n\s+environment:\s*\n\s+name: github-pages\s*\n\s+url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/
    );
    expect(workflow).toMatch(
      /- name: Deploy to GitHub Pages\s*\n\s+id: deployment\s*\n\s+uses: actions\/deploy-pages@v4/
    );
  });

  it.each([
    "OPENAI_API_KEY",
    "WECOM_BOT_WEBHOOK",
    "CRON_SECRET",
    "DEPLOYED_URL",
    "wecom",
    "/api/automation/daily",
    "pnpm daily",
    "curl ",
  ])("does not reference forbidden deployment concern %s", (forbidden) => {
    expect(workflow.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });
});

function expectInOrder(contents: string, fragments: string[]) {
  let previousIndex = -1;

  for (const fragment of fragments) {
    const index = contents.indexOf(fragment, previousIndex + 1);
    expect(index, `Expected ${JSON.stringify(fragment)} after the prior step`).toBeGreaterThan(
      previousIndex
    );
    previousIndex = index;
  }
}

function topLevelBlock(key: string) {
  const match = workflow.match(new RegExp(`^${key}:\\n((?:  .*(?:\\n|$))*)`, "m"));
  return match?.[1].trimEnd() ?? "";
}
