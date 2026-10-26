import { describe, expect, it, vi } from "vitest";
import { collectVisualRadarItems, DEFAULT_VISUAL_RADAR_FEEDS, fetchUrlText } from "./visualRadarCollector";
import { isAllowedEvidenceRedirect } from "./visualRadarEvidence";
import { updateSourceHealth } from "./visualRadarSourceHealth";

describe("source maintenance", () => {
  it("uses the supported paginated Met endpoint and accepts its current department label", async () => {
    const source = DEFAULT_VISUAL_RADAR_FEEDS.find((s) => s.sourceId === "met-costume-institute")!;
    expect(source.feedUrl).toContain("/v1.1/search?");
    expect(new URL(source.feedUrl).searchParams.get("limit")).toBe("32");
    const result = await collectVisualRadarItems({ sources: [source], limitPerSource: 2, fetchText: async (url) => {
      if (url === source.feedUrl) return JSON.stringify({ objectIDs: [1, 2, 3], total: 300 });
      const id = Number(url.split("/").at(-1));
      return JSON.stringify({ department: id === 3 ? "Other Department" : id === 2 ? "Costume Institute" : "The Costume Institute", title: "Dress", objectName: "Dress", objectURL: `https://www.metmuseum.org/art/collection/search/${id}`, objectDate: "1920", primaryImage: "" });
    } });
    expect(result.items).toHaveLength(2); expect(result.failures).toHaveLength(0);
    expect(result.items.every((i) => i.postedAt === null)).toBe(true);
  });
  it("bounds transient retries and stops on access denial or a retired endpoint", async () => {
    const pause = vi.fn(async () => {});
    const transient = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValue(new Response("feed", { status: 200 }));
    expect(await fetchUrlText("https://example.com", transient, pause)).toBe("feed"); expect(transient).toHaveBeenCalledTimes(2);
    for (const code of [403, 410]) {
      const blocked = vi.fn(async () => new Response("blocked", { status: code }));
      await expect(fetchUrlText("https://example.com", blocked, pause)).rejects.toThrow(`HTTP ${code}`);
      expect(blocked).toHaveBeenCalledOnce();
    }
    const down = vi.fn(async () => new Response("down", { status: 503 }));
    await expect(fetchUrlText("https://example.com", down, pause)).rejects.toThrow("503"); expect(down).toHaveBeenCalledTimes(3);
  });
  it("permits only the confirmed same-path Runway migration", () => {
    const old = new URL("https://runwayml.com/research/example");
    expect(isAllowedEvidenceRedirect(old, new URL("https://runway.com/research/example"))).toBe(true);
    for (const target of ["https://runway.com/other", "https://evil.runway.com/research/example", "http://runway.com/research/example", "https://runway.com/research/example?changed=1", "https://user@runway.com/research/example"]) expect(isAllowedEvidenceRedirect(old, new URL(target))).toBe(false);
  });
  it("does not roll live health back when a historical report is replayed", () => {
    const old = { items: [], failures: [{ sourceId: "tokyo-photo-museum", feedUrl: "https://topmuseum.jp", error: "503" }], generatedAt: "2026-10-23T07:00:00Z", schemaVersion: "1" as const };
    const previous = updateSourceHealth(null, { ...old, generatedAt: "2026-10-26T07:00:00Z" });
    expect(updateSourceHealth(previous, old)).toBe(previous);
  });
});
