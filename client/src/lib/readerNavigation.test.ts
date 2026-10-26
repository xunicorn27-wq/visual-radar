import { describe, expect, it, vi } from "vitest";
import { archiveCardAnchor, buildIssueShareUrl, copyReaderLink, readReaderReturn, readingPercentage } from "./readerNavigation";

describe("reader links and return context", () => {
  it("builds project-base article and issue links without search or return state", () => {
    expect(buildIssueShareUrl("https://example.com", "/visual-radar/", "2026-10-23", "sample"))
      .toBe("https://example.com/visual-radar/issues/2026-10-23/#story-sample");
    expect(buildIssueShareUrl("http://127.0.0.1:3210", "/", "2026-10-23"))
      .toBe("http://127.0.0.1:3210/issues/2026-10-23/");
    expect(new URL(buildIssueShareUrl("https://example.com", "/visual-radar/", "2026-10-23", "a&b?c")).search).toBe("");
    expect(() => buildIssueShareUrl("https://example.com", "/", "../saved")).toThrow();
  });
  it("accepts archive history state and derives the visible return label", () => {
    const state = { href: "/saved?q=private+note&month=2026-10", label: "untrusted", shown: 48, anchor: archiveCardAnchor("2026-10-23", "item") };
    expect(readReaderReturn(state)).toEqual({ ...state, label: "返回我的收藏" });
    expect(readReaderReturn({ ...state, href: "/issues?topic=photography" })?.label).toBe("返回浏览结果");
  });
  it("rejects unrelated destinations and malformed restore positions", () => {
    const valid = { href: "/issues", shown: 24, anchor: "archive-2026-10-23" };
    for (const href of ["https://example.com", "//example.com", "/issues/../saved", "/issues#bad", "/admin", "/savedness", "/issues\\evil"]) {
      expect(readReaderReturn({ ...valid, href })).toBeNull();
    }
    for (const shown of [-1, 0, NaN, 10001, 24.5]) expect(readReaderReturn({ ...valid, shown })).toBeNull();
    expect(readReaderReturn(null)).toBeNull();
    expect(readReaderReturn({ ...valid, anchor: "#missing" })).toBeNull();
  });
});

describe("reading position", () => {
  it("clamps the percentage at the beginning and end of a long issue", () => {
    expect(readingPercentage(0, 200, 3000, 800)).toBe(0);
    expect(readingPercentage(1300, 200, 3000, 800)).toBe(50);
    expect(readingPercentage(2400, 200, 3000, 800)).toBe(100);
    expect(readingPercentage(9999, 200, 3000, 800)).toBe(100);
  });
  it("handles short pages and recalculates when expanded text increases height", () => {
    expect(readingPercentage(0, 200, 300, 800)).toBe(0);
    expect(readingPercentage(200, 200, 300, 800)).toBe(100);
    expect(readingPercentage(1300, 200, 5200, 800)).toBe(25);
  });
});

describe("copy link feedback", () => {
  it("only reports success after the clipboard operation resolves", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    expect(await copyReaderLink("https://example.com/issue", write)).toBe(true);
    expect(write).toHaveBeenCalledWith("https://example.com/issue");
  });
  it("requests manual fallback when clipboard is missing or denies permission", async () => {
    expect(await copyReaderLink("link", undefined)).toBe(false);
    expect(await copyReaderLink("link", vi.fn().mockRejectedValue(new Error("denied")))).toBe(false);
  });
});
