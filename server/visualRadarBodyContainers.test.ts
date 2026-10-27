import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractArticleText, prepareCandidateEvidence, readEvidenceSnapshot } from "./visualRadarEvidence";
import { createIntelItem, emptyIntelMetrics } from "./intelItem";

const topazUrl = "https://www.topazlabs.com/news/example";
const anotherUrl = "https://www.anothermag.com/art-photography/17327/example?utm_source=test";
const paragraph = "The team compared original footage with processed frames and checked motion, texture and facial detail before choosing the final settings.";
const topazBody = `<div class="v26-news-main-content"><div class="v26-rich-text-ondark w-richtext"><p>${paragraph}</p><div><h3>Technical limitations</h3><ul><li>Do not invent details in documentary images.</li></ul></div></div></div>`;
const anotherBody = `<div class="article-main-content"><div class="article-body-container"><div class="article-body"><p>An editorial update, not the complete story.</p><div><p>${paragraph}</p></div><p>Students also made and printed their own photographs.</p></div></div></div>`;
const note = '<script type="application/ld+json">{"@type":"Article","articleBody":"A short update note, not the full interview."}</script>';

describe("Topaz and AnOther article body containers", () => {
  it("extracts nested Topaz paragraphs and lists without navigation or promotions", () => {
    const html = `<nav><p>Buy everything in this product menu.</p></nav><div class="w-richtext"><p>Unrelated promotion.</p></div>${topazBody}<footer><p>Subscribe and buy our software.</p></footer>`;
    const text = extractArticleText(html, topazUrl);
    expect(text).toBe(`${paragraph} Technical limitations Do not invent details in documentary images.`);
    expect(text).not.toMatch(/Buy|Subscribe|promotion/);
  });
  it("prefers AnOther's full visible body over short JSON-LD and omits subscriber content", () => {
    const html = `${note}<article><header><h2>Headline only</h2></header>${anotherBody}<div class="article-subscribe-box"><p>Subscribe to weekly promotions.</p></div></article>`;
    const text = extractArticleText(html, anotherUrl);
    expect(text).toContain(paragraph);
    expect(text).toContain("Students also made");
    expect(text).not.toMatch(/short update note|Headline|Subscribe/);
    expect(text.split(paragraph)).toHaveLength(2);
  });
  it("does not enable adapters on another host, a homepage or an unrelated route", () => {
    for (const url of ["https://evil.example/news/example", "https://www.topazlabs.com/", "https://www.topazlabs.com/products/example"]) expect(extractArticleText(topazBody, url)).toBe("");
    for (const url of ["https://fake.anothermag.com/art-photography/123/example", "https://www.anothermag.com/about"]) expect(extractArticleText(anotherBody, url)).toBe("");
    expect(extractArticleText('<div class="v26-rich-text-ondark"><p>Unscoped rich text alone is not evidence.</p></div>', topazUrl)).toBe("");
  });
  it("ignores scripts and false containers inside comments and does not execute markup", () => {
    const html = `<!-- ${topazBody.replace(paragraph, "Unrelated comment text.")} -->${topazBody.replace("<p>", "<script>throw new Error('execute');</script><style>Style content</style><p>")}`;
    const text = extractArticleText(html, topazUrl);
    expect(text).toContain(paragraph); expect(text).not.toMatch(/Unrelated|execute|Style content/);
  });
  it("fails closed on a malformed scoped Topaz body instead of using a surrounding promo", () => {
    expect(extractArticleText('<main><p>This is a long product promotion, not the article.</p><div class="v26-news-main-content"><p>No known rich text body here.</p></div></main>', topazUrl)).toBe("");
  });
  it("prepares an identity-bound local snapshot without modifying the candidate", async () => {
    const item = createIntelItem({ id: "topaz-test", title: "A production case", text: "Summary only", sourceUrl: topazUrl, capturedAt: "2026-10-27T00:00:00Z", postedAt: null, market: "global", source: "website", sourceType: "inspiration", mediaUrls: [], metrics: emptyIntelMetrics(), signalType: "inspiration_signal", provenance: { authenticity: "live", label: "live" } });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-containers-"));
    const [prepared] = await prepareCandidateEvidence([item], dir, async () => topazBody);
    expect(prepared.sourceEvidence?.status).toBe("ready");
    const snapshot = readEvidenceSnapshot(dir, prepared.sourceEvidence!.snapshotHash!);
    expect(snapshot).toMatchObject({ itemId: item.id, contentHash: item.contentHash, url: topazUrl });
    expect(item.sourceEvidence).toBeUndefined(); expect(prepared.postedAt).toBeNull();
    const [short] = await prepareCandidateEvidence([item], dir, async () => topazBody.replace(paragraph, "Tiny note."));
    expect(short.sourceEvidence?.status).toBe("unavailable");
  });
});
