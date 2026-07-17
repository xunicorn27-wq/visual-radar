import { describe, expect, it } from "vitest";

import {
  buildBaseHashHref,
  normalizeRouterBase,
} from "./routerBase";

describe("normalizeRouterBase", () => {
  it.each([
    ["/", ""],
    ["/visual-radar/", "/visual-radar"],
    ["/visual-radar", "/visual-radar"],
  ])("normalizes %s to %s", (baseUrl, expected) => {
    expect(normalizeRouterBase(baseUrl)).toBe(expected);
  });
});

describe("buildBaseHashHref", () => {
  it.each([
    ["/", "#sources", "/#sources"],
    ["/visual-radar/", "#sources", "/visual-radar/#sources"],
  ])("builds %s plus %s as %s", (baseUrl, hash, expected) => {
    expect(buildBaseHashHref(baseUrl, hash)).toBe(expected);
  });
});
