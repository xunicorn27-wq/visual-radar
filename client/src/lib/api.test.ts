import { describe, expect, it, vi } from "vitest";

import { buildVisualRadarReadUrl, getVisualRadarArchive } from "./api";

describe("buildVisualRadarReadUrl", () => {
  it("revalidates the archive before applying corrections to browser collections", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ issues: [], stories: [] }) });
    vi.stubGlobal("fetch", request);
    try {
      expect(await getVisualRadarArchive()).toEqual({ issues: [], stories: [] });
      expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cache: "no-cache" }));
    } finally { vi.unstubAllGlobals(); }
  });
  it("uses API paths for issue reads in server mode", () => {
    expect(
      buildVisualRadarReadUrl("issues", {
        baseUrl: "/visual-radar/",
        staticMode: false,
      })
    ).toBe("/api/visual-radar/issues");
    expect(
      buildVisualRadarReadUrl("issue", {
        baseUrl: "/visual-radar/",
        issueId: "2026/07 17",
        staticMode: false,
      })
    ).toBe("/api/visual-radar/issues/2026%2F07%2017");
  });

  it("uses the Pages base for the static issue index", () => {
    expect(
      buildVisualRadarReadUrl("issues", {
        baseUrl: "/visual-radar/",
        staticMode: true,
      })
    ).toBe("/visual-radar/public-data/issues/index.json");
  });

  it("encodes static issue ids below the Pages base", () => {
    expect(
      buildVisualRadarReadUrl("issue", {
        baseUrl: "/visual-radar/",
        issueId: "2026/07 17",
        staticMode: true,
      })
    ).toBe("/visual-radar/public-data/issues/2026%2F07%2017.json");
  });

  it("normalizes a static base without a trailing slash", () => {
    expect(
      buildVisualRadarReadUrl("issues", {
        baseUrl: "/visual-radar",
        staticMode: true,
      })
    ).toBe("/visual-radar/public-data/issues/index.json");
  });

  it.each(["sources", "items", "analysis"] as const)(
    "rejects unsupported static %s reads",
    (resource) => {
      expect(() =>
        buildVisualRadarReadUrl(resource, {
          baseUrl: "/visual-radar/",
          staticMode: true,
        })
      ).toThrow(`静态站点不提供 ${resource} 数据`);
    }
  );
});
