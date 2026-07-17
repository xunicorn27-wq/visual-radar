import { Bot, BrainCircuit, FilePlus2, KeyRound, RefreshCw, Send, X } from "lucide-react";

export function VisualRadarAdmin({
  busyAction,
  adminSecret,
  error,
  metrics,
  onAnalyze,
  onAgentAnalyze,
  onClose,
  onCollect,
  onGenerate,
  onPublish,
  onSecretChange,
  status,
}: {
  adminSecret: string;
  busyAction: "agent" | "analyze" | "collect" | "generate" | "publish" | null;
  error: string | null;
  metrics: {
    analyzed: number;
    collected: number;
    connected: number;
    failed: number;
    pending: number;
  };
  onAnalyze: () => void;
  onAgentAnalyze: () => void;
  onClose: () => void;
  onCollect: () => void;
  onGenerate: () => void;
  onPublish: () => void;
  onSecretChange: (value: string) => void;
  status: string | null;
}) {
  return (
    <section className="vr-admin" aria-label="Visual Radar 管理区">
      <div className="vr-admin-heading">
        <strong>MANAGEMENT</strong>
        <button type="button" onClick={onClose} aria-label="关闭管理区" title="关闭">
          <X aria-hidden="true" />
        </button>
      </div>
      <label className="vr-admin-secret">
        <KeyRound aria-hidden="true" />
        <input
          type="password"
          value={adminSecret}
          onChange={(event) => onSecretChange(event.target.value)}
          placeholder="输入管理密钥"
          autoComplete="off"
        />
      </label>
      <div className="vr-admin-actions">
        <AdminButton
          icon={<RefreshCw aria-hidden="true" />}
          label="采集最新"
          loading={busyAction === "collect"}
          onClick={onCollect}
        />
        <AdminButton
          icon={<BrainCircuit aria-hidden="true" />}
          label="AI 解读"
          loading={busyAction === "analyze"}
          onClick={onAnalyze}
        />
        <AdminButton
          icon={<Bot aria-hidden="true" />}
          label="Agent 解读（无需 API）"
          loading={busyAction === "agent"}
          onClick={onAgentAnalyze}
        />
        <AdminButton
          icon={<FilePlus2 aria-hidden="true" />}
          label="生成今日日报"
          loading={busyAction === "generate"}
          onClick={onGenerate}
        />
        <AdminButton
          icon={<Send aria-hidden="true" />}
          label="推送企业微信"
          loading={busyAction === "publish"}
          onClick={onPublish}
        />
      </div>
      <dl className="vr-admin-metrics">
        <Metric label="采集" value={metrics.collected} />
        <Metric label="已解读" value={metrics.analyzed} />
        <Metric label="已接入" value={metrics.connected} />
        <Metric label="待接入" value={metrics.pending} />
        <Metric label="失败" value={metrics.failed} />
      </dl>
      {error ? <p className="vr-admin-error">{error}</p> : null}
      {!error && status ? <p className="vr-admin-status">{status}</p> : null}
    </section>
  );
}

function AdminButton({
  icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={label}
    >
      <span className={loading ? "vr-spin" : ""}>{icon}</span>
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
