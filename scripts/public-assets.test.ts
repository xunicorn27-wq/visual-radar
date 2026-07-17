import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { stagePagesPublicAssets } from "./public-assets";

describe("stagePagesPublicAssets", () => {
  it("rebuilds staging from only the current client public assets", () => {
    const root = tempDir("visual-radar-assets-");
    const sourceDir = path.join(root, "client-public");
    const outputDir = path.join(root, ".pages-public");
    fs.mkdirSync(path.join(sourceDir, "brand"), { recursive: true });
    fs.mkdirSync(path.join(outputDir, "public-data"), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "vr-logo.png"), "logo", "utf-8");
    fs.writeFileSync(path.join(sourceDir, "brand/mark.txt"), "mark", "utf-8");
    fs.writeFileSync(path.join(outputDir, "stale.png"), "stale", "utf-8");
    fs.writeFileSync(path.join(outputDir, "public-data/old.json"), "{}", "utf-8");

    stagePagesPublicAssets({ outputDir, sourceDir });

    expect(read(path.join(outputDir, "vr-logo.png"))).toBe("logo");
    expect(read(path.join(outputDir, "brand/mark.txt"))).toBe("mark");
    expect(fs.existsSync(path.join(outputDir, "stale.png"))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "public-data"))).toBe(false);
  });

  it("creates a clean empty staging directory when client public does not exist", () => {
    const root = tempDir("visual-radar-assets-missing-");
    const outputDir = path.join(root, ".pages-public");
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, "stale.txt"), "stale", "utf-8");

    expect(() =>
      stagePagesPublicAssets({
        outputDir,
        sourceDir: path.join(root, "missing"),
      })
    ).not.toThrow();
    expect(fs.readdirSync(outputDir)).toEqual([]);
  });
});

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
