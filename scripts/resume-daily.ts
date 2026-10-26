import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { checkedIssueId, checkpoint, stableHash } from "../server/visualRadarRunStore";
import { inspectRecovery } from "../server/visualRadarRecovery";
import { importVisualRadarAgentOutputFiles } from "../server/visualRadarAgentOutputFile";
import { singaporeIssueDate } from "../shared/visualRadarQuality";

const root = path.resolve(import.meta.dirname, ".."); loadProjectEnv(root);
const files = resolveProjectPaths(root);
const id = checkedIssueId(process.argv[2] || singaporeIssueDate(new Date().toISOString()));
const execute = process.argv.includes("--execute");
let state = inspectRecovery(files, id);
if (execute) {
  if (id !== singaporeIssueDate(new Date().toISOString())) throw new Error("恢复执行只支持今天；历史记录请只查看或使用勘误流程");
  const base = new URL(process.env.VISUAL_RADAR_AUTOMATION_URL || "http://127.0.0.1:3199");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("恢复接口必须是本机 Visual Radar 服务");
  const secret = process.env.CRON_SECRET || "";
  if (!secret) throw new Error("管理密钥未配置");
  async function post(route: string) {
    const r = await fetch(new URL(route, base), { method: "POST", headers: { "x-cron-secret": secret }, signal: AbortSignal.timeout(600000) });
    if (!r.ok) throw new Error(`恢复步骤失败：HTTP ${r.status}，请检查本地管理日志`);
    await r.arrayBuffer();
  }
  if (state.next === "collect") { await post("/api/visual-radar/refresh"); state = inspectRecovery(files, id); }
  if (state.next === "prepare") { await post("/api/visual-radar/agent/prepare"); state = inspectRecovery(files, id); }
  if (state.next === "agent-import" && process.argv.includes("--import-output")) {
    const batch = JSON.parse(fs.readFileSync(files.agentBatch, "utf8"));
    const output = JSON.parse(fs.readFileSync(files.agentOutput, "utf8"));
    if (Date.parse(output.generatedAt) < Date.parse(batch.generatedAt)) throw new Error("输出早于当前批次，必须完成本批 Agent 解读");
    const result = importVisualRadarAgentOutputFiles({ analysis: files.analysis, batch: files.agentBatch, output: files.agentOutput, evidence: files.evidence });
    checkpoint(files.runs, id, "imported", stableHash({ batch, analysis: result.artifact }));
    state = inspectRecovery(files, id);
  }
  if (state.next === "generate") { await post("/api/visual-radar/issues/generate"); state = inspectRecovery(files, id); }
}
console.log(JSON.stringify({ ...state, sentByThisCommand: false, instruction: state.next === "agent-import" ? "先完成本批正文核验，再带 --execute --import-output 导入并继续生成" : state.next === "verify-publication" ? "提交和推送后执行 pnpm publish:verify <日期>；本命令永不自动发送" : state.next === "manual-check" ? "先人工确认群消息，再使用 delivery:resolve；不要直接重跑" : "根据 next 步骤恢复；--execute 才执行本地准备操作" }, null, 2));
