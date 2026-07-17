# Visual Radar Codex + GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Visual Radar 在没有 OpenAI API Key 时由 Codex 导入分析结果，并将已有日报构建成可由 GitHub Pages 公开访问的静态站点。

**Architecture:** Express 继续负责本地采集、日报生成和企业微信发送；Codex 通过结构化输出文件和校验器写入分析结果；Pages 构建从日报存档生成只读 JSON，并让 React 在静态模式读取这些 JSON。GitHub Actions 仅测试、构建和部署，不调用模型或企业微信。

**Tech Stack:** TypeScript、Node.js 22、React 19、Vite 7、Express 4、Vitest、wouter、pnpm、GitHub Actions、GitHub Pages

---

## 文件结构

- `server/visualRadarAgentOutput.ts`：定义 Codex 输出格式、校验候选身份并合并分析。
- `server/visualRadarAgentOutput.test.ts`：覆盖合法导入、未知候选、哈希不匹配和原数据不变。
- `scripts/import-agent-output.ts`：从项目数据目录读取 Agent 批次和输出并安全写入分析存档。
- `server/paths.ts`：增加 `visual_radar_agent_output.json` 路径。
- `server/visualRadarStaticSite.ts`：从日报存档生成 Pages 公开数据快照。
- `server/visualRadarStaticSite.test.ts`：覆盖索引、详情和前后期导航。
- `scripts/generate-static-site.ts`：生成 `.pages-public/public-data`。
- `scripts/finalize-pages.ts`：为 `/issues/` 和每期详情生成可直达的 HTML 入口。
- `client/src/lib/api.ts`：为公开读接口增加 API/静态双数据源。
- `client/src/lib/api.test.ts`：验证 Pages 子路径下的静态请求地址。
- `client/src/pages/VisualRadar.tsx`：静态模式只加载最新日报并隐藏后台操作区。
- `client/src/main.tsx`：配置 wouter 的 Pages base path。
- `vite.config.ts`：支持 Pages base 和构建期静态 publicDir。
- `package.json`：增加 Agent 导入、静态快照和 Pages 构建命令。
- `.gitignore`：忽略 Codex 临时输出和 Pages 中间目录。
- `.github/workflows/pages.yml`：测试、构建并部署 GitHub Pages。
- `.github/workflows/daily.yml`：移除当前不适用的无人值守 schedule，仅保留手动 dry-run。
- `README.md`、`docs/GITHUB上传指南.md`、`docs/企业微信推送指南.md`、`docs/定时推送指南.md`：记录无 Key 半自动流程。

### Task 1: 安全导入 Codex 分析结果

**Files:**
- Create: `server/visualRadarAgentOutput.ts`
- Create: `server/visualRadarAgentOutput.test.ts`
- Create: `scripts/import-agent-output.ts`
- Modify: `server/paths.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: 写失败测试，定义 Codex 输出契约**

在 `server/visualRadarAgentOutput.test.ts` 创建以下测试：

```ts
import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { importVisualRadarAgentOutput } from "./visualRadarAgentOutput";

const candidate = createIntelItem({
  capturedAt: "2026-07-17T01:00:00.000Z",
  hashtags: [],
  id: "candidate-1",
  keywords: ["photography"],
  lang: "en",
  market: "global",
  mediaUrls: [],
  metrics: emptyIntelMetrics(),
  postedAt: "2026-07-17T00:30:00.000Z",
  provenance: { authenticity: "live", label: "真实采集" },
  signalType: "inspiration_signal",
  source: "website",
  sourceAccount: "Example",
  sourceType: "inspiration",
  sourceUrl: "https://example.com/story",
  text: "A photography story.",
  thumbnailUrl: null,
  title: "Photography story",
});

const batch = {
  candidates: [candidate],
  generatedAt: "2026-07-17T01:00:00.000Z",
  instructions: [],
  stage: "value_screening" as const,
  status: "prepared" as const,
  summary: { cached: 0, candidates: 1, excluded: 0, total: 1 },
};

const current = {
  analyses: [],
  failures: [],
  generatedAt: "2026-07-17T01:00:00.000Z",
  promptVersion: "visual-daily-v1",
};

const output = {
  analyses: [{
    itemId: candidate.id,
    contentHash: candidate.contentHash,
    chineseSummary: "这是一条摄影文化摘要。",
    chineseTitle: "摄影文化标题",
    primaryTopic: "photography",
    scoreBreakdown: {
      informationSpecificity: 12,
      novelty: 16,
      professionalRelevance: 16,
      sourceQuality: 8,
      timeliness: 5,
      visualInspiration: 25,
    },
    selectionRationale: "具有明确的视觉参考价值。",
    trendKeywords: ["摄影", "视觉文化"],
  }],
  generatedAt: "2026-07-17T02:00:00.000Z",
  model: "codex-agent",
  promptVersion: "visual-daily-v1",
  schemaVersion: "1" as const,
};

describe("importVisualRadarAgentOutput", () => {
  it("normalizes and merges analyses for prepared candidates", () => {
    const result = importVisualRadarAgentOutput({ batch, current, output });
    expect(result.summary).toEqual({ imported: 1, submitted: 1 });
    expect(result.artifact.analyses[0]).toMatchObject({
      itemId: "candidate-1",
      model: "codex-agent",
      score: 82,
      status: "success",
    });
  });

  it("rejects an item that is not in the prepared batch", () => {
    expect(() => importVisualRadarAgentOutput({
      batch,
      current,
      output: { ...output, analyses: [{ ...output.analyses[0], itemId: "unknown" }] },
    })).toThrow("Agent 输出包含未知候选：unknown");
  });

  it("rejects a stale content hash without mutating current data", () => {
    expect(() => importVisualRadarAgentOutput({
      batch,
      current,
      output: {
        ...output,
        analyses: [{ ...output.analyses[0], contentHash: "sha256:stale" }],
      },
    })).toThrow("Agent 输出内容哈希不匹配：candidate-1");
    expect(current.analyses).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run server/visualRadarAgentOutput.test.ts`

Expected: FAIL，错误包含 `Cannot find module './visualRadarAgentOutput'`。

- [ ] **Step 3: 实现输出类型、校验和安全合并**

创建 `server/visualRadarAgentOutput.ts`：

```ts
import {
  VISUAL_ANALYSIS_PROMPT_VERSION,
  normalizeVisualRadarAnalysis,
  type RawVisualRadarAnalysis,
  type VisualRadarAnalysisArtifact,
} from "./visualRadarAnalysis";
import { mergeVisualRadarAnalysisArtifact } from "./visualRadarAnalysisStore";
import type { VisualRadarAgentBatch } from "./visualRadarAgentBatch";

export interface VisualRadarAgentOutput {
  analyses: Array<RawVisualRadarAnalysis & {
    contentHash: string;
    itemId: string;
  }>;
  generatedAt: string;
  model: "codex-agent";
  promptVersion: string;
  schemaVersion: "1";
}

export function importVisualRadarAgentOutput({
  batch,
  current,
  output,
}: {
  batch: VisualRadarAgentBatch;
  current: VisualRadarAnalysisArtifact;
  output: VisualRadarAgentOutput;
}) {
  if (output.schemaVersion !== "1") throw new Error("Agent 输出版本不支持");
  if (output.promptVersion !== VISUAL_ANALYSIS_PROMPT_VERSION) {
    throw new Error("Agent 输出 Prompt 版本不匹配");
  }

  const candidates = new Map(batch.candidates.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const analyses = output.analyses.map((raw) => {
    const item = candidates.get(raw.itemId);
    if (!item) throw new Error(`Agent 输出包含未知候选：${raw.itemId}`);
    if (item.contentHash !== raw.contentHash) {
      throw new Error(`Agent 输出内容哈希不匹配：${raw.itemId}`);
    }
    if (seen.has(raw.itemId)) throw new Error(`Agent 输出候选重复：${raw.itemId}`);
    seen.add(raw.itemId);
    return normalizeVisualRadarAnalysis(raw, {
      analyzedAt: output.generatedAt,
      contentHash: item.contentHash,
      itemId: item.id,
      model: output.model,
      promptVersion: output.promptVersion,
    });
  });

  return {
    artifact: mergeVisualRadarAnalysisArtifact(current, {
      analyses,
      failures: [],
      generatedAt: output.generatedAt,
      promptVersion: output.promptVersion,
    }),
    summary: { imported: analyses.length, submitted: output.analyses.length },
  };
}
```

- [ ] **Step 4: 增加路径和导入脚本**

在 `server/paths.ts` 返回对象中增加：

```ts
agentOutput: path.join(dataDir, "visual_radar_agent_output.json"),
```

创建 `scripts/import-agent-output.ts`：

```ts
import fs from "node:fs";
import path from "node:path";

import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import type { VisualRadarAgentBatch } from "../server/visualRadarAgentBatch";
import {
  importVisualRadarAgentOutput,
  type VisualRadarAgentOutput,
} from "../server/visualRadarAgentOutput";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifact,
} from "../server/visualRadarAnalysisStore";

const projectRoot = path.resolve(import.meta.dirname, "..");
loadProjectEnv(projectRoot);
const files = resolveProjectPaths(projectRoot);

const batch = JSON.parse(fs.readFileSync(files.agentBatch, "utf-8")) as VisualRadarAgentBatch;
const output = JSON.parse(fs.readFileSync(files.agentOutput, "utf-8")) as VisualRadarAgentOutput;
const result = importVisualRadarAgentOutput({
  batch,
  current: readVisualRadarAnalysisArtifact(files.analysis),
  output,
});
writeVisualRadarAnalysisArtifact(files.analysis, result.artifact);
console.log(JSON.stringify(result.summary, null, 2));
```

在 `package.json` 的 scripts 增加：

```json
"agent:import": "tsx scripts/import-agent-output.ts"
```

在 `.gitignore` 增加：

```gitignore
data/visual_radar_agent_output.json
.pages-public/
```

- [ ] **Step 5: 运行聚焦测试和类型检查**

Run: `pnpm vitest run server/visualRadarAgentOutput.test.ts && pnpm check`

Expected: 测试 PASS，`tsc --noEmit` 退出码为 0。

- [ ] **Step 6: 提交 Task 1**

```bash
git add .gitignore package.json scripts/import-agent-output.ts server/paths.ts server/visualRadarAgentOutput.ts server/visualRadarAgentOutput.test.ts
git commit -m "Add validated Codex analysis import"
```

### Task 2: 生成 GitHub Pages 静态日报快照

**Files:**
- Create: `server/visualRadarStaticSite.ts`
- Create: `server/visualRadarStaticSite.test.ts`
- Create: `scripts/generate-static-site.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试，定义公开快照结构**

创建 `server/visualRadarStaticSite.test.ts`，使用两个测试日报写入临时 issue store，并断言：

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createVisualRadarIssueStore, type VisualRadarIssue } from "./visualRadarIssue";
import { writeVisualRadarStaticSite } from "./visualRadarStaticSite";

describe("writeVisualRadarStaticSite", () => {
  it("writes issue index and navigable detail files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-static-"));
    const store = createVisualRadarIssueStore(path.join(root, "issues.json"));
    store.saveIssue(issue("2026-07-16"));
    store.saveIssue(issue("2026-07-17"));

    const summary = writeVisualRadarStaticSite({
      issueStore: store,
      outputDir: path.join(root, "public-data"),
    });

    expect(summary).toEqual({ issues: 2, latestIssueId: "2026-07-17" });
    expect(JSON.parse(fs.readFileSync(
      path.join(root, "public-data/issues/index.json"), "utf-8"
    ))).toHaveLength(2);
    expect(JSON.parse(fs.readFileSync(
      path.join(root, "public-data/issues/2026-07-17.json"), "utf-8"
    )).navigation).toEqual({ nextId: null, previousId: "2026-07-16" });
  });
});

function issue(id: string): VisualRadarIssue {
  return {
    featuredStoryIds: [],
    generatedAt: `${id}T02:00:00.000Z`,
    id,
    issueDate: id,
    metadata: { models: ["codex-agent"], promptVersion: "visual-daily-v1" },
    skipped: [],
    stats: { bySource: {}, byTopic: {}, storyCount: 0 },
    stories: [],
    title: `Visual Radar Daily - ${id}`,
  };
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run server/visualRadarStaticSite.test.ts`

Expected: FAIL，错误包含 `Cannot find module './visualRadarStaticSite'`。

- [ ] **Step 3: 实现原子化静态快照写入**

创建 `server/visualRadarStaticSite.ts`：

```ts
import fs from "node:fs";
import path from "node:path";

import {
  summarizeVisualRadarIssue,
  type createVisualRadarIssueStore,
} from "./visualRadarIssue";
import { getVisualRadarIssueDetail } from "./visualRadarWorkflow";

type IssueStore = ReturnType<typeof createVisualRadarIssueStore>;

export function writeVisualRadarStaticSite({
  issueStore,
  outputDir,
}: {
  issueStore: IssueStore;
  outputDir: string;
}) {
  const issues = issueStore.listIssues();
  const tempDir = `${outputDir}.tmp`;
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(tempDir, "issues"), { recursive: true });

  writeJson(path.join(tempDir, "issues", "index.json"), issues.map(summarizeVisualRadarIssue));
  for (const issue of issues) {
    writeJson(
      path.join(tempDir, "issues", `${issue.id}.json`),
      getVisualRadarIssueDetail(issueStore, issue.id)
    );
  }
  writeJson(path.join(tempDir, "site.json"), {
    generatedAt: new Date().toISOString(),
    latestIssueId: issues[0]?.id || null,
  });

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.renameSync(tempDir, outputDir);
  return { issues: issues.length, latestIssueId: issues[0]?.id || null };
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}
```

- [ ] **Step 4: 增加静态快照命令**

创建 `scripts/generate-static-site.ts`：

```ts
import path from "node:path";

import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { writeVisualRadarStaticSite } from "../server/visualRadarStaticSite";

const projectRoot = path.resolve(import.meta.dirname, "..");
const files = resolveProjectPaths(projectRoot);
const summary = writeVisualRadarStaticSite({
  issueStore: createVisualRadarIssueStore(files.issues),
  outputDir: path.join(projectRoot, ".pages-public", "public-data"),
});
console.log(JSON.stringify(summary, null, 2));
```

在 `package.json` 增加：

```json
"pages:data": "tsx scripts/generate-static-site.ts"
```

- [ ] **Step 5: 运行测试、命令并检查历史日报**

Run: `pnpm vitest run server/visualRadarStaticSite.test.ts && pnpm pages:data`

Expected: 测试 PASS，命令输出包含 `"latestIssueId": "2026-07-16"`，且 `.pages-public/public-data/issues/2026-07-16.json` 存在。

- [ ] **Step 6: 提交 Task 2**

```bash
git add package.json scripts/generate-static-site.ts server/visualRadarStaticSite.ts server/visualRadarStaticSite.test.ts
git commit -m "Generate static Visual Radar issue data"
```

### Task 3: 前端支持 API 与 Pages 静态双数据源

**Files:**
- Create: `client/src/lib/api.test.ts`
- Modify: `client/src/lib/api.ts`
- Modify: `client/src/pages/VisualRadar.tsx`

- [ ] **Step 1: 写失败测试，验证静态 URL 使用 Pages base**

在 `client/src/lib/api.ts` 导出纯函数 `buildVisualRadarReadUrl` 后，创建 `client/src/lib/api.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildVisualRadarReadUrl } from "./api";

describe("buildVisualRadarReadUrl", () => {
  it("uses API paths in server mode", () => {
    expect(buildVisualRadarReadUrl("issues", { baseUrl: "/", staticMode: false }))
      .toBe("/api/visual-radar/issues");
  });

  it("uses encoded static files below the Pages repository base", () => {
    expect(buildVisualRadarReadUrl("issue", {
      baseUrl: "/visual-radar/",
      issueId: "2026-07-17",
      staticMode: true,
    })).toBe("/visual-radar/public-data/issues/2026-07-17.json");
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run client/src/lib/api.test.ts`

Expected: FAIL，错误包含 `buildVisualRadarReadUrl` 未导出。

- [ ] **Step 3: 实现静态读地址和只读请求切换**

在 `client/src/lib/api.ts` 增加：

```ts
export const visualRadarStaticMode =
  import.meta.env.VITE_VISUAL_RADAR_DATA_MODE === "static";

type ReadResource = "analysis" | "items" | "issue" | "issues" | "sources";

export function buildVisualRadarReadUrl(
  resource: ReadResource,
  options: { baseUrl: string; issueId?: string; staticMode: boolean }
) {
  if (!options.staticMode) {
    if (resource === "issue") {
      return `/api/visual-radar/issues/${encodeURIComponent(options.issueId || "")}`;
    }
    return `/api/visual-radar/${resource}`;
  }
  const base = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;
  if (resource === "issues") return `${base}public-data/issues/index.json`;
  if (resource === "issue") {
    return `${base}public-data/issues/${encodeURIComponent(options.issueId || "")}.json`;
  }
  throw new Error(`静态站点不提供 ${resource} 数据`);
}

const readOptions = {
  baseUrl: import.meta.env.BASE_URL,
  staticMode: visualRadarStaticMode,
};
```

将日报读函数改为：

```ts
export const getVisualRadarIssues = () =>
  req<VisualRadarIssueSummary[]>(buildVisualRadarReadUrl("issues", readOptions));

export const getVisualRadarIssue = (id: string) =>
  req<VisualRadarIssueDetail>(buildVisualRadarReadUrl("issue", {
    ...readOptions,
    issueId: id,
  }));
```

其余管理和采集函数保持原 API 地址，不在 Pages 页面调用。

- [ ] **Step 4: 让首页静态模式只加载最新日报**

在 `client/src/pages/VisualRadar.tsx`：

```ts
import { visualRadarStaticMode } from "../lib/api";
```

将 `loadPage` 替换为静态和服务端两条明确路径：

```ts
async function loadPage() {
  setLoading(true);
  setError(null);
  try {
    if (visualRadarStaticMode) {
      const issues = await getVisualRadarIssues();
      setIssueDetail(issues[0] ? await getVisualRadarIssue(issues[0].id) : null);
      return;
    }

    const [issues, nextRegistry, nextItems, nextAnalysis] = await Promise.all([
      getVisualRadarIssues(),
      getVisualRadarSources(),
      getVisualRadarItems(),
      getVisualRadarAnalysis(),
    ]);
    setRegistry(nextRegistry);
    setItems(nextItems);
    setAnalysis(nextAnalysis);
    setIssueDetail(issues[0] ? await getVisualRadarIssue(issues[0].id) : null);
  } catch (loadError) {
    setError(loadError instanceof Error ? loadError.message : "Visual Radar 加载失败");
  } finally {
    setLoading(false);
  }
}
```

将 Masthead 管理入口改为：

```tsx
<VisualRadarMasthead
  issueLabel={issueDetail ? `VOL.${issueDetail.issue.id}` : "FIRST EDITION"}
  onToggleAdmin={
    visualRadarStaticMode ? undefined : () => setAdminOpen((open) => !open)
  }
/>
```

将现有管理区条件从 `{adminOpen ? (` 改为：

```tsx
{!visualRadarStaticMode && adminOpen ? (
  <VisualRadarAdmin
    adminSecret={adminSecret}
    busyAction={busyAction}
    error={error}
    metrics={{
      analyzed: analysis?.analyses.length || 0,
      collected: items?.items.length || 0,
      connected: registry?.summary.live || 0,
      failed: (items?.failures.length || 0) + (analysis?.failures.length || 0),
      pending: registry?.summary.planned || 0,
    }}
    onAnalyze={() => void runAction("analyze")}
    onAgentAnalyze={() => void runAction("agent")}
    onClose={() => setAdminOpen(false)}
    onCollect={() => void runAction("collect")}
    onGenerate={() => void runAction("generate")}
    onPublish={() => void runAction("publish")}
    onSecretChange={setAdminSecret}
    status={status}
  />
) : null}
```

将来源统计条替换为：

```tsx
{!visualRadarStaticMode ? (
  <section id="sources" className="vr-source-strip">
    <span>{registry?.summary.live || 0} LIVE SOURCES</span>
    <span>{registry?.summary.planned || 0} IN QUEUE</span>
    <span>{items?.items.length || 0} RAW SIGNALS</span>
    <span>{analysis?.analyses.length || 0} ANALYZED</span>
  </section>
) : null}
```

同时仅在 `!visualRadarStaticMode` 时向 `VisualRadarMasthead` 传入 `onToggleAdmin`。

- [ ] **Step 5: 运行前端聚焦测试和类型检查**

Run: `pnpm vitest run client/src/lib/api.test.ts client/src/lib/visualRadarIssueLayout.test.ts && pnpm check`

Expected: 全部 PASS，类型检查退出码为 0。

- [ ] **Step 6: 提交 Task 3**

```bash
git add client/src/lib/api.ts client/src/lib/api.test.ts client/src/pages/VisualRadar.tsx
git commit -m "Support static issue data in the frontend"
```

### Task 4: 配置 Pages 子路径和日报直达路由

**Files:**
- Create: `scripts/finalize-pages.ts`
- Create: `scripts/finalize-pages.test.ts`
- Modify: `client/src/main.tsx`
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试，要求生成直达 HTML**

创建 `scripts/finalize-pages.test.ts`：

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { finalizePagesBuild } from "./finalize-pages";

describe("finalizePagesBuild", () => {
  it("copies the root app entry to archive and issue routes", () => {
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "visual-radar-pages-"));
    const html = "<!doctype html><div id=\"root\"></div>";
    fs.writeFileSync(path.join(distDir, "index.html"), html, "utf-8");

    finalizePagesBuild({ distDir, issueIds: ["2026-07-16"] });

    expect(fs.readFileSync(path.join(distDir, "issues/index.html"), "utf-8"))
      .toBe(html);
    expect(fs.readFileSync(
      path.join(distDir, "issues/2026-07-16/index.html"),
      "utf-8"
    )).toBe(html);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run scripts/finalize-pages.test.ts`

Expected: FAIL，错误包含 `Cannot find module './finalize-pages'`。

- [ ] **Step 3: 实现 Pages 入口复制器**

创建 `scripts/finalize-pages.ts` 并导出：

```ts
import fs from "node:fs";
import path from "node:path";

export function finalizePagesBuild({
  distDir,
  issueIds,
}: {
  distDir: string;
  issueIds: string[];
}) {
  const html = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
  for (const route of ["issues", ...issueIds.map((id) => `issues/${id}`)]) {
    const routeDir = path.join(distDir, route);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(path.join(routeDir, "index.html"), html, "utf-8");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const summaries = JSON.parse(fs.readFileSync(
    path.join(projectRoot, ".pages-public/public-data/issues/index.json"),
    "utf-8"
  )) as Array<{ id: string }>;
  finalizePagesBuild({
    distDir: path.join(projectRoot, "dist/public"),
    issueIds: summaries.map((issue) => issue.id),
  });
}
```

- [ ] **Step 4: 配置 Vite base、publicDir 和 wouter base**

在 `vite.config.ts` 的 `defineConfig` 中增加：

```ts
base: process.env.VITE_VISUAL_RADAR_BASE_PATH || "/",
publicDir: process.env.VISUAL_RADAR_STATIC === "1"
  ? path.resolve(import.meta.dirname, ".pages-public")
  : false,
```

在 `client/src/main.tsx` 使用：

```tsx
import { Route, Router, Switch } from "wouter";

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router base={routerBase}>
      <Switch>
        <Route path="/" component={VisualRadar} />
        <Route path="/issues" component={VisualRadarArchive} />
        <Route path="/issues/:issueId" component={VisualRadarIssue} />
        <Route>404</Route>
      </Switch>
    </Router>
  </StrictMode>
);
```

- [ ] **Step 5: 增加 Pages 构建命令**

在 `package.json` 增加：

```json
"build:pages": "pnpm pages:data && VISUAL_RADAR_STATIC=1 VITE_VISUAL_RADAR_DATA_MODE=static VITE_VISUAL_RADAR_BASE_PATH=/visual-radar/ vite build && tsx scripts/finalize-pages.ts"
```

- [ ] **Step 6: 验证构建和直达文件**

Run: `pnpm vitest run scripts/finalize-pages.test.ts && pnpm build:pages`

Expected: PASS；存在 `dist/public/issues/index.html`、`dist/public/issues/2026-07-16/index.html` 和 `dist/public/public-data/issues/2026-07-16.json`。

- [ ] **Step 7: 提交 Task 4**

```bash
git add client/src/main.tsx package.json scripts/finalize-pages.ts scripts/finalize-pages.test.ts vite.config.ts
git commit -m "Build routable GitHub Pages output"
```

### Task 5: 增加 GitHub Pages 部署工作流

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: 创建最小权限 Pages 工作流**

创建 `.github/workflows/pages.yml`：

```yaml
name: Deploy Visual Radar Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: visual-radar-pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
        with:
          version: 11.9.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm check
      - run: pnpm build:pages
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist/public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 本地检查 YAML 和构建输入**

Run: `pnpm build:pages && git diff --check`

Expected: 构建成功，Git diff 无空白错误；工作流中不存在 `OPENAI_API_KEY`、`WECOM_BOT_WEBHOOK` 或 `CRON_SECRET`。

- [ ] **Step 3: 提交 Task 5**

```bash
git add .github/workflows/pages.yml
git commit -m "Deploy Visual Radar with GitHub Pages"
```

### Task 6: 停用不适用的无人值守 Daily Schedule

**Files:**
- Modify: `.github/workflows/daily.yml`
- Modify: `docs/定时推送指南.md`

- [ ] **Step 1: 删除 schedule，只保留手动 dry-run**

将 `.github/workflows/daily.yml` 的触发器改为：

```yaml
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: "只运行流程，不发送企业微信"
        required: false
        default: true
        type: boolean
```

删除 `schedule` 段。保留现有 `workflow_dispatch` 默认 dry-run 行为，不添加任何自动正式发送路径。

- [ ] **Step 2: 更新定时推送文档的当前限制**

在 `docs/定时推送指南.md` 明确：

```md
当前无 OpenAI API Key 模式下，GitHub Actions 不执行每日分析，也不自动发送企业微信。日报由 Codex 半自动生成并推送；`daily.yml` 仅保留人工 dry-run 入口。获得 API Key 并完成公网 Express 部署后，才能重新启用 schedule。
```

- [ ] **Step 3: 检查不存在 schedule**

Run: `rg -n "schedule:|cron:" .github/workflows/daily.yml`

Expected: 无输出，退出码为 1。

- [ ] **Step 4: 提交 Task 6**

```bash
git add .github/workflows/daily.yml docs/定时推送指南.md
git commit -m "Disable API-dependent daily schedule"
```

### Task 7: 更新公开发布和企业微信操作文档

**Files:**
- Modify: `README.md`
- Modify: `docs/GITHUB上传指南.md`
- Modify: `docs/企业微信推送指南.md`
- Modify: `.env.example`
- Test: `server/weComPublisher.test.ts`

- [ ] **Step 1: 增加 Pages 项目路径的企业微信测试**

在 `server/weComPublisher.test.ts` 增加：

```ts
it("links a report below the GitHub Pages repository path", () => {
  const markdown = buildWeComMarkdownContent(
    issue(),
    "https://visual-radar-owner.github.io/visual-radar/"
  );
  expect(markdown).toContain(
    "https://visual-radar-owner.github.io/visual-radar/issues/2026-07-16"
  );
});
```

- [ ] **Step 2: 运行测试确认现有 URL 规范化行为**

Run: `pnpm vitest run server/weComPublisher.test.ts`

Expected: PASS；若失败，只修改 `server/weComPublisher.ts` 的结尾斜杠规范化，不改变发送逻辑。

- [ ] **Step 3: 更新 README 和操作指南**

文档必须写明以下可复制流程：

```bash
pnpm pages:data
# Codex 生成 data/visual_radar_agent_output.json 后：
pnpm agent:import
pnpm build:pages
pnpm test
pnpm check
git add .
git commit -m "Publish Visual Radar daily"
git push
```

同时写明：

- Public 仓库会公开所有已提交文件，包括 `data/` 历史数据。
- GitHub 仓库设置中选择 `Settings -> Pages -> Source: GitHub Actions`。
- `VISUAL_RADAR_PUBLIC_URL` 使用 Actions 输出的 Pages 项目地址，不带结尾斜杠。
- 企业微信必须先 dry-run，Pages 链接验证成功后等待用户确认正式发送。
- `.env.example` 中 `OPENAI_API_KEY` 保持空值，并注释 Codex 模式不需要它。

- [ ] **Step 4: 提交 Task 7**

```bash
git add .env.example README.md docs/GITHUB上传指南.md docs/企业微信推送指南.md server/weComPublisher.test.ts server/weComPublisher.ts
git commit -m "Document Codex and Pages publishing workflow"
```

### Task 8: 完整验证和上传前检查

**Files:**
- Modify only if verification exposes an in-scope defect.

- [ ] **Step 1: 运行完整自动验证**

Run: `pnpm test`

Expected: 所有测试文件和测试用例 PASS。

Run: `pnpm check`

Expected: `tsc --noEmit` 退出码为 0。

Run: `pnpm build`

Expected: Express 生产构建成功。

Run: `pnpm build:pages`

Expected: GitHub Pages 构建成功。

- [ ] **Step 2: 验证静态产物没有秘密和后台数据**

Run:

```bash
rg -n "WECOM_BOT_WEBHOOK|CRON_SECRET|OPENAI_API_KEY|visual_radar_agent_batch" dist/public
```

Expected: 无输出，退出码为 1。

- [ ] **Step 3: 启动静态预览并做浏览器验证**

Run: `pnpm vite preview --host 127.0.0.1 --port 4173 --base /visual-radar/`

验证：

- `/visual-radar/` 展示最新一期。
- `/visual-radar/issues/` 展示往期列表。
- `/visual-radar/issues/2026-07-16/` 可直接打开并刷新。
- 页面不显示管理区入口。
- 图片、CSS、字体和 JSON 请求均位于 `/visual-radar/` 子路径。
- 桌面和移动端无标题覆盖、水平溢出或按钮越界。

- [ ] **Step 4: 验证日报数据未被删除**

Run:

```bash
node -e 'const x=require("./data/visual_radar_issues.json"); console.log(x.issues.length, x.issues.some(i=>i.issueDate==="2026-07-16"))'
```

Expected: 输出期数至少为 `1`，第二个值为 `true`。

- [ ] **Step 5: 检查 Git 状态和秘密**

Run: `git status -sb`

Expected: 只包含本计划产生的已知变更；用户已有的 `.gitignore` 和 `docs/brand/` 变更保持原样，不被覆盖。

Run:

```bash
find . -maxdepth 2 \( -name .env -o -name .env.local \) -print
rg -n "OPENAI_API_KEY=.+|WECOM_BOT_WEBHOOK=.+|CRON_SECRET=.+" . -g '!node_modules/**' -g '!dist/**' -g '!.env.example'
```

Expected: 不出现真实环境文件或密钥值。

- [ ] **Step 6: 提交验证中必要的最后修正**

仅当 Step 1-5 发现并修复了本功能范围内问题时执行：

```bash
git add .env.example .github/workflows .gitignore README.md client/src docs/GITHUB上传指南.md docs/企业微信推送指南.md docs/定时推送指南.md package.json scripts server vite.config.ts
git commit -m "Fix Pages publishing verification issues"
```

- [ ] **Step 7: 上传和正式发送保持人工门禁**

上传前先配置正式 Git 作者身份并决定是否重写现有提交作者；随后配置 GitHub remote、推送 `main`、在仓库设置启用 Pages，并确认 Actions 部署成功。只执行企业微信 dry-run；没有用户新的明确确认，不执行真实 Webhook 请求。
