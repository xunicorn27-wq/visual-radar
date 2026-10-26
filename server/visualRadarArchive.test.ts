import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { VisualRadarIssue } from "./visualRadarIssue";
import { buildVisualRadarArchive } from "./visualRadarArchive";

const issues = JSON.parse(fs.readFileSync(new URL("../data/visual_radar_issues.json", import.meta.url), "utf8")).issues as VisualRadarIssue[];

describe("archive index", () => {
  it("indexes every published story without modifying the source archive", () => {
    const before = JSON.stringify(issues);
    const result = buildVisualRadarArchive(issues);
    expect(result.issues).toHaveLength(issues.length);
    expect(result.stories).toHaveLength(issues.reduce((sum, issue) => sum + issue.stories.length, 0));
    expect(result.issues.map((issue) => issue.issueDate)).toEqual(issues.map((issue) => issue.issueDate).sort().reverse());
    for (const story of result.stories) {
      expect(issues.find((issue) => issue.id === story.issueId)?.stories.some((entry) => entry.item.id === story.id)).toBe(true);
      expect(Object.keys(story).sort()).toEqual(["id", "issueId", "issueDate", "title", "summary", "originalTitle", "source", "topic", "keywords", "thumbnailUrl"].sort());
    }
    expect(JSON.stringify(issues)).toBe(before);
  });

  it("uses the highest-ranked available image and its own title for the cover", () => {
    const issue = structuredClone(issues[0]);
    issue.stories = issue.stories.slice(0, 2);
    issue.stories[0].analysis.score = 100;
    issue.stories[0].item.thumbnailUrl = null;
    issue.stories[1].analysis.score = 90;
    issue.stories[1].item.thumbnailUrl = "https://example.com/image.jpg";
    const cover = buildVisualRadarArchive([issue]).issues[0];
    expect(cover.coverImage).toBe("https://example.com/image.jpg");
    expect(cover.coverTitle).toBe(issue.stories[1].analysis.chineseTitle);
  });

  it("supports empty archives and text-only editions", () => {
    expect(buildVisualRadarArchive([])).toEqual({ issues: [], stories: [] });
    const issue = structuredClone(issues[0]);
    issue.stories = [];
    expect(buildVisualRadarArchive([issue]).issues[0]).toMatchObject({ coverTitle: issue.title, coverImage: null, storyCount: 0 });
  });
});
