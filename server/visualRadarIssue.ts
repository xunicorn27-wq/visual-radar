import fs from "node:fs";
import path from "node:path";

import type { VisualCultureTopic } from "./visualCultureSources";
import type {
  VisualRadarSelectedStory,
  VisualRadarSkippedStory,
} from "./visualRadarDailySelector";

export interface VisualRadarIssue {
  featuredStoryIds: string[];
  generatedAt: string;
  id: string;
  issueDate: string;
  metadata: {
    models: string[];
    promptVersion: string;
  };
  skipped: VisualRadarSkippedStory[];
  stats: {
    bySource: Record<string, number>;
    byTopic: Partial<Record<VisualCultureTopic, number>>;
    storyCount: number;
  };
  stories: VisualRadarSelectedStory[];
  title: string;
}

export interface VisualRadarIssueSummary {
  generatedAt: string;
  id: string;
  issueDate: string;
  storyCount: number;
  title: string;
  topStories: string[];
}

interface VisualRadarIssueArchive {
  issues: VisualRadarIssue[];
}

export function createVisualRadarIssue(
  selection: {
    eligible?: VisualRadarSelectedStory[];
    selected: VisualRadarSelectedStory[];
    skipped: VisualRadarSkippedStory[];
  },
  options: { existingIds: string[]; now?: string }
): VisualRadarIssue {
  const generatedAt = options.now || new Date().toISOString();
  const issueDate = generatedAt.slice(0, 10);
  const stories = selection.eligible || selection.selected;
  const bySource: Record<string, number> = {};
  const byTopic: Partial<Record<VisualCultureTopic, number>> = {};

  for (const story of stories) {
    const source = story.item.sourceAccount || "Unknown source";
    bySource[source] = (bySource[source] || 0) + 1;
    const topic = story.analysis.primaryTopic;
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  }

  return {
    featuredStoryIds: selection.selected.map((story) => story.item.id).slice(0, 10),
    generatedAt,
    id: issueDate,
    issueDate,
    metadata: {
      models: Array.from(
        new Set(stories.map((story) => story.analysis.model))
      ),
      promptVersion:
        stories[0]?.analysis.promptVersion || "visual-daily-v1",
    },
    skipped: structuredClone(selection.skipped),
    stats: {
      bySource,
      byTopic,
      storyCount: stories.length,
    },
    stories: structuredClone(stories),
    title: `Visual Radar Daily — ${issueDate.replace(/-/g, ".")}`,
  };
}

export function createVisualRadarIssueStore(archivePath: string) {
  function readRawArchive(): VisualRadarIssueArchive {
    if (!fs.existsSync(archivePath)) return { issues: [] };
    return JSON.parse(fs.readFileSync(archivePath, "utf-8")) as VisualRadarIssueArchive;
  }

  function readArchive(): VisualRadarIssueArchive {
    return normalizeArchive(readRawArchive());
  }

  function writeArchive(archive: VisualRadarIssueArchive) {
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.writeFileSync(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf-8");
  }

  return {
    getIssue(issueId: string): VisualRadarIssue | null {
      const rawArchive = readRawArchive();
      const issueDate = rawArchive.issues.find((issue) => issue.id === issueId)?.issueDate || issueId;
      return normalizeArchive(rawArchive).issues.find((issue) => issue.issueDate === issueDate) || null;
    },
    listIssues(): VisualRadarIssue[] {
      return readArchive().issues.toSorted((left, right) =>
        right.generatedAt.localeCompare(left.generatedAt)
      );
    },
    saveIssue(issue: VisualRadarIssue): VisualRadarIssue {
      const archive = readArchive();
      archive.issues = [
        normalizeIssue(issue),
        ...archive.issues.filter((existing) => existing.issueDate !== issue.issueDate),
      ];
      writeArchive(archive);
      return issue;
    },
  };
}

function normalizeArchive(archive: VisualRadarIssueArchive): VisualRadarIssueArchive {
  const byDate = new Map<string, VisualRadarIssue[]>();
  for (const issue of archive.issues) {
    const normalized = normalizeIssue(issue);
    const existing = byDate.get(normalized.issueDate) || [];
    existing.push(normalized);
    byDate.set(normalized.issueDate, existing);
  }

  const issues = Array.from(byDate.values()).map((sameDayIssues) => {
    const newestFirst = sameDayIssues.toSorted((left, right) =>
      right.generatedAt.localeCompare(left.generatedAt)
    );
    const latest = newestFirst[0];
    const stories = dedupeStories(newestFirst.flatMap((issue) => issue.stories));
    return rebuildIssue(latest, stories, latest.featuredStoryIds);
  });
  return { issues };
}

function normalizeIssue(issue: VisualRadarIssue): VisualRadarIssue {
  const stories = dedupeStories(issue.stories || []);
  const featuredStoryIds = resolveFeaturedStoryIds(
    stories,
    Array.isArray(issue.featuredStoryIds) ? issue.featuredStoryIds : []
  );
  return rebuildIssue(issue, stories, featuredStoryIds);
}

function rebuildIssue(
  issue: VisualRadarIssue,
  stories: VisualRadarSelectedStory[],
  featuredStoryIds: string[]
): VisualRadarIssue {
  const bySource: Record<string, number> = {};
  const byTopic: Partial<Record<VisualCultureTopic, number>> = {};
  for (const story of stories) {
    const source = story.item.sourceAccount || "Unknown source";
    bySource[source] = (bySource[source] || 0) + 1;
    const topic = story.analysis.primaryTopic;
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  }
  return {
    ...structuredClone(issue),
    featuredStoryIds: resolveFeaturedStoryIds(stories, featuredStoryIds),
    id: issue.issueDate,
    stats: { bySource, byTopic, storyCount: stories.length },
    stories: structuredClone(stories),
  };
}

function dedupeStories(stories: readonly VisualRadarSelectedStory[]) {
  const seen = new Set<string>();
  return stories.filter((story) => {
    if (seen.has(story.item.id)) return false;
    seen.add(story.item.id);
    return true;
  });
}

function resolveFeaturedStoryIds(
  stories: readonly VisualRadarSelectedStory[],
  requestedIds: readonly string[]
) {
  const storyIds = new Set(stories.map((story) => story.item.id));
  const resolved = requestedIds.filter((id, index) =>
    storyIds.has(id) && requestedIds.indexOf(id) === index
  );
  for (const story of stories) {
    if (resolved.length >= 10) break;
    if (!resolved.includes(story.item.id)) resolved.push(story.item.id);
  }
  return resolved.slice(0, 10);
}

export function summarizeVisualRadarIssue(
  issue: VisualRadarIssue
): VisualRadarIssueSummary {
  return {
    generatedAt: issue.generatedAt,
    id: issue.id,
    issueDate: issue.issueDate,
    storyCount: issue.stats.storyCount,
    title: issue.title,
    topStories: issue.stories
      .slice(0, 3)
      .map((story) => story.analysis.chineseTitle || story.item.title),
  };
}

export function getAdjacentVisualRadarIssueIds(
  issues: readonly VisualRadarIssue[],
  issueId: string
) {
  const sorted = [...issues].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt)
  );
  const index = sorted.findIndex((issue) => issue.id === issueId);
  return {
    nextId: index > 0 ? sorted[index - 1].id : null,
    previousId: index >= 0 && index < sorted.length - 1 ? sorted[index + 1].id : null,
  };
}
