import type {
  VisualRadarIssue,
  VisualRadarSelectedStory,
  VisualCultureTopic,
} from "./api";

export interface VisualRadarEditorialSection {
  englishTitle: string;
  id: "culture" | "photography" | "styling" | "tools";
  index: string;
  stories: VisualRadarSelectedStory[];
  title: string;
}

const SECTION_DEFINITIONS: Array<
  Omit<VisualRadarEditorialSection, "stories"> & { topics: VisualCultureTopic[] }
> = [
  {
    englishTitle: "Styling & Outfit",
    id: "styling",
    index: "01",
    title: "造型与搭配",
    topics: ["styling", "outfit"],
  },
  {
    englishTitle: "Photography & Creators",
    id: "photography",
    index: "02",
    title: "摄影与创作者",
    topics: ["photography", "creator"],
  },
  {
    englishTitle: "Fashion Culture & Exhibitions",
    id: "culture",
    index: "03",
    title: "时尚文化与展览",
    topics: ["fashion_culture", "exhibition", "magazine"],
  },
  {
    englishTitle: "New Tools",
    id: "tools",
    index: "04",
    title: "新工具",
    topics: ["tool"],
  },
];

export function buildVisualRadarIssueLayout(issue: VisualRadarIssue | null) {
  if (!issue || issue.stories.length === 0) {
    return {
      featuredStories: [] as VisualRadarSelectedStory[],
      lead: null,
      readingMinutes: 0,
      sections: [] as VisualRadarEditorialSection[],
      topStories: [] as VisualRadarSelectedStory[],
    };
  }

  const ranked = issue.stories.toSorted(
    (left, right) => right.analysis.score - left.analysis.score
  );
  const storyById = new Map(ranked.map((story) => [story.item.id, story]));
  const featuredStories = issue.featuredStoryIds
    .map((id) => storyById.get(id))
    .filter((story): story is VisualRadarSelectedStory => Boolean(story));
  for (const story of ranked) {
    if (featuredStories.length >= 10) break;
    if (!featuredStories.some((featured) => featured.item.id === story.item.id)) {
      featuredStories.push(story);
    }
  }
  const lead = ranked.find((story) => Boolean(story.item.thumbnailUrl)) || ranked[0];
  const supporting = ranked.filter((story) => story.item.id !== lead.item.id);
  const sections = SECTION_DEFINITIONS.map(({ topics, ...section }) => ({
    ...section,
    stories: supporting.filter((story) =>
      topics.includes(story.analysis.primaryTopic)
    ),
  })).filter((section) => section.stories.length > 0);
  const textLength = ranked.reduce(
    (total, story) =>
      total +
      (story.analysis.chineseTitle?.length || 0) +
      (story.analysis.chineseSummary?.length || 0),
    0
  );

  return {
    featuredStories,
    lead,
    readingMinutes: Math.max(1, Math.ceil(textLength / 280 + ranked.length * 0.35)),
    sections,
    topStories: ranked.slice(0, 5),
  };
}
