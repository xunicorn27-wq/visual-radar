import { describe, expect, it } from "vitest";
import type { VisualRadarArchiveStory } from "./api";
import { buildVisualRadarReadUrl } from "./api";
import { filterArchiveStories, normalizeArchiveTopic, normalizeArchiveMonth, normalizeArchiveSort, sortArchiveStories } from "./visualRadarArchive";

const stories: VisualRadarArchiveStory[] = [
  { id: "a", issueId: "2026-10-23", issueDate: "2026-10-23", title: "创意肖像", originalTitle: "Portrait light", summary: "柔和光线", source: "Profoto", topic: "photography", keywords: ["布光"], thumbnailUrl: null },
  { id: "b", issueId: "2026-10-21", issueDate: "2026-10-21", title: "影棚新工具", originalTitle: "Studio tools", summary: "布光工具更新", source: "Aputure", topic: "tool", keywords: ["灯具"], thumbnailUrl: null },
];

describe("archive search", () => {
  it("matches Chinese, original titles, sources, tags, dates and normalized case", () => {
    for (const query of ["肖像", "portrait", "ＰＲＯＦＯＴＯ", "摄影", "2026-10-23"]) {
      expect(filterArchiveStories(stories, query, "all").map((story) => story.id)).toEqual(["a"]);
    }
    expect(filterArchiveStories(stories, "布光", "all")).toHaveLength(2);
  });
  it("combines every search term with the selected category", () => {
    expect(filterArchiveStories(stories, "  布光   PROFOTO  ", "photography")).toEqual([stories[0]]);
    expect(filterArchiveStories(stories, "布光", "tool")).toEqual([stories[1]]);
    expect(filterArchiveStories(stories, "肖像", "tool")).toEqual([]);
  });
  it("handles empty queries and unsupported URL categories", () => {
    expect(filterArchiveStories(stories, "  ", "all")).toEqual(stories);
    expect(normalizeArchiveTopic("tool")).toBe("tool");
    for (const value of [null, "all", "bad", "constructor", "__proto__"]) expect(normalizeArchiveTopic(value)).toBe("all");
  });
  it("uses the correct archive endpoint for local and project Pages modes", () => {
    expect(buildVisualRadarReadUrl("archive", { staticMode: false, baseUrl: "/" })).toBe("/api/visual-radar/archive");
    expect(buildVisualRadarReadUrl("archive", { staticMode: true, baseUrl: "/visual-radar/" })).toBe("/visual-radar/public-data/archive.json");
  });
  it("searches personal notes only when explicitly supplied", () => {
    expect(filterArchiveStories(stories, "下次拍摄", "all")).toEqual([]);
    expect(filterArchiveStories(stories, "下次拍摄", "all", (story) => story.id === "b" ? "下次拍摄尝试" : "")).toEqual([stories[1]]);
  });
  it("normalizes date filters and sorts without mutating source order", () => {
    expect(normalizeArchiveMonth("2026-10")).toBe("2026-10");
    expect(normalizeArchiveMonth("2026-13")).toBe("all");
    expect(normalizeArchiveMonth(null)).toBe("all");
    expect(normalizeArchiveSort("saved")).toBe("newest");
    expect(normalizeArchiveSort(null, true)).toBe("saved");
    expect(sortArchiveStories(stories, "oldest").map((story) => story.id)).toEqual(["b", "a"]);
    expect(sortArchiveStories(stories, "saved", new Map([["2026-10-21/b", "2026-10-26"], ["2026-10-23/a", "2026-10-25"]])).map((story) => story.id)).toEqual(["b", "a"]);
    expect(stories[0].id).toBe("a");
  });
});
