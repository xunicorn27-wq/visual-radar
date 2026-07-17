import { describe, expect, it, vi } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import {
  createOpenAiVisualRadarProvider,
  getConfiguredOpenAiVisualRadarProvider,
} from "./openAiVisualRadarProvider";

const item = createIntelItem({
  capturedAt: "2026-07-16T01:00:00.000Z",
  hashtags: [],
  id: "visual-1",
  keywords: ["photography", "creator"],
  lang: "en",
  market: "EU",
  mediaUrls: [],
  metrics: emptyIntelMetrics(),
  postedAt: "2026-07-16T00:30:00.000Z",
  provenance: {
    authenticity: "live",
    collector: "visual-radar-rss",
    evidenceUrl: "https://example.com/feed",
    fetchedAt: "2026-07-16T01:00:00.000Z",
    label: "真实采集",
    sourceRecordId: "https://example.com/story",
  },
  signalType: "inspiration_signal",
  source: "website",
  sourceAccount: "Independent Magazine",
  sourceType: "inspiration",
  sourceUrl: "https://example.com/story",
  text: "A photo series studies youth identity in public space at night.",
  thumbnailUrl: "https://images.example.com/story.jpg",
  title: "Youth after dark",
});

describe("getConfiguredOpenAiVisualRadarProvider", () => {
  it("returns null when no OpenAI API key is configured", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getConfiguredOpenAiVisualRadarProvider()).toBeNull();

    restoreEnvValue("OPENAI_API_KEY", original);
  });
});

describe("createOpenAiVisualRadarProvider", () => {
  it("requests Chinese visual-culture analysis without product conversion fields", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [
                  {
                    chineseSummary: "一组关注夜间公共空间与青年身份的摄影作品。",
                    chineseTitle: "青年摄影重新观察夜间公共空间",
                    itemId: "visual-1",
                    primaryTopic: "photography",
                    scoreBreakdown: {
                      informationSpecificity: 12,
                      novelty: 16,
                      professionalRelevance: 17,
                      sourceQuality: 8,
                      timeliness: 5,
                      visualInspiration: 26,
                    },
                    selectionRationale: "视觉方法明确，兼具青年文化观察。",
                    trendKeywords: ["夜间摄影", "青年身份"],
                  },
                ],
              }),
            },
          },
        ],
      }),
      ok: true,
      status: 200,
      text: async () => "",
    }));
    const provider = createOpenAiVisualRadarProvider({
      apiKey: "test-key",
      fetch: fetchMock,
      model: "gpt-test",
    });

    const [result] = await provider([item], {
      analyzedAt: "2026-07-16T02:00:00.000Z",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    const serializedMessages = JSON.stringify(body.messages);

    expect(body).toMatchObject({
      model: "gpt-test",
      response_format: { type: "json_object" },
    });
    expect(serializedMessages).toContain("中文标题");
    expect(serializedMessages).toContain("180至260个中文字符");
    expect(serializedMessages).toContain("可独立阅读");
    expect(serializedMessages).toContain("Independent Magazine");
    expect(serializedMessages).not.toMatch(/SKU|shouldShoot|shootAngle/i);
    expect(result).toMatchObject({
      chineseTitle: "青年摄影重新观察夜间公共空间",
      itemId: "visual-1",
      primaryTopic: "photography",
      score: 84,
    });
  });

  it("does not expose provider response details or key fragments in errors", async () => {
    const provider = createOpenAiVisualRadarProvider({
      apiKey: "test-key",
      fetch: async () => ({
        json: async () => ({}),
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: {
              code: "invalid_api_key",
              message: "Incorrect API key provided: sk-secret-fragment",
            },
          }),
      }),
      model: "gpt-test",
    });

    await expect(provider([item])).rejects.toThrow(
      "OpenAI visual analysis failed (401): invalid_api_key"
    );
    await expect(provider([item])).rejects.not.toThrow("sk-secret-fragment");
  });
});

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
