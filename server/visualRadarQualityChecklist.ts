import type { VisualRadarIssue } from "./visualRadarIssue";
import type { HealthArtifact } from "./visualRadarSourceHealth";
import { calibrateVisualRadarRecommendation } from "./visualRadarRecommendation";
import { areLikelySameVisualEvent, confirmedSameEvent, hasNewEventDevelopment } from "./visualRadarEventDedup";
import { QUALITY_VERSION, SELECTION_POLICY, classifyFreshness, singaporeIssueDate } from "../shared/visualRadarQuality";
import { DeliveryBlocked } from "./visualRadarDelivery";
import { validateAssessment, validateEvent } from "./visualRadarEvidence";
import { VISUAL_SCORE_LIMITS } from "./visualRadarAnalysis";

export interface QualityCheckEntry { code: string; severity: "blocker" | "warning"; message: string; count: number; itemIds?: string[] }
export interface DuplicatePair { itemId: string; otherItemId: string; otherIssueId: string; confidence: "confirmed" | "possible" }

// Pure, read-only replay of the issue snapshot. Never substitute newer global analyses.
export function buildVisualRadarQualityChecklist({ issue, history = [], health, now = new Date().toISOString() }: {
  issue: VisualRadarIssue; history?: readonly VisualRadarIssue[]; health?: HealthArtifact | null; now?: string;
}) {
  const blockers: QualityCheckEntry[] = [], warnings: QualityCheckEntry[] = [];
  const add = (code: string, message: string, ids: string[], severity: "blocker" | "warning" = "blocker") => {
    if (ids.length) (severity === "blocker" ? blockers : warnings).push({ code, message, severity, count: new Set(ids).size, itemIds: [...new Set(ids)] });
  };
  const featured = issue.stories.filter(s => issue.featuredStoryIds.includes(s.item.id));
  if (!issue.stories.length || !featured.length) blockers.push({ code: "empty_issue", severity: "blocker", message: "没有内容或有效精选，不能发布", count: 1 });
  add("missing_featured", "精选引用不存在的条目", issue.featuredStoryIds.filter(id => !issue.stories.some(s => s.item.id === id)));
  add("unverified", "存在未核验或证据身份不匹配的解读", issue.stories.filter(({ item, analysis: a }) => {
    const e = a.editorial;
    return a.itemId !== item.id || a.contentHash !== item.contentHash || e?.version !== QUALITY_VERSION || e.status !== "verified"
      || e.sourceUrl !== item.sourceUrl || !e.snapshotHash || !e.facts.length || !e.visualMethod.trim() || !e.application.trim();
  }).map(s => s.item.id));
  add("source_not_live", "存在非真实采集条目", issue.stories.filter(s => s.item.provenance.authenticity !== "live").map(s => s.item.id));
  add("invalid_link", "原文链接无效", issue.stories.filter(s => {
    try { const u = new URL(s.item.sourceUrl); return !["http:", "https:"].includes(u.protocol) || Boolean(u.username || u.password); } catch { return true; }
  }).map(s => s.item.id));
  add("duplicate_id", "同一期存在重复条目编号", issue.stories.filter((s, i, all) => all.findIndex(o => o.item.id === s.item.id) !== i).map(s => s.item.id));
  const strict = issue.metadata.selectionPolicy === SELECTION_POLICY;
  if (!Number.isFinite(Date.parse(issue.generatedAt)) || singaporeIssueDate(issue.generatedAt) !== issue.issueDate) blockers.push({ code: "issue_date", severity: "blocker", message: "日报日期与生成时间不一致", count: 1 });
  add("invalid_assessment", "推荐判断或事件进展字段格式无效", issue.stories.filter(s => {
    try { validateAssessment(s.analysis.editorial?.assessment); validateEvent(s.analysis.editorial?.event, s.analysis.editorial?.facts.length || 0); return false; } catch { return true; }
  }).map(s => s.item.id));
  add("invalid_score", "评分与分项不一致或超出范围", issue.stories.filter(s => {
    const a = s.analysis;
    return !Number.isFinite(a.score) || Object.entries(VISUAL_SCORE_LIMITS).some(([key, max]) => {
      const n = a.scoreBreakdown[key as keyof typeof VISUAL_SCORE_LIMITS]; return !Number.isFinite(n) || n < 0 || n > max;
    }) || a.score !== Object.values(a.scoreBreakdown).reduce((n, x) => n + x, 0);
  }).map(s => s.item.id), strict ? "blocker" : "warning");
  if (!strict) warnings.push({ code: "legacy_policy", severity: "warning", message: "旧期只读回放：不重写历史评分或精选；缺少新推荐字段需重新评估后才能按新规则选用", count: 1 });
  add("missing_assessment", "缺少推荐判断或事件编号", issue.stories.filter(s => !s.analysis.editorial?.assessment || !s.analysis.editorial?.event).map(s => s.item.id), strict ? "blocker" : "warning");
  const recommendations = issue.stories.map(s => ({ itemId: s.item.id, title: s.analysis.chineseTitle || s.item.title, storedScore: s.analysis.score, ...calibrateVisualRadarRecommendation(s.analysis) }));
  add("weak_featured", "参考类或方法证据不足的条目不能进入新精选", recommendations.filter(r => issue.featuredStoryIds.includes(r.itemId) && !r.featuredEligible).map(r => r.itemId), strict ? "blocker" : "warning");
  add("low_value", "低于60分的条目不进入新日报", recommendations.filter(r => r.score < 60).map(r => r.itemId), strict ? "blocker" : "warning");
  const badDates = issue.stories.filter(({ item }) => [item.postedAt, item.eventStartsAt, item.eventEndsAt].some(d => d != null && !Number.isFinite(Date.parse(d)))
    || (item.eventStartsAt && item.eventEndsAt && Date.parse(item.eventEndsAt) < Date.parse(item.eventStartsAt))).map(s => s.item.id);
  add("invalid_date", "日期格式错误或展期结束早于开始", badDates);
  add("future_publication", "发布日期晚于日报生成时间，不能当作当天新闻", issue.stories.filter(s => s.item.postedAt && Date.parse(s.item.postedAt) > Date.parse(issue.generatedAt)).map(s => s.item.id), "warning");
  add("unknown_date", "发布日期未注明，仍须与展期区别展示", issue.stories.filter(s => !s.item.postedAt).map(s => s.item.id), "warning");
  add("missing_image", "部分条目缺少配图（未检测远程图片可访问性）", issue.stories.filter(s => !s.item.thumbnailUrl).map(s => s.item.id), "warning");
  const nonRecent = featured.filter(s => classifyFreshness(s.item, issue.generatedAt).kind !== "latest");
  if (featured.length > 10) add("featured_limit", "精选超过10条", featured.map(s => s.item.id), strict ? "blocker" : "warning");
  const sources = new Map<string, string[]>();
  for (const s of featured) { const key = s.item.sourceAccount || s.item.sourceUrl; sources.set(key, [...(sources.get(key) || []), s.item.id]); }
  add("source_limit", "单来源精选超过2条", [...sources.values()].filter(ids => ids.length > 2).flat(), strict ? "blocker" : "warning");
  if (nonRecent.length > 3) add("reference_limit", "非近期精选超过3条", nonRecent.map(s => s.item.id), strict ? "blocker" : "warning");
  const oldStories = history.filter(i => i.issueDate < issue.issueDate).flatMap(i => i.stories.map(story => ({ issueId: i.id, story })));
  const duplicates: DuplicatePair[] = [];
  for (let index = 0; index < issue.stories.length; index++) {
    const story = issue.stories[index];
    const others = [...issue.stories.slice(0, index).map(other => ({ issueId: issue.id, story: other })), ...oldStories];
    for (const other of others) {
      const match = confirmedSameEvent(story, other.story);
      // Use edition dates for historical proximity: a rolling article's current
      // publication metadata may have moved months after the original inclusion.
      if (match || areLikelySameVisualEvent({ ...story.item, postedAt: issue.issueDate }, { ...other.story.item, postedAt: other.issueId })) duplicates.push({ itemId: story.item.id, otherItemId: other.story.item.id, otherIssueId: other.issueId, confidence: match ? "confirmed" : "possible" });
    }
    const previous = oldStories.filter(p => confirmedSameEvent(story, p.story));
    if (previous.length && !hasNewEventDevelopment(story, previous.map(p => p.story))) add("previous_event", "历史事件再次入选但没有可追溯的新进展", [story.item.id], strict ? "blocker" : "warning");
    if (story.analysis.editorial?.event?.development && previous.length) warnings.push({ code: "development_review", severity: "warning", message: "新增进展的摘录已关联；仍需编辑核对实质新颖性", count: 1, itemIds: [story.item.id] });
  }
  add("duplicate_event", "本期包含已确认同一事件，应合并原文链接", duplicates.filter(p => p.confidence === "confirmed" && p.otherIssueId === issue.id).map(p => p.itemId));
  add("possible_duplicate", "疑似同事件：仅提醒核对，不自动合并", duplicates.filter(p => p.confidence === "possible").map(p => p.itemId), "warning");
  const scores = recommendations.map(r => r.score);
  if (scores.length >= 4 && Math.max(...scores) - Math.min(...scores) <= 5) warnings.push({ code: "flat_scores", severity: "warning", message: "评分集中在5分范围内，请核对区分度", count: scores.length });
  let healthCurrent = false;
  if (health) {
    const age = Date.parse(now) - Date.parse(health.generatedAt);
    healthCurrent = Number.isFinite(age) && age >= 0 && age <= 72 * 3600_000 && singaporeIssueDate(health.generatedAt) === issue.issueDate;
  }
  if (!healthCurrent) warnings.push({ code: "health_not_current", severity: "warning", message: "无本期来源健康检查，或数据已过期；不得把历史/定向检查当作本期全站覆盖", count: 1 });
  if (health?.summary.failed || health?.summary.empty) warnings.push({ code: "source_health", severity: "warning", message: "检查范围内存在失败或空来源", count: health.summary.failed + health.summary.empty });
  if (health?.summary.coreTotal && !health.summary.coreHealthy) warnings.push({ code: "core_sources", severity: "warning", message: "检查范围内核心来源均未取得内容，请核对覆盖", count: health.summary.coreTotal });
  return { issueId: issue.id, policy: SELECTION_POLICY, checkedAt: now, issueGeneratedAt: issue.generatedAt, canPublish: !blockers.length,
    blockers, warnings, evidence: { total: issue.stories.length, verified: issue.stories.filter(s => s.analysis.editorial?.status === "verified").length },
    missingImages: issue.stories.filter(s => !s.item.thumbnailUrl).length,
    scoreDistribution: { below60: scores.filter(n => n < 60).length, reference60to74: scores.filter(n => n >= 60 && n < 75).length, candidate75to84: scores.filter(n => n >= 75 && n < 85).length, high85plus: scores.filter(n => n >= 85).length },
    recommendations, duplicates, eventGroups: issue.eventGroups || [],
    sourceCoverage: health ? { checkedAt: health.generatedAt, appliesToIssue: healthCurrent, scope: "仅本次实际检查来源，不代表全部配置来源", ...health.summary } : null };
}

export function assertPublishableQuality(report: ReturnType<typeof buildVisualRadarQualityChecklist>) {
  if (report.blockers.length) throw new DeliveryBlocked(`质量检查未通过：${report.blockers.map(e => `${e.message}（${e.count}）`).join("；")}`);
}

export function assertCurrentEditorialPolicy(issue: VisualRadarIssue) {
  if (issue.metadata.selectionPolicy !== SELECTION_POLICY) throw new DeliveryBlocked("正式发布验证必须使用 editorial-v2 新日报；请重新准备、解读和生成，不要手动补写策略字段");
}
