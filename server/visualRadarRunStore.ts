import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export function stableHash(value: unknown): string {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, canonical(val)]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temp, "wx", 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    const parent = fs.openSync(path.dirname(file), "r");
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function checkedIssueId(id: string) {
  const date = new Date(`${id}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== id) throw new Error("无效日报日期");
  return id;
}
export interface RunRecord {
  version: 1; issueId: string;
  checkpoints: Partial<Record<"collected" | "prepared" | "imported" | "generated" | "validated" | "deployed", { at: string; fingerprint: string }>>;
}
export function readRun(dir: string, id: string): RunRecord {
  const file = path.join(dir, `${checkedIssueId(id)}.json`);
  if (!fs.existsSync(file)) return { version: 1, issueId: id, checkpoints: {} };
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  if (record.version !== 1 || record.issueId !== id || !record.checkpoints) throw new Error("运行记录损坏，请人工核对");
  return record;
}
export function checkpoint(dir: string, id: string, stage: keyof RunRecord["checkpoints"], fingerprint: string, now = new Date().toISOString()) {
  const record = readRun(dir, id);
  const stages = ["collected", "prepared", "imported", "generated", "validated", "deployed"] as const;
  if (record.checkpoints[stage]?.fingerprint !== fingerprint) {
    for (const later of stages.slice(stages.indexOf(stage) + 1)) delete record.checkpoints[later];
  }
  record.checkpoints[stage] = { at: now, fingerprint };
  atomicJson(path.join(dir, `${checkedIssueId(id)}.json`), record);
}
