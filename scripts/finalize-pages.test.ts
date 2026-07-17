import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { finalizePagesBuild } from "./finalize-pages";

describe("finalizePagesBuild", () => {
  it("copies the root entry to archive and issue routes without removing assets", () => {
    const distDir = tempDir("visual-radar-pages-");
    const html = '<!doctype html><div id="root"></div>';
    fs.mkdirSync(path.join(distDir, "assets"));
    fs.writeFileSync(path.join(distDir, "index.html"), html, "utf-8");
    fs.writeFileSync(path.join(distDir, "assets/app.js"), "app", "utf-8");

    finalizePagesBuild({ distDir, issueIds: ["2026-07-16", "2026-07-15"] });

    expect(read(path.join(distDir, "issues/index.html"))).toBe(html);
    expect(read(path.join(distDir, "issues/2026-07-16/index.html"))).toBe(html);
    expect(read(path.join(distDir, "issues/2026-07-15/index.html"))).toBe(html);
    expect(read(path.join(distDir, "assets/app.js"))).toBe("app");
  });

  it.each(["2026-99-99", "2026-02-30", "../../escape", "2026-7-16"])(
    "rejects invalid issue id %s before writing route entries",
    (issueId) => {
      const distDir = tempDir("visual-radar-pages-invalid-");
      fs.writeFileSync(path.join(distDir, "index.html"), "entry", "utf-8");

      expect(() => finalizePagesBuild({ distDir, issueIds: [issueId] })).toThrow(
        `Invalid Visual Radar issue id: ${JSON.stringify(issueId)}`
      );
      expect(fs.existsSync(path.join(distDir, "issues"))).toBe(false);
      expect(fs.existsSync(path.join(distDir, "escape"))).toBe(false);
    }
  );

  it("rejects duplicate issue ids before writing route entries", () => {
    const distDir = tempDir("visual-radar-pages-duplicate-");
    fs.writeFileSync(path.join(distDir, "index.html"), "entry", "utf-8");

    expect(() =>
      finalizePagesBuild({
        distDir,
        issueIds: ["2026-07-16", "2026-07-16"],
      })
    ).toThrow('Duplicate Visual Radar issue id: "2026-07-16"');
    expect(fs.existsSync(path.join(distDir, "issues"))).toBe(false);
  });
});

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
