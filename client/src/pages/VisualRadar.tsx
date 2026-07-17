import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

import { VisualRadarAdmin } from "../components/visual-radar/VisualRadarAdmin";
import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import {
  analyzeVisualRadarItems,
  generateVisualRadarIssue,
  getVisualRadarAnalysis,
  getVisualRadarIssue,
  getVisualRadarIssues,
  getVisualRadarItems,
  getVisualRadarSources,
  prepareVisualRadarAgentBatch,
  refreshVisualRadarItems,
  sendVisualRadarIssue,
  type IntelSourceRegistrySnapshot,
  type VisualRadarAnalysisArtifact,
  type VisualRadarArtifact,
  type VisualRadarIssueDetail,
} from "../lib/api";
import { VisualRadarIssueContent } from "./VisualRadarIssue";

export default function VisualRadar() {
  const [, navigate] = useLocation();
  const [adminSecret, setAdminSecret] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [analysis, setAnalysis] = useState<VisualRadarAnalysisArtifact | null>(null);
  const [busyAction, setBusyAction] = useState<"agent" | "analyze" | "collect" | "generate" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issueDetail, setIssueDetail] = useState<VisualRadarIssueDetail | null>(null);
  const [items, setItems] = useState<VisualRadarArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<IntelSourceRegistrySnapshot | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError(null);
    try {
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

  async function runAction(action: "agent" | "analyze" | "collect" | "generate" | "publish") {
    setBusyAction(action);
    setError(null);
    setStatus(null);
    try {
      if (!adminSecret.trim()) throw new Error("请先输入管理密钥");
      if (action === "collect") {
        const artifact = await refreshVisualRadarItems(adminSecret);
        setItems(artifact);
        setStatus(`采集完成：${artifact.items.length} 条，失败 ${artifact.failures.length} 条。`);
        return;
      }
      if (action === "analyze") {
        const result = await analyzeVisualRadarItems(adminSecret);
        setAnalysis(result.artifact);
        setStatus(
          result.summary.analyzed === 0 && result.summary.failed > 0
            ? `AI 解读失败：${result.summary.failed} 条未完成，请检查后端 Key 后重试。`
            : `AI 解读完成：新增 ${result.summary.analyzed} 条，缓存 ${result.summary.cached} 条，失败 ${result.summary.failed} 条。`
        );
        return;
      }
      if (action === "agent") {
        const batch = await prepareVisualRadarAgentBatch(adminSecret);
        setStatus(
          `Agent 任务已准备：待价值初筛 ${batch.summary.candidates} 条，已缓存 ${batch.summary.cached} 条。请回到 Codex 输入“开始 Agent 解读”。`
        );
        return;
      }

      if (action === "publish") {
        if (!issueDetail) throw new Error("请先生成日报");
        const result = await sendVisualRadarIssue(issueDetail.issue.id, adminSecret);
        setStatus(result.sent ? "企业微信推送成功。" : "已生成企业微信预览。 ");
        return;
      }

      const issue = await generateVisualRadarIssue(adminSecret);
      setStatus(`已生成 ${issue.stats.storyCount} 条网页内容，其中 ${issue.featuredStoryIds.length} 条用于微信精选。`);
      navigate(`/issues/${issue.id}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel={issueDetail ? `VOL.${issueDetail.issue.id}` : "FIRST EDITION"}
        onToggleAdmin={() => setAdminOpen((open) => !open)}
      />
      {adminOpen ? (
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

      {loading ? (
        <div className="vr-message"><Loader2 className="vr-spin" /> 正在加载 Visual Radar</div>
      ) : null}
      {!loading && issueDetail ? (
        <VisualRadarIssueContent issue={issueDetail.issue} />
      ) : null}
      {!loading && !issueDetail ? (
        <section className="vr-empty">
          <span>VOL.001</span>
          <h1>第一期<br />等待生成</h1>
          <p>先完成 AI 解读，再生成今日日报。</p>
          <button type="button" onClick={() => setAdminOpen(true)}>打开管理区</button>
        </section>
      ) : null}

      <section id="sources" className="vr-source-strip">
        <span>{registry?.summary.live || 0} LIVE SOURCES</span>
        <span>{registry?.summary.planned || 0} IN QUEUE</span>
        <span>{items?.items.length || 0} RAW SIGNALS</span>
        <span>{analysis?.analyses.length || 0} ANALYZED</span>
      </section>
    </main>
  );
}
