import { describe, expect, it } from "vitest";

import { buildVisualRadarSourceStats } from "./visualRadarStats";

describe("buildVisualRadarSourceStats", () => {
  it("separates connected sources from planned candidates", () => {
    expect(
      buildVisualRadarSourceStats({
        live: 12,
        planned: 28,
      })
    ).toEqual({
      candidate: 28,
      connected: 12,
    });
  });
});
