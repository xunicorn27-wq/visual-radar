import type { VisualRadarIssue } from "./visualRadarIssue";
import { classifyFreshness } from "../shared/visualRadarQuality";

export function buildReviewQueue(issues: readonly VisualRadarIssue[], now = new Date().toISOString()) {
  const entries = issues.flatMap((issue) => issue.stories.flatMap((story) => {
    // A newer analysis elsewhere does not prove this published issue snapshot was corrected.
    if (story.analysis.editorial?.status === "verified") return [];
    const featured = issue.featuredStoryIds.includes(story.item.id);
    const reasons = ["历史摘要未通过正文证据核验"];
    let priority = featured ? 100 : 0;
    if (featured) reasons.push("本期精选");
    if (story.item.text.length < 180) { priority += 20; reasons.push("采集摘要较短"); }
    const freshness = classifyFreshness(story.item, issue.generatedAt);
    if (freshness.kind === "unknown") { priority += 15; reasons.push("日期缺失或异常"); }
    if (!story.item.thumbnailUrl) { priority += 5; reasons.push("缺少配图"); }
    return [{ issueId: issue.id, itemId: story.item.id, contentHash: story.item.contentHash, title: story.analysis.chineseTitle || story.item.title,
      source: story.item.sourceAccount || "Unknown", sourceUrl: story.item.sourceUrl, featured, priority, reasons,
      status: "pending" as const }];
  })).sort((a, b) => b.priority - a.priority || b.issueId.localeCompare(a.issueId) || a.itemId.localeCompare(b.itemId));
  const published = issues.reduce((sum, issue) => sum + issue.stories.length, 0);
  return { generatedAt: now, summary: { published, pending: entries.length, verified: published - entries.length, featuredPending: entries.filter((entry) => entry.featured).length },
    instruction: "清单不等于已核验。按 issue:correct prepare/apply 流程逐条读取正文；无法获取时保留待核验，不删除历史。", entries };
}
