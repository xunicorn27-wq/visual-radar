import { describe, expect, it } from "vitest";

import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { prepareVisualRadarAgentBatch } from "./visualRadarAgentBatch";

describe("prepareVisualRadarAgentBatch", () => {
  it("requeues old evidence-only analyses instead of assuming they satisfy the new policy", () => {
    const cached = buildItem("old-policy", "2026-07-16T09:00:00Z");
    const batch = prepareVisualRadarAgentBatch({
      analysisArtifact: { analyses: [{ contentHash: cached.contentHash, editorial: { version: "evidence-v1", status: "verified" } } as never], failures: [], generatedAt: "2026-07-16T10:00:00Z", promptVersion: "visual-daily-v1" },
      itemsArtifact: { items: [cached], failures: [], generatedAt: "2026-07-16T10:00:00Z", schemaVersion: "1" }, now: "2026-07-16T12:00:00Z",
    });
    expect(batch.selectionPolicy).toBe("editorial-v2");
    expect(batch.summary.cached).toBe(0); expect(batch.candidates[0].id).toBe(cached.id);
  });
  it("prepares only recent live items that still need value screening", () => {
    const recent = buildItem("recent", "2026-07-16T10:00:00.000Z");
    const cached = buildItem("cached", "2026-07-16T09:00:00.000Z");
    const old = buildItem("old", "2026-07-12T09:00:00.000Z");
    const planned = buildItem("planned", "2026-07-16T08:00:00.000Z", "planned");

    const batch = prepareVisualRadarAgentBatch({
      analysisArtifact: {
        analyses: [{ contentHash: cached.contentHash, editorial: { version: "evidence-v1", status: "verified", assessment: { contentKind: "artwork", methodEvidence: "specific", rationale: "有明确方法" }, event: { key: "test-event", label: "测试" } } } as never],
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
    expect(batch.instructions.join("\n")).toContain(
      "data/visual_radar_agent_output.json"
    );
    expect(batch.instructions.join("\n")).toMatch(
      /禁止直接修改.*visual_radar_analysis\.json/
    );
    expect(batch.instructions.join("\n")).toContain("pnpm agent:import");
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
