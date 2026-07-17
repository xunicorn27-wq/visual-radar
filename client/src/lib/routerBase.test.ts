import { describe, expect, it } from "vitest";

import { normalizeRouterBase } from "./routerBase";

describe("normalizeRouterBase", () => {
  it.each([
    ["/", ""],
    ["/visual-radar/", "/visual-radar"],
    ["/visual-radar", "/visual-radar"],
  ])("normalizes %s to %s", (baseUrl, expected) => {
    expect(normalizeRouterBase(baseUrl)).toBe(expected);
  });
});
