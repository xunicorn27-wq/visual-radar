import type { IntelItem } from "./intelItem";

export function verifiedDateCorrections(original: IntelItem, candidate: IntelItem) {
  if (candidate.sourceEvidence?.status !== "ready" || candidate.id !== original.id || candidate.contentHash !== original.contentHash || candidate.sourceUrl !== original.sourceUrl) {
    throw new Error("日期勘误必须对应已取得正文的原条目");
  }
  const changes: Array<{ field: "postedAt" | "eventStartsAt" | "eventEndsAt"; previous: string | null; corrected: string | null }> = [];
  for (const field of ["postedAt", "eventStartsAt", "eventEndsAt"] as const) {
    const date = candidate[field];
    if (date === undefined || (date === null && field !== "postedAt")) continue;
    if (date !== null && !Number.isFinite(Date.parse(date))) continue;
    if ((original[field] || null) !== date) changes.push({ field, previous: original[field] || null, corrected: date });
  }
  return changes;
}
