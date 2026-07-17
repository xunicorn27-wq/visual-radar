import { describe, expect, it, vi } from "vitest";

import type { VisualRadarIssueSummary } from "../lib/api";
import { loadVisualRadarPageData } from "./VisualRadar";

describe("loadVisualRadarPageData", () => {
  it("loads only the latest issue in static mode", async () => {
    const issueDetail = { issue: { id: "2026-07-17" } };
    const getIssues = vi.fn().mockResolvedValue([{ id: "2026-07-17" }]);
    const getIssue = vi.fn().mockResolvedValue(issueDetail);
    const getSources = vi.fn();
    const getItems = vi.fn();
    const getAnalysis = vi.fn();
    const onIssueDetail = vi.fn();

    await expect(
      loadVisualRadarPageData(true, {
        getAnalysis,
        getIssue,
        getIssues,
        getItems,
        getSources,
      }, {
        onIssueDetail,
      })
    ).resolves.toEqual({
      baseData: null,
      error: null,
      issueDetail,
    });
    expect(getIssues).toHaveBeenCalledOnce();
    expect(getIssue).toHaveBeenCalledWith("2026-07-17");
    expect(getSources).not.toHaveBeenCalled();
    expect(getItems).not.toHaveBeenCalled();
    expect(getAnalysis).not.toHaveBeenCalled();
    expect(onIssueDetail).toHaveBeenCalledWith(issueDetail);
  });

  it("starts detail early and preserves base data when detail fails", async () => {
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
    let rejectDetail: ((reason: Error) => void) | undefined;
    const detail = new Promise<never>((_resolve, reject) => {
      rejectDetail = reject;
    });
    const getIssues = vi.fn().mockResolvedValue([{ id: "2026-07-17" }]);
    const getIssue = vi.fn(() => detail);
    const getSources = vi.fn(() => sources);
    const items = { items: [] };
    const analysis = { analyses: [] };
    const getItems = vi.fn().mockResolvedValue(items);
    const getAnalysis = vi.fn().mockResolvedValue(analysis);
    const onBaseData = vi.fn();
    const onError = vi.fn();
    const onIssueDetail = vi.fn();

    const loading = loadVisualRadarPageData(false, {
      getAnalysis,
      getIssue,
      getIssues,
      getItems,
      getSources,
    }, {
      onBaseData,
      onError,
      onIssueDetail,
    });
    await vi.waitFor(() => expect(getIssue).toHaveBeenCalledWith("2026-07-17"));
    expect(onBaseData).not.toHaveBeenCalled();

    resolveSources?.(registry);
    await vi.waitFor(() =>
      expect(onBaseData).toHaveBeenCalledWith({ analysis, items, registry })
    );
    rejectDetail?.(new Error("detail failed"));

    await expect(loading).resolves.toEqual({
      baseData: { analysis, items, registry },
      error: new Error("detail failed"),
      issueDetail: null,
    });
    expect(onIssueDetail).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(new Error("detail failed"));
  });

  it("does not emit state callbacks after cancellation or repeat requests", async () => {
    let active = true;
    const latestIssue: VisualRadarIssueSummary = {
      generatedAt: "2026-07-17T00:00:00.000Z",
      id: "2026-07-17",
      issueDate: "2026-07-17",
      storyCount: 1,
      title: "Visual Radar",
      topStories: ["Story"],
    };
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
    const getIssues = vi.fn().mockResolvedValue([latestIssue]);
    const getIssue = vi.fn().mockResolvedValue({ issue: { id: "2026-07-17" } });
    const getSources = vi.fn(() => sources);
    const getItems = vi.fn().mockResolvedValue({ items: [] });
    const getAnalysis = vi.fn().mockResolvedValue({ analyses: [] });
    const onBaseData = vi.fn();
    const onError = vi.fn();
    const onIssueDetail = vi.fn();
    const onSettled = vi.fn();

    const loading = loadVisualRadarPageData(false, {
      getAnalysis,
      getIssue,
      getIssues,
      getItems,
      getSources,
    }, {
      isActive: () => active,
      onBaseData,
      onError,
      onIssueDetail,
      onSettled,
    });
    await vi.waitFor(() => expect(getIssue).toHaveBeenCalledOnce());
    active = false;
    resolveSources?.(registry);
    await loading;

    expect(getIssues).toHaveBeenCalledOnce();
    expect(getIssue).toHaveBeenCalledOnce();
    expect(getSources).toHaveBeenCalledOnce();
    expect(getItems).toHaveBeenCalledOnce();
    expect(getAnalysis).toHaveBeenCalledOnce();
    expect(onBaseData).not.toHaveBeenCalled();
    expect(onIssueDetail).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});
