import { describe, expect, it, vi } from "vitest";

import { loadVisualRadarPageData } from "./VisualRadar";

describe("loadVisualRadarPageData", () => {
  it("loads only the latest issue in static mode", async () => {
    const issueDetail = { issue: { id: "2026-07-17" } };
    const getIssues = vi.fn().mockResolvedValue([{ id: "2026-07-17" }]);
    const getIssue = vi.fn().mockResolvedValue(issueDetail);
    const getSources = vi.fn();
    const getItems = vi.fn();
    const getAnalysis = vi.fn();

    await expect(
      loadVisualRadarPageData(true, {
        getAnalysis,
        getIssue,
        getIssues,
        getItems,
        getSources,
      })
    ).resolves.toEqual({
      analysis: null,
      issueDetail,
      items: null,
      registry: null,
    });
    expect(getIssues).toHaveBeenCalledOnce();
    expect(getIssue).toHaveBeenCalledWith("2026-07-17");
    expect(getSources).not.toHaveBeenCalled();
    expect(getItems).not.toHaveBeenCalled();
    expect(getAnalysis).not.toHaveBeenCalled();
  });

  it("starts independent server reads without delaying the latest issue detail", async () => {
    const registry = {
      coverage: {},
      generatedAt: "2026-07-17T00:00:00.000Z",
      sources: [],
      summary: { live: 1, planned: 0, total: 1 },
    };
    let resolveSources: ((value: typeof registry) => void) | undefined;
    const sources = new Promise<typeof registry>((resolve) => {
      resolveSources = resolve;
    });
    const getIssues = vi.fn().mockResolvedValue([{ id: "2026-07-17" }]);
    const getIssue = vi.fn().mockResolvedValue({ issue: { id: "2026-07-17" } });
    const getSources = vi.fn(() => sources);
    const getItems = vi.fn().mockResolvedValue({ items: [] });
    const getAnalysis = vi.fn().mockResolvedValue({ analyses: [] });

    const loading = loadVisualRadarPageData(false, {
      getAnalysis,
      getIssue,
      getIssues,
      getItems,
      getSources,
    });
    await vi.waitFor(() => expect(getIssue).toHaveBeenCalledWith("2026-07-17"));
    expect(getSources).toHaveBeenCalledOnce();
    expect(getItems).toHaveBeenCalledOnce();
    expect(getAnalysis).toHaveBeenCalledOnce();

    resolveSources?.(registry);
    await loading;
  });
});
