import fs from "node:fs";
import path from "node:path";
import type { resolveProjectPaths } from "./paths";
import { createVisualRadarIssueStore } from "./visualRadarIssue";
import { readRun, stableHash } from "./visualRadarRunStore";
import { readDelivery } from "./visualRadarDelivery";
import { singaporeIssueDate } from "../shared/visualRadarQuality";

export function inspectRecovery(files: ReturnType<typeof resolveProjectPaths>, id: string, now = new Date().toISOString()) {
  const run = readRun(files.runs, id);
  const load = (file: string) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const items = load(files.items), batch = load(files.agentBatch), analysis = load(files.analysis);
  const issue = createVisualRadarIssueStore(files.issues).getIssue(id);
  const delivery = readDelivery(files.delivery, id);
  const locked = fs.existsSync(path.join(files.delivery, `${id}.lock`));
  const legacyReceiptMissing = Boolean(issue && !delivery && id < singaporeIssueDate(now));
  const matches = (stage: keyof typeof run.checkpoints, value: unknown) => value != null && run.checkpoints[stage]?.fingerprint === stableHash(value);
  const valid = {
    collected: matches("collected", items),
    prepared: matches("prepared", batch),
    imported: matches("imported", batch && analysis ? { batch, analysis } : null),
    generated: matches("generated", issue),
  };
  const next = locked || legacyReceiptMissing ? "manual-check"
    : delivery?.status === "sent" ? (issue && stableHash(issue) === delivery.issueHash ? "complete" : "manual-check")
    : delivery && ["sending", "unknown", "rejected"].includes(delivery.status) ? "manual-check"
    : !valid.collected ? "collect"
    : !valid.prepared ? "prepare"
    : !valid.imported ? "agent-import"
    : !valid.generated ? "generate"
    : "verify-publication";
  return { issueId: id, next, valid, run, delivery, locked, legacyReceiptMissing };
}
