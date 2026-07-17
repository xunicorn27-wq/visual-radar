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
const reviewedPagesWorkflow = `
name: Deploy Visual Radar Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions: {}

concurrency:
  group: visual-radar-pages
  cancel-in-progress: false

jobs:
  build:
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
      - name: Set up pnpm
        uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
        with:
          version: 11.9.0
      - name: Set up Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run tests
        run: pnpm test
      - name: Check types
        run: pnpm check
      - name: Build GitHub Pages site
        run: pnpm build:pages
      - name: Configure GitHub Pages
        uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b # v5
      - name: Upload GitHub Pages artifact
        uses: actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b # v4
        with:
          path: dist/public

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
`;

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

  it("matches the full workflow snapshot; updates require security review", () => {
    expect(
      normalizeWorkflow(pagesWorkflow),
      "Changing the Pages workflow snapshot requires a new security review."
    ).toBe(normalizeWorkflow(reviewedPagesWorkflow));
  });

  it("allows only the static Pages build and deploy jobs", () => {
    expect(yamlKeys(jobs, 2)).toEqual(["build", "deploy"]);
  });

  it("allows only the reviewed Pages actions", () => {
    expect(yamlValues(pagesWorkflow, "uses")).toEqual([
      "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
      "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b",
      "actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b",
      "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
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
  const pattern = new RegExp(
    `^\\s+${key}:\\s+([^#\\n]+?)(?:\\s+#.*)?$`,
    "gm"
  );
  return Array.from(contents.matchAll(pattern), (match) => match[1].trim());
}

function normalizeWorkflow(contents: string) {
  return contents
    .replace(/\\r\\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
