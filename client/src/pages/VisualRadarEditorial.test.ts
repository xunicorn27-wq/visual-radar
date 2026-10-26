import fs from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";

import type { VisualRadarIssue } from "../lib/api";
import { visualStoryAnchor, VisualStory } from "../components/visual-radar/VisualStory";
import { VisualRadarIssueContent } from "./VisualRadarIssue";

const issues = JSON.parse(fs.readFileSync(
  new URL("../../../data/visual_radar_issues.json", import.meta.url), "utf8"
)).issues as VisualRadarIssue[];

const render = (element: ReactNode) => renderToStaticMarkup(createElement(Router, { ssrPath: "/", children: element }));

describe("editorial issue navigation", () => {
  it.each(issues.map((issue) => [issue.id, issue] as const))(
    "preserves every story and resolves every contents link in %s", (_id, issue) => {
      const html = render(createElement(VisualRadarIssueContent, { issue }));
      const articleIds = [...html.matchAll(/<article id="([^"]+)"/g)].map((match) => match[1]);
      expect(articleIds).toHaveLength(issue.stories.length);
      expect(new Set(articleIds).size).toBe(articleIds.length);
      for (const story of issue.stories) expect(articleIds).toContain(visualStoryAnchor(story.item.id));
      const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
      for (const link of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(link[1])).toBe(true);
      expect(html.indexOf('aria-label="本期重点"')).toBeLessThan(html.indexOf("完整精选目录"));
    }
  );

  it("keeps text-only, undated stories readable without presenting capture time as publication", () => {
    const story = structuredClone(issues[0].stories[0]);
    story.item.thumbnailUrl = null;
    story.item.postedAt = null;
    const html = render(createElement(VisualStory, { story }));
    expect(html).toContain("发布日期未注明");
    expect(html).toContain("VISUAL NOTE");
    expect(html).toContain("展开解读");
    expect(html).not.toContain("<img");
    expect(html).toContain(story.analysis.chineseSummary!);
  });

  it("prioritizes the cover image and defers supporting images", () => {
    const story = issues[0].stories.find((entry) => entry.item.thumbnailUrl)!;
    const cover = render(createElement(VisualStory, { story, variant: "lead" }));
    const card = render(createElement(VisualStory, { story }));
    expect(cover).toContain('loading="eager"');
    expect(cover).toContain('fetchPriority="high"');
    expect(card).not.toContain('loading="eager"');
    expect(card).toContain('loading="lazy"');
    expect(card).toContain("关闭图片");
  });

  it("surfaces a short creative suggestion only when backed by verified editorial content", () => {
    const story = structuredClone(issues.flatMap((issue) => issue.stories).find((entry) => entry.analysis.editorial?.status === "verified")!);
    story.analysis.editorial!.application = "创作建议：试试侧光。随后比较两种材质。";
    const html = render(createElement(VisualStory, { story }));
    expect(html).toContain("可以借鉴 · 编辑建议");
    expect(html).toContain("<p>试试侧光。</p>");
    expect(html.indexOf("可以借鉴")).toBeLessThan(html.indexOf("原文事实与创作参考"));
    story.analysis.editorial!.status = "insufficient";
    expect(render(createElement(VisualStory, { story }))).not.toContain("可以借鉴");
  });
});
