import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { prepareCandidateEvidence, isGenericImage } from "../server/visualRadarEvidence";
import { importVisualRadarAgentOutputFiles } from "../server/visualRadarAgentOutputFile";
import { importVisualRadarAgentOutput } from "../server/visualRadarAgentOutput";
import { readEvidenceSnapshot } from "../server/visualRadarEvidence";
import { readVisualRadarAnalysisArtifact } from "../server/visualRadarAnalysisStore";
import type { VisualRadarIssue } from "../server/visualRadarIssue";
import { recordSourceHealth } from "../server/visualRadarSourceHealth";

const root = path.resolve(import.meta.dirname, "..");
loadProjectEnv(root);
const files = resolveProjectPaths(root);
const [mode, issueId, ...ids] = process.argv.slice(2);
if (!["prepare", "apply"].includes(mode) || !/^\d{4}-\d{2}-\d{2}$/.test(issueId || "")) throw new Error("用法：pnpm issue:correct prepare|apply YYYY-MM-DD [itemId...]");
const archive = JSON.parse(fs.readFileSync(files.issues, "utf8")) as { issues: VisualRadarIssue[] };
const issue = archive.issues.find((item) => item.id === issueId);
if (!issue) throw new Error("日报不存在");
const directory = path.join(files.dataDir, "corrections-staging", issueId);
const batchFile = path.join(directory, "batch.json");
const outputFile = path.join(directory, "output.json");
if (mode === "prepare") {
  if (!ids.length || ids.some((id) => !issue.stories.some((story) => story.item.id === id))) throw new Error("必须指定本期已存在的候选 ID");
  const candidates = await prepareCandidateEvidence(issue.stories.filter((story) => ids.includes(story.item.id)).map((story) => story.item), files.evidence);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(batchFile, JSON.stringify({ qualityPolicy: "evidence-v1", candidates, stage: "value_screening", status: "prepared", generatedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify(candidates.map((item) => ({ id: item.id, hash: item.contentHash, evidence: item.sourceEvidence, image: Boolean(item.thumbnailUrl) })), null, 2));
} else {
  // Validate/import first. Patch only matching stories, never regenerate or delete an older issue.
  const output = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
  const candidates = batch.candidates as VisualRadarIssue["stories"][number]["item"][];
  const submitted = new Set<string>(output.analyses.map((a: { itemId: string }) => a.itemId));
  const validation = importVisualRadarAgentOutput({ batch, current: { analyses: [], failures: [], generatedAt: output.generatedAt, promptVersion: "visual-daily-v1" }, output,
    loadSnapshot: (hash) => readEvidenceSnapshot(files.evidence, hash) });
  if (validation.artifact.analyses.some((a) => a.editorial?.status !== "verified" || !issue.stories.some((s) => s.item.id === a.itemId && s.item.contentHash === a.contentHash))) throw new Error("勘误必须对应本期内容且具备完整正文证据");
  const result = importVisualRadarAgentOutputFiles({ analysis: files.analysis, batch: batchFile, output: outputFile, evidence: files.evidence });
  const analyses = readVisualRadarAnalysisArtifact(files.analysis).analyses;
  const changes: unknown[] = [];
  for (const story of issue.stories) {
    const candidate = candidates.find((item) => item.id === story.item.id && item.contentHash === story.item.contentHash);
    if (!candidate) continue;
    if (submitted.has(story.item.id)) {
      const analysis = analyses.find((a) => a.itemId === story.item.id && a.contentHash === story.item.contentHash && a.analyzedAt === output.generatedAt);
      if (!analysis?.editorial || analysis.editorial.status !== "verified") throw new Error("勘误必须有完整证据");
      if (JSON.stringify(story.analysis) !== JSON.stringify(analysis)) changes.push({ itemId: story.item.id, previous: story.analysis, corrected: analysis, correctedAt: output.generatedAt });
      story.analysis = analysis;
    }
    if (isGenericImage(story.item.thumbnailUrl) && candidate.thumbnailUrl && !isGenericImage(candidate.thumbnailUrl)) {
      changes.push({ itemId: story.item.id, imageAdded: candidate.thumbnailUrl, correctedAt: output.generatedAt });
      story.item.thumbnailUrl = candidate.thumbnailUrl;
    } else if (story.item.thumbnailUrl && isGenericImage(story.item.thumbnailUrl)) {
      changes.push({ itemId: story.item.id, genericImageRemoved: story.item.thumbnailUrl, correctedAt: output.generatedAt });
      story.item.thumbnailUrl = null;
    }
  }
  if (changes.length) {
    const auditFile = path.join(files.dataDir, "visual_radar_corrections.json");
    const audit = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, "utf8")) : { corrections: [] };
    audit.corrections.push({ issueId, changes });
    fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n");
    const temporary = `${files.issues}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(archive, null, 2) + "\n");
    fs.renameSync(temporary, files.issues);
  }
  const collected = JSON.parse(fs.readFileSync(files.items, "utf8"));
  const health = recordSourceHealth(files.sourceHealth, collected);
  console.log(JSON.stringify({ ...result.summary, issueId, changes: changes.length, preservedIssues: archive.issues.length, health: health.summary }, null, 2));
}
