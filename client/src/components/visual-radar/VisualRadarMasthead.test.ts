import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("VisualRadarMasthead", () => {
  it("builds the sources href from the Vite base URL", () => {
    const source = fs.readFileSync(
      path.join(import.meta.dirname, "VisualRadarMasthead.tsx"),
      "utf-8"
    );

    expect(source).toContain(
      'href={buildBaseHashHref(import.meta.env.BASE_URL, "#sources")}'
    );
    expect(source).not.toContain('href="/#sources"');
  });
});
