import type { VisualCultureTopic } from "./visualCultureSources";
import type { VisualRadarIssue } from "./visualRadarIssue";

export interface VisualRadarArchiveStory {
  id: string;
  issueId: string;
  issueDate: string;
  title: string;
  summary: string;
  originalTitle: string;
  source: string;
  topic: VisualCultureTopic;
  keywords: string[];
  thumbnailUrl: string | null;
}

export interface VisualRadarArchiveEdition {
  id: string;
  issueDate: string;
  storyCount: number;
  coverTitle: string;
  coverImage: string | null;
  topics: VisualCultureTopic[];
}

export interface VisualRadarArchive {
  issues: VisualRadarArchiveEdition[];
  stories: VisualRadarArchiveStory[];
}

// A separate, explicit public index keeps archive search off the home-page payload.
export function buildVisualRadarArchive(issues: readonly VisualRadarIssue[]): VisualRadarArchive {
  const sorted = [...issues].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  return {
    issues: sorted.map((issue) => {
      const ranked = [...issue.stories].sort((a, b) => b.analysis.score - a.analysis.score);
      const cover = issue.featuredStoryIds.map((id) => ranked.find((story) => story.item.id === id))
        .find((story) => story?.analysis.editorial?.status === "verified" && story.item.thumbnailUrl)
        || ranked.find((story) => story.analysis.editorial?.status === "verified" && story.item.thumbnailUrl)
        || ranked.find((story) => story.item.thumbnailUrl) || ranked[0];
      return {
        id: issue.id,
        issueDate: issue.issueDate,
        storyCount: issue.stories.length,
        coverTitle: cover?.analysis.chineseTitle || cover?.item.title || issue.title,
        coverImage: cover?.item.thumbnailUrl || null,
        topics: [...new Set(issue.stories.map((story) => story.analysis.primaryTopic))],
      };
    }),
    stories: sorted.flatMap((issue) => issue.stories.map(({ item, analysis }) => ({
      id: item.id,
      issueId: issue.id,
      issueDate: issue.issueDate,
      title: analysis.chineseTitle || item.title,
      summary: analysis.chineseSummary || item.text,
      originalTitle: item.title,
      source: item.sourceAccount || "Visual Radar",
      topic: analysis.primaryTopic,
      keywords: [...new Set([...(analysis.editorial?.visualTags || []), ...analysis.trendKeywords])],
      thumbnailUrl: item.thumbnailUrl || null,
    }))),
  };
}
