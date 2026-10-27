import type { VisualRadarAnalysis } from "./visualRadarAnalysis";

export type RecommendationBand = "精选候选" | "普通参考" | "不推荐";
export const FEATURE_SCORE = 75;

// Evidence confirms provenance, not importance. Caps apply to new selection;
// historical stored scores and featured lists are never rewritten.
export function calibrateVisualRadarRecommendation(analysis: VisualRadarAnalysis) {
  const e = analysis.editorial;
  let cap = 100;
  const reasons: string[] = [];
  const lower = (value: number, why: string) => { cap = Math.min(cap, value); reasons.push(why); };
  if (e?.status !== "verified") lower(25, "缺少可核对正文");
  if (e?.status === "verified") {
    if (e.facts.length < 2) lower(79, "仅有一条事实证据");
    if (!e.assessment) lower(74, "尚未按新规则评估推荐强度");
    else {
      const a = e.assessment;
      if (["announcement", "product_roundup", "trend_roundup"].includes(a.contentKind)) lower(74, "公告或汇总类信息不直接进入精选");
      if (a.contentKind === "vendor_case") lower(84, "厂商案例需区分演示与独立验证");
      if (a.methodEvidence === "none") lower(59, "没有具体视觉方法依据");
      if (a.methodEvidence === "general") lower(74, "视觉方法依据较笼统");
    }
    if (analysis.scoreBreakdown.professionalRelevance < 15 || analysis.scoreBreakdown.visualInspiration < 20) lower(74, "创作相关性或视觉参考不足");
    if (analysis.scoreBreakdown.sourceQuality <= 6) lower(79, "来源质量需谨慎");
  }
  const score = Math.min(analysis.score, cap);
  return { score, cap, featuredEligible: score >= FEATURE_SCORE, band: (score >= FEATURE_SCORE ? "精选候选" : score >= 60 ? "普通参考" : "不推荐") as RecommendationBand, reasons };
}
