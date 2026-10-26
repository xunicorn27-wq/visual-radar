import type { VisualRadarIssue } from "./visualRadarIssue";
import { classifyFreshness } from "../shared/visualRadarQuality";
import { WeComRejected } from "./visualRadarDelivery";

export interface WeComStatus {
  configured: boolean;
  publicUrl: string | null;
}

export interface WeComOptions {
  fetchImpl?: typeof fetch;
  publicUrl?: string | null;
  webhook?: string | null;
}

export interface WeComDeliveryOptions {
  dryRun: boolean;
  sendImpl?: (
    issue: VisualRadarIssue
  ) => Promise<{ markdown: string; sent: boolean }>;
}

export function getWeComStatus(options: WeComOptions = {}): WeComStatus {
  const webhook = options.webhook ?? process.env.WECOM_BOT_WEBHOOK ?? "";
  const publicUrl = options.publicUrl ?? process.env.VISUAL_RADAR_PUBLIC_URL ?? null;
  return {
    configured: Boolean(webhook.trim()),
    publicUrl: publicUrl?.trim().replace(/\/+$/, "") || null,
  };
}

export function buildWeComMarkdownContent(
  issue: VisualRadarIssue,
  publicUrl = process.env.VISUAL_RADAR_PUBLIC_URL || ""
) {
  const storyById = new Map(issue.stories.map((story) => [story.item.id, story]));
  const featured = issue.featuredStoryIds
    .map((id) => storyById.get(id))
    .filter((story): story is VisualRadarIssue["stories"][number] => Boolean(story))
    .slice(0, 10);
  const sourceCount = Object.keys(issue.stats.bySource).length;
  const topicCount = Object.keys(issue.stats.byTopic).length;
  const reportUrl = `${publicUrl.trim().replace(/\/+$/, "")}/issues/${issue.id}`;
  const lines = [
    `**Visual Radar | ${issue.issueDate}**`,
    "",
    ...featured.flatMap((story, index) => [
      `**${String(index + 1).padStart(2, "0")} | ${story.analysis.chineseTitle || story.item.title}**${story.item.sourceUrl ? ` [原文](${story.item.sourceUrl})` : ""}`,
      ...(index < 3 ? [compactSummary(story.analysis.chineseSummary || story.item.text)] : []),
      ...(["upcoming", "reference", "unknown"].includes(classifyFreshness(story.item, issue.generatedAt).kind) ? [`_${classifyFreshness(story.item, issue.generatedAt).label}_`] : []),
      "",
    ]),
    `> 本期网页共 ${issue.stats.storyCount} 条 | ${sourceCount} 个真实来源 | ${topicCount} 个主题`,
    "",
    `[阅读全文 →](${reportUrl})`,
  ];
  return lines.join("\n").trim();
}

export async function deliverVisualRadarIssue(
  issue: VisualRadarIssue,
  options: WeComDeliveryOptions
) {
  if (options.dryRun) {
    return {
      markdown: buildWeComMarkdownContent(issue),
      sent: false as const,
    };
  }
  return (options.sendImpl || sendVisualRadarIssueToWeCom)(issue);
}

export async function sendVisualRadarIssueToWeCom(
  issue: VisualRadarIssue,
  options: WeComOptions = {}
) {
  const webhook = (options.webhook ?? process.env.WECOM_BOT_WEBHOOK ?? "").trim();
  if (!webhook) throw new Error("WECOM_BOT_WEBHOOK 未配置");
  if (!webhook.startsWith("https://")) throw new Error("企业微信 Webhook 必须使用 HTTPS");
  const publicUrl = (options.publicUrl ?? process.env.VISUAL_RADAR_PUBLIC_URL ?? "").trim();
  if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
    throw new Error("VISUAL_RADAR_PUBLIC_URL 未配置");
  }

  const markdown = buildWeComMarkdownContent(issue, publicUrl);
  const response = await (options.fetchImpl || fetch)(webhook, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { content: markdown } }),
  });
  if (!response.ok) {
    throw new Error(`企业微信发送失败：HTTP ${response.status}`);
  }
  const payload = await response.json().catch(() => null) as { errcode?: number; errmsg?: string } | null;
  if (typeof payload?.errcode === "number" && payload.errcode !== 0) throw new WeComRejected(`企业微信未明确确认成功：${payload.errcode}`);
  if (payload?.errcode !== 0) throw new Error("企业微信未明确确认成功：响应缺少 errcode:0");
  return { markdown, sent: true };
}

function compactSummary(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 88) return normalized;
  const sentence = normalized.match(/^.{30,88}?[。！？]/)?.[0];
  return sentence || `${normalized.slice(0, 86)}…`;
}
