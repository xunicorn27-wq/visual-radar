import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildVisualRadarMastheadNavigation } from "./VisualRadarMasthead";

describe("VisualRadarMasthead", () => {
  it("omits the sources item from the navigation model when disabled", () => {
    expect(buildVisualRadarMastheadNavigation(false, "/visual-radar/")).toEqual([
      { href: "/", label: "今日日报", type: "route" },
      { href: "/issues", label: "往期日报", type: "route" },
    ]);
  });

  it("keeps the sources item in the navigation model when enabled", () => {
    expect(buildVisualRadarMastheadNavigation(true, "/visual-radar/")).toEqual([
      { href: "/", label: "今日日报", type: "route" },
      { href: "/issues", label: "往期日报", type: "route" },
      { href: "/visual-radar/#sources", label: "信源", type: "anchor" },
    ]);
  });

  it("shows sources by default", () => {
    expect(
      buildVisualRadarMastheadNavigation(undefined, "/visual-radar/")
    ).toContainEqual({
      href: "/visual-radar/#sources",
      label: "信源",
      type: "anchor",
    });
  });

  it.each([
    ["VisualRadar.tsx", 1],
    ["VisualRadarArchive.tsx", 1],
    ["VisualRadarIssue.tsx", 3],
  ])(
    "disables sources for every masthead in static %s",
    (fileName, expectedCount) => {
      const source = fs.readFileSync(
        path.join(import.meta.dirname, "../../pages", fileName),
        "utf-8"
      );
      const mastheadCount = source.match(/<VisualRadarMasthead\b/g)?.length || 0;
      const staticSourcesCount = source.match(
        /showSources=\{!visualRadarStaticMode\}/g
      )?.length || 0;

      expect(mastheadCount).toBe(expectedCount);
      expect(staticSourcesCount).toBe(mastheadCount);
    }
  );
});
