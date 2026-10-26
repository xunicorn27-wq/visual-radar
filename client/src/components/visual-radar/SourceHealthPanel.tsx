import { useEffect, useRef, useState } from "react";
import { getVisualRadarSourceHealth, type HealthArtifact } from "../../lib/api";

type Filter = "all" | "attention" | "core";
export function healthRows(health: HealthArtifact, filter: Filter) {
  return health.sources.filter((source) => filter === "all" || (filter === "core" ? source.core : source.status !== "ok"))
    .toSorted((a, b) => Number(b.status !== "ok") - Number(a.status !== "ok") || b.consecutiveFailures - a.consecutiveFailures || a.label.localeCompare(b.label));
}
export function healthTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "尚无记录";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Singapore", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
export function SourceHealthTable({ health, filter }: { health: HealthArtifact; filter: Filter }) {
  const rows = healthRows(health, filter);
  return <div className="vr-health-table-scroll" tabIndex={0} role="region" aria-label="来源状态明细，可横向滚动">
    <table className="vr-health-table"><caption>最近一次记录：{healthTime(health.generatedAt)}（新加坡时间）</caption>
      <thead><tr><th scope="col">来源</th><th scope="col">状态</th><th scope="col">条目</th><th scope="col">连续异常</th><th scope="col">最近成功</th><th scope="col">检查时间 / 原因</th></tr></thead>
      <tbody>{rows.map((source) => <tr key={source.sourceId}>
        <th scope="row">{source.label}{source.core && <small>核心来源</small>}</th>
        <td><span className={`vr-health-status vr-health-${source.status}`}>{source.status === "ok" ? "有内容" : source.status === "empty" ? "无有效条目" : "采集失败"}</span>
          {source.lastCheckedAt !== health.generatedAt && <small>非本轮记录</small>}</td>
        <td>{source.itemCount}</td><td>{source.consecutiveFailures}</td><td>{healthTime(source.lastSuccessAt)}</td>
        <td>{healthTime(source.lastCheckedAt)}{source.error && <p>{source.error}</p>}</td>
      </tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className="vr-health-empty">当前筛选没有来源记录。</p>}
  </div>;
}

export function SourceHealthPanel({ secret, collectionVersion }: { secret: string; collectionVersion?: string }) {
  const [health, setHealth] = useState<HealthArtifact | null>(null);
  const [filter, setFilter] = useState<Filter>("attention");
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "empty" | "error">("idle");
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const previousSecret = useRef(secret);
  useEffect(() => {
    pending.current?.abort();
    setHealth(null); setError(""); setState("idle"); previousSecret.current = secret;
    return () => { pending.current?.abort(); };
  }, [secret, collectionVersion]);
  async function load() {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setState("loading"); setHealth(null); setError("");
    try {
      const response = await getVisualRadarSourceHealth(secret, controller.signal);
      if (controller.signal.aborted) return;
      if (response.summary === null) { setState("empty"); return; }
      if (!Array.isArray(response.sources) || !response.generatedAt || !response.summary) throw new Error("来源记录格式异常");
      setHealth(response); setState("loaded");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "来源记录读取失败"); setState("error");
    }
  }
  // Never show data fetched under an earlier credential while the effect is being applied.
  const visible = previousSecret.current === secret ? health : null;
  return <section className="vr-health" aria-label="来源健康面板">
    <header><div><h2>来源健康</h2><p>查看已有采集记录；读取面板不会触发采集或发送。</p></div>
      <button type="button" onClick={() => void load()} disabled={!secret.trim() || state === "loading"}>{state === "loading" ? "读取中…" : "读取最新记录"}</button>
    </header>
    {state === "idle" && <p className="vr-health-hint">{secret.trim() ? "点击读取，查看最近一次采集的覆盖与异常。" : "输入管理密钥后可读取。"}</p>}
    {state === "loading" && <p role="status">正在读取来源记录…</p>}
    {state === "error" && <p role="alert" className="vr-admin-error">{error}</p>}
    {state === "empty" && <p role="status">尚无健康记录，完成下一次采集后会生成。</p>}
    {visible && <>
      <p className="vr-health-hint">这是 {healthTime(visible.generatedAt)} 的历史采集结果，不代表当前网站实时可用。{Date.now() - Date.parse(visible.generatedAt) > 86400000 ? "记录已超过 24 小时。" : ""}</p>
      <dl className="vr-health-metrics"><div><dt>有内容的来源</dt><dd>{visible.summary.healthy}/{visible.summary.attempted}</dd></div><div><dt>核心来源覆盖</dt><dd>{visible.summary.coreHealthy}/{visible.summary.coreTotal}</dd></div><div><dt>失败 / 无内容</dt><dd>{visible.summary.failed} / {visible.summary.empty}</dd></div></dl>
      {visible.summary.alerts.length > 0 && <details className="vr-health-alerts"><summary>{visible.summary.alerts.length} 项关注提醒</summary><ul>{visible.summary.alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul></details>}
      <div className="vr-health-filters" role="group" aria-label="筛选来源">{([ ["attention", "需关注"], ["core", "核心来源"], ["all", "全部来源"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <SourceHealthTable health={visible} filter={filter} />
    </>}
  </section>;
}
