import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/pages.yml");
const workflow = fs.existsSync(workflowPath)
  ? fs.readFileSync(workflowPath, "utf-8")
  : "";
const jobs = yamlBlock(workflow, "jobs", 0);
const buildJob = withoutYamlComments(yamlBlock(jobs, "build", 2));
const deployJob = withoutYamlComments(yamlBlock(jobs, "deploy", 2));

describe("GitHub Pages workflow", () => {
  it("uses only the expected main branch triggers and production concurrency", () => {
    expect(workflow).not.toBe("");
    expect(workflow).toContain("name: Deploy Visual Radar Pages");
    expect(yamlBlock(workflow, "on", 0)).toBe(
      "  push:\n    branches: [main]\n  workflow_dispatch:"
    );
    expect(yamlBlock(workflow, "concurrency", 0)).toBe(
      "  group: visual-radar-pages\n  cancel-in-progress: false"
    );
  });

  it("keeps elevated permissions out of the workflow scope", () => {
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).not.toMatch(/^permissions:\s*\n\s+(?:pages|id-token):/m);
  });

  it("builds on main with read-only contents permission", () => {
    expect(buildJob).toContain("    if: github.ref == 'refs/heads/main'");
    expect(yamlBlock(buildJob, "permissions", 4).trim()).toBe("contents: read");
    expect(buildJob).toContain("    runs-on: ubuntu-latest");

    expectInOrder(buildJob, [
      "uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
      "uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
      "version: 11.9.0",
      "uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "node-version: 22",
      "cache: pnpm",
      "run: pnpm install --frozen-lockfile",
      "run: pnpm test",
      "run: pnpm check",
      "run: pnpm build:pages",
      "uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b",
      "uses: actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b",
      "path: dist/public",
    ]);
  });

  it("deploys after build with only Pages identity permissions", () => {
    expect(deployJob).toContain("    needs: build");
    expect(deployJob).toContain("    runs-on: ubuntu-latest");
    expect(yamlBlock(deployJob, "permissions", 4).trim()).toBe(
      "pages: write\n      id-token: write"
    );
    expect(deployJob).toMatch(
      /environment:\s*\n\s+name: github-pages\s*\n\s+url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/
    );
    expectInOrder(deployJob, [
      "- name: Deploy to GitHub Pages",
      "id: deployment",
      "uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
    ]);
  });

  it.each([
    /\$\{\{\s*secrets\./i,
    /github\.token|GITHUB_TOKEN/i,
    /\b(?:curl|wget)\b/i,
    /WECOM|OPENAI|CRON|DEPLOYED/i,
    /\/api\/[^\s"']*daily|daily[^\n]*api/i,
  ])("does not contain forbidden secret or external trigger %s", (forbidden) => {
    expect(workflow).not.toMatch(forbidden);
  });

  it("pins every third-party action to a full commit SHA", () => {
    const actionReferences = Array.from(
      workflow.matchAll(/^\s+uses:\s+([^#\s]+)(?:\s+#.*)?$/gm),
      (match) => match[1]
    );

    expect(actionReferences).not.toHaveLength(0);
    expect(actionReferences.every((reference) => /@[0-9a-f]{40}$/.test(reference))).toBe(
      true
    );
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
