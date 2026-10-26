import fs from "node:fs";
import path from "node:path";
import type { VisualRadarIssue } from "./visualRadarIssue";
import { atomicJson, checkedIssueId, stableHash } from "./visualRadarRunStore";
import { singaporeIssueDate } from "../shared/visualRadarQuality";

export class DeliveryBlocked extends Error { statusCode = 409; }
export class WeComRejected extends Error {}
export interface DeliveryRecord {
  version: 1; issueId: string; issueHash: string;
  status: "sending" | "sent" | "unknown" | "rejected" | "retry-approved";
  updatedAt: string; attempts: number;
  history: Array<{ at: string; event: string; note?: string }>;
}
export function readDelivery(directory: string, issueId: string): DeliveryRecord | null {
  const file = path.join(directory, `${checkedIssueId(issueId)}.json`);
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (value.version !== 1 || value.issueId !== issueId || !/^[a-f0-9]{64}$/.test(value.issueHash) || !Number.isInteger(value.attempts) || value.attempts < 0
    || !Number.isFinite(Date.parse(value.updatedAt)) || !["sending", "sent", "unknown", "rejected", "retry-approved"].includes(value.status) || !Array.isArray(value.history)) throw new DeliveryBlocked("发送记录损坏，禁止自动重发");
  return value;
}
function lock(directory: string, id: string) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${checkedIssueId(id)}.lock`);
  try { fs.writeFileSync(file, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new DeliveryBlocked("该期正在发送或上次进程中断；先核对发送记录，禁止自动重试"); throw error; }
  return () => fs.unlinkSync(file);
}

export async function sendIssueOnce(options: {
  directory: string; issue: VisualRadarIssue; now?: () => string;
  verify: () => Promise<void>;
  send: () => Promise<{ markdown: string; sent: boolean }>;
}) {
  const { directory, issue } = options;
  const now = options.now || (() => new Date().toISOString());
  const release = lock(directory, issue.id);
  const hash = stableHash(issue);
  const file = path.join(directory, `${issue.id}.json`);
  try {
    let record = readDelivery(directory, issue.id);
    if (record?.status === "sent") {
      if (record.issueHash !== hash) throw new DeliveryBlocked("该期已发送，但内容已更新；不会重复发送，请单独确认勘误沟通");
      return { issueId: issue.id, sent: true, alreadySent: true };
    }
    if (record && ["sending", "unknown", "rejected"].includes(record.status)) throw new DeliveryBlocked("发送结果需人工核对；先确认群消息，再显式解除重试限制");
    if (!record && issue.issueDate < singaporeIssueDate(now())) throw new DeliveryBlocked("历史日报没有发送凭据，可能已发送；必须人工核对后才能重试");
    if (Date.parse(now()) < Date.parse(`${issue.issueDate}T01:30:00Z`)) throw new DeliveryBlocked("尚未到达新加坡时间 09:30 的发送窗口");
    await options.verify();
    // Persist intent before the first network write. A crash after this point is never auto-retried.
    record = { version: 1, issueId: issue.id, issueHash: hash, status: "sending", attempts: (record?.attempts || 0) + 1,
      updatedAt: now(), history: [...(record?.history || []), { at: now(), event: "sending" }] };
    atomicJson(file, record);
    let response: { markdown: string; sent: boolean };
    try {
      response = await options.send();
      if (response.sent !== true) throw new Error("发送没有明确成功回执");
    } catch (error) {
      record.status = error instanceof WeComRejected ? "rejected" : "unknown";
      record.updatedAt = now(); record.history.push({ at: now(), event: record.status });
      atomicJson(file, record);
      throw new DeliveryBlocked(record.status === "rejected" ? "企业微信明确拒绝，已记录；修复后需显式允许重试" : "发送结果未知，已阻止自动重发；请先核对群消息");
    }
    record.status = "sent"; record.updatedAt = now(); record.history.push({ at: now(), event: "sent" });
    // If this write fails, the on-disk 'sending' marker still prevents a second send.
    atomicJson(file, record);
    return { ...response, issueId: issue.id, alreadySent: false };
  } finally { release(); }
}

export function resolveDelivery(directory: string, issue: VisualRadarIssue, outcome: "sent" | "not-sent", note: string) {
  if (!note.trim() || note.length > 300) throw new Error("必须给出不含密钥的核对说明（1–300 字）");
  const lockFile = path.join(directory, `${checkedIssueId(issue.id)}.lock`);
  if (fs.existsSync(lockFile)) {
    const value = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (!Number.isInteger(value.pid) || value.pid < 1) throw new DeliveryBlocked("锁记录异常，需人工检查");
    try { process.kill(value.pid, 0); throw new DeliveryBlocked("发送进程仍在运行，不能解除锁"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    fs.unlinkSync(lockFile);
  }
  const release = lock(directory, issue.id);
  try {
    const previous = readDelivery(directory, issue.id);
    if (previous?.status === "sent" && outcome === "not-sent") throw new DeliveryBlocked("已有成功记录，不允许把已发送改成未发送");
    const record: DeliveryRecord = { version: 1, issueId: issue.id, issueHash: previous?.issueHash || stableHash(issue), status: outcome === "sent" ? "sent" : "retry-approved",
      attempts: previous?.attempts || 0, updatedAt: new Date().toISOString(), history: [...(previous?.history || []), { at: new Date().toISOString(), event: `manual-${outcome}`, note: note.trim() }] };
    atomicJson(path.join(directory, `${issue.id}.json`), record);
    return record;
  } finally { release(); }
}
