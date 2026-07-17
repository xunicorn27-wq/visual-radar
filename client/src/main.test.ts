import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Visual Radar router config", () => {
  it("uses an explicit wildcard route for the 404 fallback", () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, "main.tsx"), "utf-8");

    expect(source).toContain('<Route path="*">');
  });
});
