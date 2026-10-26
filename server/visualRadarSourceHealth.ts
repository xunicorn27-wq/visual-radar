import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { VisualRadarArtifact } from "./visualRadarCollector";
import { VISUAL_CULTURE_SOURCES } from "./visualCultureSourceCatalog";

export interface SourceHealth {
  sourceId: string; label: string; status: "ok" | "failed" | "empty";
  consecutiveFailures: number; lastCheckedAt: string; lastSuccessAt: string | null;
  itemCount: number; error: string | null; core: boolean;
}
export interface HealthArtifact { generatedAt: string; sources: SourceHealth[]; summary: { attempted: number; healthy: number; failed: number; empty: number; coreHealthy: number; coreTotal: number; alerts: string[] } }
export function updateSourceHealth(previous: HealthArtifact | null, artifact: VisualRadarArtifact): HealthArtifact {
  const registry = new Map(VISUAL_CULTURE_SOURCES.map((s) => [s.id, s]));
  const ids = artifact.attemptedSourceIds || [...new Set([
    ...artifact.failures.map((f) => f.sourceId),
    ...VISUAL_CULTURE_SOURCES.filter((s) => artifact.items.some((i) => i.sourceAccount === s.label)).map((s) => s.id),
  ])];
  const prior = new Map(previous?.sources.map((s) => [s.sourceId, s]) || []);
  const checked = ids.map((id): SourceHealth => {
    const source = registry.get(id);
    const old = prior.get(id);
    if (old?.lastCheckedAt === artifact.generatedAt) return old;
    const failure = artifact.failures.find((f) => f.sourceId === id);
    const count = artifact.items.filter((i) => i.sourceAccount === source?.label).length;
    const status = failure ? "failed" : count ? "ok" : "empty";
    return { sourceId: id, label: source?.label || id, core: source?.role === "photography" || source?.role === "institution", status, itemCount: count,
      consecutiveFailures: status === "ok" ? 0 : (old?.consecutiveFailures || 0) + 1, lastCheckedAt: artifact.generatedAt,
      lastSuccessAt: status === "ok" ? artifact.generatedAt : old?.lastSuccessAt || null, error: failure?.error || (status === "empty" ? "未取得有效条目" : null) };
  });
  return { generatedAt: artifact.generatedAt, sources: [...checked, ...(previous?.sources || []).filter((s) => !ids.includes(s.sourceId))], summary: {
    attempted: checked.length, healthy: checked.filter((s) => s.status === "ok").length,
    failed: checked.filter((s) => s.status === "failed").length, empty: checked.filter((s) => s.status === "empty").length,
    coreHealthy: checked.filter((s) => s.core && s.status === "ok").length, coreTotal: checked.filter((s) => s.core).length,
    alerts: checked.filter((s) => s.status !== "ok" && (s.core || s.consecutiveFailures >= 2)).map((s) => `${s.label}：${s.error}，连续 ${s.consecutiveFailures} 次`),
  } };
}
export function recordSourceHealth(file: string, artifact: VisualRadarArtifact) {
  const previous: HealthArtifact | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const result = updateSourceHealth(previous, artifact);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(result, null, 2)}\n`);
  fs.renameSync(temp, file);
  return result;
}
