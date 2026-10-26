import type { VisualCultureTopic, VisualRadarArchiveStory } from "./api";

export const ARCHIVE_TOPICS: Record<VisualCultureTopic, string> = {
  photography: "摄影", styling: "造型", outfit: "搭配", exhibition: "展览",
  creator: "创作者", fashion_culture: "时尚文化", magazine: "出版", tool: "工具",
};

export function normalizeArchiveTopic(value: string | null): VisualCultureTopic | "all" {
  return value && Object.hasOwn(ARCHIVE_TOPICS, value) ? value as VisualCultureTopic : "all";
}

export function filterArchiveStories(
  stories: readonly VisualRadarArchiveStory[], query: string, topic: VisualCultureTopic | "all",
) {
  const terms = query.normalize("NFKC").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return stories.filter((story) => {
    if (topic !== "all" && topic !== story.topic) return false;
    const text = [story.title, story.originalTitle, story.summary, story.source,
      story.issueDate, ARCHIVE_TOPICS[story.topic], ...story.keywords]
      .join(" ").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
