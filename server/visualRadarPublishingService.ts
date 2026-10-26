import { execFileSync } from "node:child_process";
import { buildWeComMarkdownContent, sendVisualRadarIssueToWeCom } from "./weComPublisher";
import { sendIssueOnce, DeliveryBlocked } from "./visualRadarDelivery";
import { verifyPagesIssue } from "./visualRadarPublication";
import { readRun, stableHash, checkpoint } from "./visualRadarRunStore";
import { resolveProjectPaths } from "./paths";
import type { VisualRadarIssue } from "./visualRadarIssue";
import { createVisualRadarIssueStore } from "./visualRadarIssue";

export function currentCommit(root: string) { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
export function validationFingerprint(issue: VisualRadarIssue, commit: string) { return stableHash({ issueHash: stableHash(issue), commit }); }
export function assertCleanProject(root: string) {
  const changes = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (changes.trim()) throw new DeliveryBlocked("工作树有未发布改动，请完成提交和验证后再发送");
}
export async function publishWithRecord(root: string, issue: VisualRadarIssue, dryRun: boolean) {
  if (dryRun) return { markdown: buildWeComMarkdownContent(issue), sent: false };
  const files = resolveProjectPaths(root);
  return sendIssueOnce({
    directory: files.delivery, issue,
    verify: async () => {
      if (!issue.featuredStoryIds.length || issue.stories.some((story) => story.analysis.editorial?.status !== "verified")) throw new DeliveryBlocked("本期仍有未核验解读，不能正式发送");
      assertCleanProject(root);
      const commit = currentCommit(root);
      if (readRun(files.runs, issue.id).checkpoints.validated?.fingerprint !== validationFingerprint(issue, commit)) throw new DeliveryBlocked("请先执行 pnpm publish:verify <issueId> 完成本地与部署校验");
      await verifyPagesIssue(issue, process.env.VISUAL_RADAR_PUBLIC_URL || "", commit);
      assertCleanProject(root);
      const latest = createVisualRadarIssueStore(files.issues).getIssue(issue.id);
      if (currentCommit(root) !== commit || !latest || stableHash(latest) !== stableHash(issue)) throw new DeliveryBlocked("部署验证期间日报或提交发生变化，请重新验证");
      checkpoint(files.runs, issue.id, "deployed", validationFingerprint(issue, commit));
      const webhook = process.env.WECOM_BOT_WEBHOOK?.trim();
      if (!webhook || !webhook.startsWith("https://")) throw new DeliveryBlocked("企业微信配置不完整");
    },
    send: () => sendVisualRadarIssueToWeCom(issue),
  });
}
