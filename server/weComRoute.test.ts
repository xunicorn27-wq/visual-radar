import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { VisualRadarIssue } from "./visualRadarIssue";
import { deliverVisualRadarIssue } from "./weComPublisher";
import { createSendVisualRadarIssueHandler } from "./weComRoute";

describe("createSendVisualRadarIssueHandler", () => {
  it("maps dryRun=1 to the delivery gate without calling the sender", async () => {
    const sendImpl = vi.fn().mockResolvedValue({ markdown: "sent", sent: true });
    const deliverIssue = vi.fn((issueToDeliver, options) =>
      deliverVisualRadarIssue(issueToDeliver, { ...options, sendImpl })
    );
    const response = mockResponse();
    const handler = createSendVisualRadarIssueHandler({
      deliverIssue,
      getIssue: () => issue(),
    });

    await handler(mockRequest({ dryRun: "1" }), response.value, vi.fn());

    expect(deliverIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2026-07-16" }),
      { dryRun: true }
    );
    expect(sendImpl).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: false })
    );
  });

  it("maps a missing dryRun query to a formal delivery", async () => {
    const sendImpl = vi.fn().mockResolvedValue({ markdown: "sent", sent: true });
    const deliverIssue = vi.fn((issueToDeliver, options) =>
      deliverVisualRadarIssue(issueToDeliver, { ...options, sendImpl })
    );
    const response = mockResponse();
    const handler = createSendVisualRadarIssueHandler({
      deliverIssue,
      getIssue: () => issue(),
    });

    await handler(mockRequest({}), response.value, vi.fn());

    expect(deliverIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2026-07-16" }),
      { dryRun: false }
    );
    expect(sendImpl).toHaveBeenCalledOnce();
    expect(response.json).toHaveBeenCalledWith({ markdown: "sent", sent: true });
  });

  it("returns 404 when the local issue does not exist", async () => {
    const response = mockResponse();
    const handler = createSendVisualRadarIssueHandler({ getIssue: () => null });

    await handler(mockRequest({ dryRun: "1" }), response.value, vi.fn());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: "日报不存在" });
  });

  it("returns 502 when delivery fails", async () => {
    const response = mockResponse();
    const handler = createSendVisualRadarIssueHandler({
      deliverIssue: vi.fn().mockRejectedValue(new Error("delivery failed")),
      getIssue: () => issue(),
    });

    await handler(mockRequest({}), response.value, vi.fn());

    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith({
      detail: "delivery failed",
      error: "企业微信发送失败",
    });
  });
});

function mockRequest(query: Request["query"]) {
  return {
    params: { issueId: "2026-07-16" },
    query,
  } as unknown as Request;
}

function mockResponse() {
  const json = vi.fn();
  const value = { json, status: vi.fn() } as unknown as Response;
  const status = vi.mocked(value.status).mockReturnValue(value);
  return { json, status, value };
}

function issue(): VisualRadarIssue {
  return {
    featuredStoryIds: [],
    generatedAt: "2026-07-16T08:00:00.000Z",
    id: "2026-07-16",
    issueDate: "2026-07-16",
    metadata: { models: ["codex-agent"], promptVersion: "visual-daily-v1" },
    skipped: [],
    stats: { bySource: {}, byTopic: {}, storyCount: 0 },
    stories: [],
    title: "Visual Radar Daily — 2026.07.16",
  };
}
