import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { copyPublicAssets } from "./public-assets";

describe("copyPublicAssets", () => {
  it("recursively copies existing client public assets without removing output files", () => {
    const root = tempDir("visual-radar-assets-");
    const sourceDir = path.join(root, "client-public");
    const outputDir = path.join(root, ".pages-public");
    fs.mkdirSync(path.join(sourceDir, "brand"), { recursive: true });
    fs.mkdirSync(path.join(outputDir, "public-data"), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "vr-logo.png"), "logo", "utf-8");
    fs.writeFileSync(path.join(sourceDir, "brand/mark.txt"), "mark", "utf-8");
    fs.writeFileSync(path.join(outputDir, "public-data/keep.json"), "{}", "utf-8");

    copyPublicAssets({ outputDir, sourceDir });

    expect(read(path.join(outputDir, "vr-logo.png"))).toBe("logo");
    expect(read(path.join(outputDir, "brand/mark.txt"))).toBe("mark");
    expect(read(path.join(outputDir, "public-data/keep.json"))).toBe("{}");
  });

  it("does nothing when client public does not exist", () => {
    const root = tempDir("visual-radar-assets-missing-");
    const outputDir = path.join(root, ".pages-public");

    expect(() =>
      copyPublicAssets({
        outputDir,
        sourceDir: path.join(root, "missing"),
      })
    ).not.toThrow();
    expect(fs.existsSync(outputDir)).toBe(false);
  });
});

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
