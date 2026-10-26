import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDailyAutomation, assertCronSecret } from "./dailyAutomation";
import { loadProjectEnv } from "./env";
import { getConfiguredOpenAiVisualRadarProvider } from "./openAiVisualRadarProvider";
import { resolveProjectPaths } from "./paths";
import { buildVisualRadarSourceRegistry } from "./sourceRegistry";
import {
  prepareVisualRadarAgentBatch,
  writeVisualRadarAgentBatch,
} from "./visualRadarAgentBatch";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifact,
} from "./visualRadarAnalysisStore";
import { collectVisualRadarItems } from "./visualRadarCollector";
import {
  createVisualRadarIssueStore,
  summarizeVisualRadarIssue,
} from "./visualRadarIssue";
import {
  readVisualRadarArtifact,
  writeVisualRadarArtifact,
} from "./visualRadarStore";
import {
  VisualRadarConfigurationError,
  analyzeVisualRadarArtifact,
  generateVisualRadarIssueFromArtifacts,
  getVisualRadarIssueDetail,
} from "./visualRadarWorkflow";
import {
  getWeComStatus,
} from "./weComPublisher";
import { createSendVisualRadarIssueHandler } from "./weComRoute";
import { buildVisualRadarArchive } from "./visualRadarArchive";
import { prepareCandidateEvidence } from "./visualRadarEvidence";
import { recordSourceHealth } from "./visualRadarSourceHealth";
import { publishWithRecord } from "./visualRadarPublishingService";
import { checkpoint, stableHash, readRun } from "./visualRadarRunStore";
import { readDelivery } from "./visualRadarDelivery";
import { singaporeIssueDate } from "../shared/visualRadarQuality";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
loadProjectEnv(projectRoot);
const files = resolveProjectPaths(projectRoot);
fs.mkdirSync(files.dataDir, { recursive: true });

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireCronSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    assertCronSecret(String(req.header("x-cron-secret") || ""), process.env.CRON_SECRET || "");
    next();
  } catch (error) {
    const configured = Boolean(process.env.CRON_SECRET?.trim());
    res.status(configured ? 401 : 503).json({
      error: configured ? "未授权" : "CRON_SECRET 未配置",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "visual-radar" });
});

app.get("/api/visual-radar/sources", (_req, res) => {
  res.json(buildVisualRadarSourceRegistry(readVisualRadarArtifact(files.items)));
});

app.get("/api/visual-radar/items", (_req, res) => {
  res.json(readVisualRadarArtifact(files.items));
});

app.get("/api/visual-radar/source-health", requireCronSecret, (_req, res) => {
  res.json(fs.existsSync(files.sourceHealth) ? JSON.parse(fs.readFileSync(files.sourceHealth, "utf8")) : { sources: [], summary: null });
});

app.post("/api/visual-radar/refresh", requireCronSecret, async (_req, res) => {
  try {
    res.json(await collectAndStore());
  } catch (error) {
    res.status(502).json({ error: "采集失败", detail: readError(error) });
  }
});

app.get("/api/visual-radar/analysis", (_req, res) => {
  res.json(readVisualRadarAnalysisArtifact(files.analysis));
});

app.post("/api/visual-radar/analyze", requireCronSecret, async (_req, res) => {
  try {
    res.json(await analyzeAndStore());
  } catch (error) {
    const status = error instanceof VisualRadarConfigurationError ? error.statusCode : 502;
    res.status(status).json({ error: "AI 解读失败", detail: readError(error) });
  }
});

app.post("/api/visual-radar/agent/prepare", requireCronSecret, async (_req, res) => {
  try {
    const itemsArtifact = readVisualRadarArtifact(files.items);
    const batch = prepareVisualRadarAgentBatch({
      analysisArtifact: readVisualRadarAnalysisArtifact(files.analysis),
      itemsArtifact,
    });
    batch.candidates = await prepareCandidateEvidence(batch.candidates, files.evidence);
    const enriched = new Map(batch.candidates.map((item) => [item.id, item]));
    const enrichedArtifact = { ...itemsArtifact, items: itemsArtifact.items.map((item) => enriched.get(item.id) || item) };
    writeVisualRadarArtifact(files.items, enrichedArtifact);
    checkpoint(files.runs, singaporeIssueDate(batch.generatedAt), "collected", stableHash(enrichedArtifact));
    writeVisualRadarAgentBatch(files.agentBatch, batch);
    checkpoint(files.runs, singaporeIssueDate(batch.generatedAt), "prepared", stableHash(batch));
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: "Agent 任务生成失败", detail: readError(error) });
  }
});

app.get("/api/visual-radar/issues", (_req, res) => {
  res.json(createVisualRadarIssueStore(files.issues).listIssues().map(summarizeVisualRadarIssue));
});

app.get("/api/visual-radar/archive", (_req, res) => {
  res.json(buildVisualRadarArchive(createVisualRadarIssueStore(files.issues).listIssues()));
});

app.post("/api/visual-radar/issues/generate", requireCronSecret, (_req, res) => {
  try {
    res.json(generateAndStore());
  } catch (error) {
    res.status(400).json({ error: "日报生成失败", detail: readError(error) });
  }
});

app.get("/api/visual-radar/issues/:issueId", (req, res) => {
  const detail = getVisualRadarIssueDetail(
    createVisualRadarIssueStore(files.issues),
    String(req.params.issueId)
  );
  if (!detail) return res.status(404).json({ error: "日报不存在" });
  res.json(detail);
});

app.get("/api/visual-radar/wecom/status", (_req, res) => {
  res.json(getWeComStatus());
});

app.get("/api/visual-radar/issues/:issueId/run-status", requireCronSecret, (req, res) => {
  try { res.json({ run: readRun(files.runs, String(req.params.issueId)), delivery: readDelivery(files.delivery, String(req.params.issueId)) }); }
  catch { res.status(409).json({ error: "运行记录无法读取，请人工检查" }); }
});

app.post(
  "/api/visual-radar/issues/:issueId/send-wecom",
  requireCronSecret,
  createSendVisualRadarIssueHandler({
    deliverIssue: (issue, options) => publishWithRecord(projectRoot, issue, options.dryRun),
    getIssue: (issueId) =>
      createVisualRadarIssueStore(files.issues).getIssue(issueId),
  })
);

app.post("/api/automation/daily", requireCronSecret, async (req, res) => {
  try {
    let generatedIssueId = "";
    const result = await runDailyAutomation({
      collect: async () => ({ items: (await collectAndStore()).items.length }),
      analyze: async () => ({ analyzed: (await analyzeAndStore()).summary.analyzed }),
      dryRun: req.query.dryRun === "1",
      generate: async () => {
        const issue = generateAndStore();
        generatedIssueId = issue.id;
        return { id: issue.id, stories: issue.stats.storyCount };
      },
      publish: async () => {
        const issue = createVisualRadarIssueStore(files.issues).getIssue(generatedIssueId);
        if (!issue) throw new Error("自动化生成的日报不存在");
        return publishWithRecord(projectRoot, issue, false);
      },
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: "每日自动化失败", detail: readError(error) });
  }
});

if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(projectRoot, "dist", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

const port = Number(process.env.PORT || 3099);
app.listen(port, "0.0.0.0", () => {
  console.log(`Visual Radar running on http://localhost:${port}`);
});

async function collectAndStore() {
  const artifact = await collectVisualRadarItems();
  writeVisualRadarArtifact(files.items, artifact);
  const health = recordSourceHealth(files.sourceHealth, artifact);
  checkpoint(files.runs, singaporeIssueDate(artifact.generatedAt), "collected", stableHash(artifact));
  return { ...artifact, health: health.summary };
}

async function analyzeAndStore() {
  const result = await analyzeVisualRadarArtifact({
    analysisArtifact: readVisualRadarAnalysisArtifact(files.analysis),
    itemsArtifact: readVisualRadarArtifact(files.items),
    provider: getConfiguredOpenAiVisualRadarProvider(),
  });
  writeVisualRadarAnalysisArtifact(files.analysis, result.artifact);
  return result;
}

function generateAndStore() {
  const issue = generateVisualRadarIssueFromArtifacts({
    analysisArtifact: readVisualRadarAnalysisArtifact(files.analysis),
    issueStore: createVisualRadarIssueStore(files.issues),
    itemsArtifact: readVisualRadarArtifact(files.items),
  });
  checkpoint(files.runs, issue.id, "generated", stableHash(issue));
  return issue;
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
