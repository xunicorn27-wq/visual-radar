import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IssueQualityPanel } from "./IssueQualityPanel";
import { EventSources } from "./EventSources";

describe("quality controls and event sources", () => {
  it("does not make a quality request or allow inspection without an issue and credential", () => {
    const html = renderToStaticMarkup(createElement(IssueQualityPanel, { secret: "", issueId: "2026-10-27" }));
    expect(html).toContain("发布前质量清单"); expect(html).toContain("disabled");
    expect(html).toContain("只读检查，不采集、不发送");
    expect(renderToStaticMarkup(createElement(IssueQualityPanel, { secret: "placeholder" }))).toContain("disabled");
  });
  it("renders retained original links but never makes unsafe source URLs clickable", () => {
    const html = renderToStaticMarkup(createElement(EventSources, { sources: [
      { itemId: "a", title: "原文A", source: "Source", sourceUrl: "https://example.com/a", issueId: "2026-10-26" },
      { itemId: "b", title: "原文B", source: "Source", sourceUrl: "javascript:alert(1)" },
    ] }));
    expect(html).toContain('href="https://example.com/a"'); expect(html).toContain("2026-10-26");
    expect(html).not.toContain("javascript:"); expect(html).toContain("原文B");
  });
});
