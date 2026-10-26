import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import VisualRadar from "./VisualRadar";
import VisualRadarArchive, { VisualRadarSaved } from "./VisualRadarArchive";
import VisualRadarNotFound from "./VisualRadarNotFound";
import { VisualRadarIssueContent } from "./VisualRadarIssue";
import type { VisualRadarIssue } from "../lib/api";
import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";

const render = (children: ReactNode, path = "/") => renderToStaticMarkup(createElement(Router, { ssrPath: path, ssrSearch: "", children }));

describe("keyboard navigation entry", () => {
  it.each([
    ["home loading", VisualRadar], ["archive loading", VisualRadarArchive],
    ["empty saved", VisualRadarSaved], ["not found", VisualRadarNotFound],
  ] as const)("provides one focusable skip target after the masthead in %s", (_label, Page) => {
    const html = render(createElement(Page));
    expect(html).toContain('href="#main-content"');
    expect([...html.matchAll(/id="main-content"/g)]).toHaveLength(1);
    expect(html).toMatch(/id="main-content" tabindex="-1"/);
    expect(html.indexOf('id="main-content"')).toBeGreaterThan(html.indexOf("</header>"));
  });
  it("provides a recovery link and focus target for an empty issue", () => {
    const issue: VisualRadarIssue = { id: "2026-10-23", issueDate: "2026-10-23", generatedAt: "2026-10-23T01:00:00Z", title: "Empty", stories: [], featuredStoryIds: [], skipped: [], metadata: { models: [], promptVersion: "test" }, stats: { storyCount: 0, bySource: {}, byTopic: {} } };
    const html = render(createElement(VisualRadarIssueContent, { issue }));
    expect(html).toContain('id="main-content" tabindex="-1"');
    expect(html).toContain('href="/issues"');
  });
  it("marks the archive navigation while reading an issue", () => {
    const html = render(createElement(VisualRadarMasthead, { showSources: false }), "/issues/2026-10-23");
    const archiveLink = html.match(/<a\b[^>]*href="\/issues"[^>]*>/)?.[0];
    expect(archiveLink).toContain('aria-current="page"');
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
  });
});
