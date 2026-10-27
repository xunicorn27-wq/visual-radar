import { useEffect, useRef, useState } from "react";
import { getIssueQuality, type IssueQualityReport } from "../../lib/api";

function localTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Singapore", dateStyle: "short", timeStyle: "short" }).format(date)}（新加坡）` : "时间未知";
}

export function IssueQualityPanel({ issueId, secret, collectionVersion }: { issueId?: string; secret: string; collectionVersion?: string }) {
  const [report, setReport] = useState<IssueQualityReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort(); setReport(null); setError(""); setBusy(false);
    return () => request.current?.abort();
  }, [issueId, secret, collectionVersion]);
  async function inspect() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setReport(null);
    try {
      const value = await getIssueQuality(issueId!, secret, controller.signal);
      if (!controller.signal.aborted) setReport(value);
    } catch { if (!controller.signal.aborted) setError("质量清单读取失败，请检查管理权限或稍后重试。"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="vr-quality-panel" aria-label="发布前质量清单">
    <h3>发布前质量清单</h3>
    <p>{issueId ? `当前期号：${issueId}` : "生成日报后可检查本期内容"} · 只读检查，不采集、不发送</p>
    <button type="button" disabled={!issueId || !secret.trim() || busy} onClick={() => void inspect()}>{busy ? "正在检查…" : "检查本期质量"}</button>
    {error && <p role="alert">{error}</p>}
    {report && <div>
      <p role="status">{report.canPublish ? "内容质量检查通过，仍须完成部署验证" : "内容质量检查未通过"} · {report.blockers.length} 项阻塞 · {report.warnings.length} 项提醒</p>
      <p>原文证据 {report.evidence.verified}/{report.evidence.total} · 缺图 {report.missingImages} · 疑似/确认重复关系 {report.duplicates.length}</p>
      <p>参考 60–74：{report.scoreDistribution.reference60to74} · 精选候选 75–84：{report.scoreDistribution.candidate75to84} · 85+：{report.scoreDistribution.high85plus} · 低于 60：{report.scoreDistribution.below60}</p>
      {report.sourceCoverage && <p>来源检查时间：{localTime(report.sourceCoverage.checkedAt)} · 健康 {report.sourceCoverage.healthy}/{report.sourceCoverage.attempted} · 核心 {report.sourceCoverage.coreHealthy}/{report.sourceCoverage.coreTotal}<br />{report.sourceCoverage.scope}{!report.sourceCoverage.appliesToIssue && "；不适用于当前期号"}</p>}
      {report.blockers.length > 0 && <><h4>必须处理</h4><ul>{report.blockers.map((e, i) => <li key={`${e.code}-${i}`}>{e.message}（{e.count}）</li>)}</ul></>}
      {report.warnings.length > 0 && <><h4>编辑提醒</h4><ul>{report.warnings.map((e, i) => <li key={`${e.code}-${i}`}>{e.message}（{e.count}）</li>)}</ul></>}
      {report.duplicates.length > 0 && <details><summary>查看重复关系</summary><ul>{report.duplicates.map((d, i) => <li key={i}>{d.itemId} ↔ {d.otherIssueId} / {d.otherItemId}（{d.confidence === "confirmed" ? "已确认" : "疑似，需人工核对"}）</li>)}</ul></details>}
      <details><summary>查看推荐分层与原因</summary><ul>{report.recommendations.map(r => <li key={r.itemId}>{r.title}：{r.band} / {r.score}（原评分 {r.storedScore}）{r.reasons.length > 0 && `；${r.reasons.join("；")}`}</li>)}</ul></details>
    </div>}
  </section>;
}
