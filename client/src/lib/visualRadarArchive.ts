import type { VisualCultureTopic, VisualRadarArchiveStory, VisualRadarSelectedStory } from "./api";

export const ARCHIVE_TOPICS: Record<VisualCultureTopic, string> = {
  photography: "摄影", styling: "造型", outfit: "搭配", exhibition: "展览",
  creator: "创作者", fashion_culture: "时尚文化", magazine: "出版", tool: "工具",
};

export function normalizeArchiveTopic(value: string | null): VisualCultureTopic | "all" {
  return value && Object.hasOwn(ARCHIVE_TOPICS, value) ? value as VisualCultureTopic : "all";
}

export function filterArchiveStories(
  stories: readonly VisualRadarArchiveStory[], query: string, topic: VisualCultureTopic | "all",
  extraText: (story: VisualRadarArchiveStory) => string = () => "",
) {
  const terms = query.normalize("NFKC").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return stories.filter((story) => {
    if (topic !== "all" && topic !== story.topic) return false;
    const text = [story.title, story.originalTitle, story.summary, story.source,
      story.issueDate, ARCHIVE_TOPICS[story.topic], ...story.keywords, extraText(story)]
      .join(" ").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export type ArchiveSort = "newest" | "oldest" | "saved";
export function normalizeArchiveMonth(value: string | null) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : "all";
}
export function normalizeArchiveSort(value: string | null, savedOnly = false): ArchiveSort {
  if (value === "oldest") return "oldest";
  if (value === "newest") return "newest";
  return savedOnly ? "saved" : "newest";
}
export function sortArchiveStories<T extends VisualRadarArchiveStory>(stories: readonly T[], sort: ArchiveSort, savedDates: ReadonlyMap<string, string> = new Map()): T[] {
  return [...stories].sort((a, b) => {
    const left = sort === "saved" ? savedDates.get(`${a.issueId}/${a.id}`) || a.issueDate : a.issueDate;
    const right = sort === "saved" ? savedDates.get(`${b.issueId}/${b.id}`) || b.issueDate : b.issueDate;
    return sort === "oldest" ? left.localeCompare(right) : right.localeCompare(left);
  });
}
export function archiveStoryFromSelection({ item, analysis }: VisualRadarSelectedStory, issueId: string): VisualRadarArchiveStory {
  return {
    id: item.id, issueId, issueDate: issueId,
    title: analysis.chineseTitle || item.title, summary: analysis.chineseSummary || item.text,
    originalTitle: item.title, source: item.sourceAccount || "Visual Radar",
    topic: analysis.primaryTopic, keywords: analysis.trendKeywords, thumbnailUrl: item.thumbnailUrl || null,
  };
}
