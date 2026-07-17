import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { prepareVisualRadarAgentBatch } from "./visualRadarAgentBatch";

describe("prepareVisualRadarAgentBatch", () => {
  it("prepares only recent live items that still need value screening", () => {
    const recent = buildItem("recent", "2026-07-16T10:00:00.000Z");
    const cached = buildItem("cached", "2026-07-16T09:00:00.000Z");
    const old = buildItem("old", "2026-07-12T09:00:00.000Z");
    const planned = buildItem("planned", "2026-07-16T08:00:00.000Z", "planned");

    const batch = prepareVisualRadarAgentBatch({
      analysisArtifact: {
        analyses: [{ contentHash: cached.contentHash } as never],
        failures: [],
        generatedAt: "2026-07-16T11:00:00.000Z",
        promptVersion: "visual-daily-v1",
      },
      itemsArtifact: {
        failures: [],
        generatedAt: "2026-07-16T11:00:00.000Z",
        items: [recent, cached, old, planned],
        schemaVersion: "1",
      },
      now: "2026-07-16T12:00:00.000Z",
    });

    expect(batch.stage).toBe("value_screening");
    expect(batch.candidates.map((item) => item.id)).toEqual(["recent"]);
    expect(batch.summary).toEqual({
      cached: 1,
      candidates: 1,
      excluded: 2,
      total: 4,
    });
  });
});

function buildItem(
  id: string,
  postedAt: string,
  authenticity: "live" | "planned" = "live"
) {
  return createIntelItem({
    capturedAt: postedAt,
    hashtags: [],
    id,
    keywords: ["photography"],
    lang: "en",
    market: "EU",
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt,
    provenance: { authenticity, label: "source" },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount: `Source ${id}`,
    sourceType: "inspiration",
    sourceUrl: `https://example.com/${id}`,
    text: `Summary ${id}`,
    thumbnailUrl: null,
    title: `Title ${id}`,
  });
}
